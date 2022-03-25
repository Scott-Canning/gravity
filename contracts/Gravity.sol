//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';


interface CErc20 {
    function mint(uint256) external returns (uint256);
    function exchangeRateCurrent() external returns (uint256);
    function supplyRatePerBlock() external returns (uint256);
    function redeem(uint) external returns (uint);
    function redeemUnderlying(uint) external returns (uint);
}

contract Gravity is KeeperCompatibleInterface {
    address payable owner;
    bool public onOff = true;                                   // manage toggle Keeper
    uint public immutable upKeepInterval;
    uint public lastTimeStamp;
    uint public purchaseSlot;

    uint24 public constant poolFee = 3000;                      // pool fee set to 0.3%
    ISwapRouter public immutable swapRouter = 
    ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);    // UniswapV3
    uint public amountLent;                                     // DAI lent on Compound

    mapping (address => Account) public accounts;               // user address => user Account
    mapping (uint => PurchaseOrder[]) public purchaseOrders;    // purchaseSlot => purchaseOrders
    mapping (address => bool) public sourceTokens;              // mapping for supported tokens
    mapping (address => bool) public targetTokens;              // mapping for supported tokens

    event NewStrategy(uint blockTimestamp, uint accountStart, address account);
    event PerformUpkeepSucceeded(uint now, uint purchaseSlot, uint targetPurchased);
    event PerformUpkeepFailed(uint now, uint purchaseSlot, uint toPurchase);
    event Deposited(uint timestamp, address from, uint256 sourceDeposited);
    event WithdrawnSource(uint timestamp, address to, uint256 sourceWithdrawn);
    event WithdrawnTarget(uint timestamp, address to, uint256 targetWithdrawn);
    event LentDAI(uint timestamp, uint256 exchangeRate, uint256 supplyRate);
    event RedeemedDAI(uint timestamp, uint256 redeemResult);

    struct Account {
        uint            accountStart;
        address         sourceAsset;
        address         targetAsset;
        uint            sourceBalance;
        uint            scheduledBalance;
        uint            targetBalance;
        uint            interval;                               // 1, 7, 14, 21, 30
        uint            purchaseAmount;                         // purchase amount per interval of sourceBalance
        uint            purchasesRemaining;
    }


    struct PurchaseOrder {
        address         user;
        uint            purchaseAmount;
    }


    constructor(address _sourceToken, address _targetToken, uint _upKeepInterval) {
        owner = payable(msg.sender);
        // keeper variables (in seconds)
        upKeepInterval = _upKeepInterval;
        lastTimeStamp = block.timestamp;
        sourceTokens[address(_sourceToken)] = true;
        targetTokens[address(_targetToken)] = true;
    }


    function swap(address _tokenIn, address _tokenOut, uint256 _amountIn, uint256 _amountOutMin) internal returns (uint256 amountOut) {
        // approve router to spend tokenIn
        TransferHelper.safeApprove(_tokenIn, address(swapRouter), _amountIn);

        // naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum
        // set sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMin,
                sqrtPriceLimitX96: 0
            });

        // execute the swap
        amountOut = swapRouter.exactInputSingle(params);
    }
    

    function lendCompound(address _tokenIn, uint256 _lendAmount) internal returns (uint) {
        // create a reference to the corresponding cToken contract, like cDAI
        CErc20 cToken = CErc20(0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD);

        // amount of current exchange rate from cToken to underlying
        uint256 exchangeRate = cToken.exchangeRateCurrent();

        // amount added to you supply balance this block
        uint256 supplyRate = cToken.supplyRatePerBlock();

        // approve transfer on the ERC20 contract
        IERC20(_tokenIn).approve(0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD, _lendAmount);
        amountLent += _lendAmount;

        // mint cTokens
        uint mintResult = cToken.mint(_lendAmount);
        emit LentDAI(block.timestamp, exchangeRate, supplyRate);
        return mintResult;
    }


    function redeemCompound(uint256 _redeemAmount) internal returns (bool) { 
        require(_redeemAmount <= amountLent, "Redemption amount exceeds lent amount");
        CErc20 cToken = CErc20(0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD);
    
        // retrieve asset based on an amount of the asset
        uint256 redeemResult;
        amountLent -= _redeemAmount;

        // redeem underlying
        redeemResult = cToken.redeemUnderlying(_redeemAmount);
        emit RedeemedDAI(block.timestamp, redeemResult);
        return true;
    }

    // [accelerated demo version]
    function accumulatePurchaseOrders(uint _purchaseSlot) public view returns (uint) {
        uint _total;
        for(uint i = 0; i < purchaseOrders[_purchaseSlot].length; i++) {
            _total += purchaseOrders[_purchaseSlot][i].purchaseAmount;
        }
        return _total;
    }

    // [accelerated demo version]
    function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public {
        require(accounts[msg.sender].purchasesRemaining == 0, "Account has existing strategy");
        require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
        require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
        require(_sourceBalance > 0, "Insufficient deposit amount");
        require(_interval == 1 || _interval == 7 || _interval == 14 || _interval == 21 || _interval == 30, "Unsupported interval");
        
        uint _accountStart = purchaseSlot;
        uint _purchasesRemaining = _sourceBalance / _purchaseAmount;
        
        // handle remainder purchaseAmounts
        if((_sourceBalance % _purchaseAmount) > 0) {
            _purchasesRemaining += 1;
        }

        // target balance carry over if existing user initiates new strategy
        uint _targetBalance = 0;
        if(accounts[msg.sender].targetBalance > 0){
            _targetBalance += accounts[msg.sender].targetBalance;
        }

        accounts[msg.sender] = Account(_accountStart, 
                                       _sourceAsset, 
                                       _targetAsset, 
                                       _sourceBalance, 
                                       0, 
                                       _targetBalance, 
                                       _interval,
                                       _purchaseAmount,
                                       _purchasesRemaining
                                       );

        // populate purchaseOrders mapping
        for(uint i = 0; i < _purchasesRemaining; i++) {
            uint _purchaseSlot = _accountStart + (_interval * i);
            if(accounts[msg.sender].sourceBalance >= accounts[msg.sender].purchaseAmount) {
                purchaseOrders[_purchaseSlot].push(PurchaseOrder(msg.sender, _purchaseAmount));
                accounts[msg.sender].scheduledBalance += _purchaseAmount;
                accounts[msg.sender].sourceBalance -= _purchaseAmount;
            } else { // handles remainder purchase amount
                purchaseOrders[_purchaseSlot].push(PurchaseOrder(msg.sender, accounts[msg.sender].sourceBalance));
                accounts[msg.sender].scheduledBalance += accounts[msg.sender].sourceBalance;
                accounts[msg.sender].sourceBalance -= accounts[msg.sender].sourceBalance;
            }
        }
        depositSource(_sourceAsset, _sourceBalance);
        // [COMMENT FOR LOCAL TESTING]
        lendCompound(_sourceAsset, _sourceBalance / 2); 
        emit NewStrategy(block.timestamp, _accountStart, msg.sender);
    }

    // [accelerated demo version]
    function checkUpkeep(bytes calldata /* checkData */) external view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        uint _now = block.timestamp;
        if((_now - lastTimeStamp) > upKeepInterval) {
                upkeepNeeded = true;
            }
        }
    }

    // [accelerated demo version]
    function performUpkeep(bytes calldata /* performData */) external override {
        uint _now = block.timestamp;
        // revalidate two conditions
        if((_now - lastTimeStamp) > upKeepInterval) {
            lastTimeStamp = _now;
            uint _toPurchase = accumulatePurchaseOrders(purchaseSlot);

            if (_toPurchase > 0) {
                // compound redeem
                // [COMMENT FOR LOCAL TESTING]
                if(_toPurchase > IERC20(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa).balanceOf(address(this))) {
                    redeemCompound(_toPurchase - IERC20(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa).balanceOf(address(this)));
                }

                uint256 _targetPurchased = swap(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa, 
                                                0xd0A1E359811322d97991E03f863a0C30C2cF029C,
                                                _toPurchase,
                                                0);

                // update each account's scheduledBalance, targetBalance, and purchasesRemaining
                for(uint i = 0; i < purchaseOrders[purchaseSlot].length; i++) {
                    accounts[purchaseOrders[purchaseSlot][i].user].scheduledBalance -= purchaseOrders[purchaseSlot][i].purchaseAmount;
                    accounts[purchaseOrders[purchaseSlot][i].user].purchasesRemaining -= 1;
                    accounts[purchaseOrders[purchaseSlot][i].user].targetBalance += purchaseOrders[purchaseSlot][i].purchaseAmount * _targetPurchased / _toPurchase;
                    accounts[purchaseOrders[purchaseSlot][i].user].accountStart = (purchaseSlot + accounts[purchaseOrders[purchaseSlot][i].user].interval);
                    if(accounts[purchaseOrders[purchaseSlot][i].user].purchasesRemaining == 0) {
                        accounts[purchaseOrders[purchaseSlot][i].user].interval = 0;
                    }
                }

                // delete purchaseOrder post swap
                delete purchaseOrders[purchaseSlot];
                emit PerformUpkeepSucceeded(_now, purchaseSlot, _targetPurchased);
            }
            purchaseSlot++;
        }
    }

    // reconstruct accounts deployment schedule
    function reconstructSchedule(address _account) public view returns (uint256[] memory, uint256[] memory) {
        uint _accountStart = accounts[_account].accountStart;
        uint _interval = accounts[_account].interval;
        uint _purchasesRemaining = accounts[_account].purchasesRemaining;

        // temporary arrays to be returned
        uint[] memory purchaseSlots = new uint[](_purchasesRemaining);
        uint[] memory purchaseAmounts = new uint[](_purchasesRemaining);

        // reconstruct strategy's deployment schedule
        for(uint i = 0; i < _purchasesRemaining; i++) {
            uint _nextPurchaseSlot = _accountStart + (_interval * i);
            purchaseSlots[i] = _nextPurchaseSlot;
            for(uint k = 0; k < purchaseOrders[purchaseSlots[i]].length; k++){
                if(purchaseOrders[purchaseSlots[i]][k].user == _account){
                    purchaseAmounts[i] = purchaseOrders[purchaseSlots[i]][k].purchaseAmount;
                    k = purchaseOrders[purchaseSlots[i]].length;
                }
            }
        }
        return(purchaseSlots, purchaseAmounts);
    }

    // [initiateNewStrategy helper] does not handle depositing into existing strategies
    function depositSource(address _token, uint256 _amount) internal {
        require(sourceTokens[_token] == true, "Unsupported asset type");
        require(_amount > 0, "Insufficient value");
        (bool success) = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Deposit unsuccessful");
        emit Deposited(block.timestamp, msg.sender, _amount);
    }

    // [withdrawSource helper] constant time delete function 
    function removePurchaseOrder(uint _purchaseSlot, uint _purchaseOrderIndex) internal {
        require(purchaseOrders[_purchaseSlot].length > _purchaseOrderIndex, "Purchase order index out of range");
        purchaseOrders[_purchaseSlot][_purchaseOrderIndex] = purchaseOrders[_purchaseSlot][purchaseOrders[_purchaseSlot].length - 1];
        purchaseOrders[_purchaseSlot].pop(); // implicit delete
    }

    // withdraw source token
    function withdrawSource(address _token, uint256 _amount) external {
        require(sourceTokens[_token] == true, "Unsupported asset type");
        require(accounts[msg.sender].scheduledBalance >= _amount, "Scheduled balance insufficient");
        (uint[] memory purchaseSlots, uint[] memory purchaseAmounts) = reconstructSchedule(msg.sender);
        uint256 _accumulate;
        uint256 i = purchaseSlots.length - 1;
        // remove purchase orders in reverse order, comparing withdrawal amount with purchaseAmount
        while(_amount > _accumulate) {
            for(uint k = 0; k < purchaseOrders[purchaseSlots[i]].length; k++) {
                if(purchaseOrders[purchaseSlots[i]][k].user == msg.sender) {
                    // case 1: amount equals (purchase amount + accumulated balance), PO is removed
                    if(purchaseOrders[purchaseSlots[i]][k].purchaseAmount + _accumulate == _amount) {
                        _accumulate = _amount;
                        accounts[msg.sender].purchasesRemaining -= 1;
                        removePurchaseOrder(purchaseSlots[i], k); 
                    // case 2: amount less than (purchase amount + accumulated balance), PO is reduced
                    } else if(purchaseOrders[purchaseSlots[i]][k].purchaseAmount + _accumulate > _amount) {
                        // reduce purchase amount by difference
                        purchaseOrders[purchaseSlots[i]][k].purchaseAmount -= (_amount - _accumulate);
                        _accumulate = _amount;
                    // case 3: amount exceeds (purchase amount + accumulated balance), PO is removed, continue accumulating
                    } else {
                        _accumulate += purchaseOrders[purchaseSlots[i]][k].purchaseAmount;
                        accounts[msg.sender].purchasesRemaining -= 1;
                        removePurchaseOrder(purchaseSlots[i], k);
                    }
                    k = purchaseOrders[purchaseSlots[i]].length;
                }
            }
            if(i > 0) {
                i -= 1;
            }
        }

        // if treasury cannot cover, redeem
        // [COMMENT FOR LOCAL TESTING]
        if(_amount > IERC20(_token).balanceOf(address(this))){
           redeemCompound(_amount - IERC20(_token).balanceOf(address(this)));
        }

        accounts[msg.sender].scheduledBalance -= _amount;
        (bool success) = IERC20(_token).transfer(msg.sender, _amount);
        require(success, "Withdrawal unsuccessful");
        emit WithdrawnSource(block.timestamp, msg.sender, _amount);
    }

    // withdraw target token
    function withdrawTarget(address _token, uint256 _amount) external {
        require(targetTokens[_token] == true, "Unsupported asset type");
        require(accounts[msg.sender].targetBalance >= _amount);
        accounts[msg.sender].targetBalance -= _amount;
        (bool success) = IERC20(_token).transfer(msg.sender, _amount);
        require(success, "Withdrawal unsuccessful");
        emit WithdrawnTarget(block.timestamp, msg.sender, _amount);
    }
    
    // temporary demo function to extract tokens
    function withdrawERC20(address _token, uint256 _amount) onlyOwner external {
        require(IERC20(_token).balanceOf(address(this)) >= _amount, "Insufficient balance");
        (bool success) = IERC20(_token).transfer(msg.sender, _amount);
        require(success, "Withdrawal unsuccessful");
    }

    // temporary demo function to extract ETH
    function withdrawETH() onlyOwner external {
        owner.transfer(address(this).balance);
    }

    // temporary demo function to manage Keeper
    function toggleOnOff(bool _onOff) onlyOwner external {
        require(msg.sender == owner, "Owner only");
        onOff = _onOff;
    }

    modifier onlyOwner () {
        require(msg.sender == owner, "Owner only");
        _;
    }

    receive() external payable {}
}     