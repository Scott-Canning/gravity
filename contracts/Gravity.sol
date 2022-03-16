//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

contract Gravity is KeeperCompatibleInterface {
    address payable owner;
    bool public onOff = true;                                   // [testing] toggle Keeper on/off
    uint public immutable upKeepInterval;
    uint public lastTimeStamp;

    uint24 public constant poolFee = 3000;                      // pool fee set to 0.3%
    ISwapRouter public immutable swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);  // UniswapV3

    mapping (address => Account) public accounts;               // user address => user Account
    mapping (address => bool) public sourceTokens;              // mapping for supported tokens
    mapping (address => bool) public targetTokens;              // mapping for supported tokens
    mapping (uint => PurchaseOrder[]) public purchaseOrders;

    event NewStrategy(address);
    event PurchaseExecuted(uint timestamp, uint targetPurchased);
    event PerformUpkeepFailed(uint timestamp);
    event Deposited(address, uint256 sourceDeposit);
    event Withdrawn(address, uint256);

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
        bool            withdrawFlag;
    }

    struct PurchaseOrder {
        address user;
        uint    purchaseAmount;
    }    

    constructor(address _sourceToken, address _targetToken, uint _upKeepInterval) {
        owner = payable(msg.sender);
        // keeper variables (in seconds)
        upKeepInterval = _upKeepInterval;
        lastTimeStamp = block.timestamp;
        
        // for testing
        sourceTokens[address(_sourceToken)] = true; // TestToken (testing only)
        targetTokens[address(_targetToken)] = true;

        // interchanged target and Source to test withdrawals
        targetTokens[address(_sourceToken)] = true; 
        sourceTokens[address(_targetToken)] = true;

        // load asset Kovan addresses into tokenAddress mapping
        // sourceTokens[address(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa)] = true; // DAI
        // sourceTokens[address(0xd0A1E359811322d97991E03f863a0C30C2cF029C)] = true; // WETH
        // sourceTokens[address(0xa36085F69e2889c224210F603D836748e7dC0088)] = true; // LINK
    }

    function swap(address _tokenIn, address _tokenOut, uint256 _amountIn, uint256 _amountOutMin) internal returns (uint256 amountOut) {
        // approve the router to spend DAI.
        TransferHelper.safeApprove(_tokenIn, address(swapRouter), _amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
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

        // The call to `exactInputSingle` executes the swap.
        amountOut = swapRouter.exactInputSingle(params);
    }
    
    // [test_timestamp] accumulatePurchaseOrders
    function accumulatePurchaseOrders(uint _timestamp) public view returns (uint) {
        uint _total;
        for(uint i = 0; i < purchaseOrders[_timestamp].length; i++) {
            _total += purchaseOrders[_timestamp][i].purchaseAmount;
        }
        return _total;
    }

    // [production] initiateNewStrategy
    // function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public {
    //     require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
    //     require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
    //     require(_sourceBalance > 0, "Insufficient deposit amount");
    //     require(_interval == 1 || _interval == 7 || _interval == 14 || _interval == 21 || _interval == 30, "Unsupported interval");
    //     uint _accountStart = block.timestamp;
    //     uint _purchasesRemaining = _sourceBalance / _purchaseAmount;
    //     accounts[msg.sender] = Account(_accountStart, 
    //                                    _sourceAsset, 
    //                                    _targetAsset, 
    //                                    _sourceBalance, 
    //                                    0, 
    //                                    0, 
    //                                    _interval, 
    //                                    _purchaseAmount, 
    //                                    _purchasesRemaining);

    //     // populate purchaseOrders mapping
    //     uint _unixNoonToday = _accountStart - (_accountStart % 86400) + 86400 + 43200;
    //     uint _unixInterval = _interval * 86400;
    //     for(uint i = 1; i <= _purchasesRemaining; i++) {
    //         uint _nextUnixPurchaseDate = _unixNoonToday + (_unixInterval * i);
    //         purchaseOrders[_nextUnixPurchaseDate].push(PurchaseOrder(msg.sender, _purchaseAmount));
    //     }

    //     // transfer user balance to contract
    //     (bool success) = IERC20(_sourceAsset).transferFrom(msg.sender, address(this), _sourceBalance);
    //     require(success, "Initiate new strategy unsuccessful");
    //     emit NewStrategy(msg.sender);
    // }

    // [test_timestamp] initiateNewStrategy
    function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public {
        require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
        require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
        require(_sourceBalance > 0, "Insufficient deposit amount");
        require(_interval == 1 || _interval == 7 || _interval == 14 || _interval == 21 || _interval == 30, "Unsupported interval");
        
        uint _accountStart = block.timestamp;
        uint _purchasesRemaining = _sourceBalance / _purchaseAmount;
        
        // handle remainder purchaseAmounts
        if((_sourceBalance % _purchaseAmount) > 0) {
            _purchasesRemaining = _purchasesRemaining + 1;
        }

        accounts[msg.sender] = Account(_accountStart, 
                                       _sourceAsset, 
                                       _targetAsset, 
                                       _sourceBalance, 
                                       0, 
                                       0, 
                                       _interval,
                                       _purchaseAmount,
                                       _purchasesRemaining,
                                       false);

        // populate purchaseOrders mapping
        uint _unixNextSlot = _accountStart - (_accountStart % upKeepInterval) + 2 * upKeepInterval;
        uint _unixInterval = _interval * upKeepInterval;
        for(uint i = 1; i <= _purchasesRemaining; i++) {
            uint _nextUnixPurchaseDate = _unixNextSlot + (_unixInterval * i);
            if(accounts[msg.sender].sourceBalance > accounts[msg.sender].purchaseAmount) {
                purchaseOrders[_nextUnixPurchaseDate].push(PurchaseOrder(msg.sender, _purchaseAmount));
                accounts[msg.sender].scheduledBalance += _purchaseAmount;
                accounts[msg.sender].sourceBalance -= _purchaseAmount;
                
            } else {
                purchaseOrders[_nextUnixPurchaseDate].push(PurchaseOrder(msg.sender, accounts[msg.sender].sourceBalance));
                accounts[msg.sender].scheduledBalance += accounts[msg.sender].sourceBalance;
                accounts[msg.sender].sourceBalance -= accounts[msg.sender].sourceBalance;
            }
        }

        // deposit sourceBalance into contract
        depositSource(_sourceAsset, _sourceBalance);
        emit NewStrategy(msg.sender);
    }

    // [production] checkUpkeep
    // function checkUpkeep(bytes calldata /* checkData */) external override returns (bool upkeepNeeded, bytes memory /* performData */) {
    //     require(onOff == true, "Keeper checkUpkeep is off");
    //     uint _now = block.timestamp;
    //     uint _unixNoonToday = _now - (_now % 86400) + 43200;
    //     // if timestamp > noon
    //     if(block.timestamp > _unixNoonToday) {
    //         // if total PO > 0
    //         uint _total = accumulatePurchaseOrders();
    //         if(_total > 0) {
    //             upkeepNeeded = true;
    //         }
    //     }
    // }

    // [test_timestamp] checkUpkeep
    function checkUpkeep(bytes calldata /* checkData */) external override returns (bool upkeepNeeded, bytes memory /* performData */) {
        require(onOff == true, "Keeper checkUpkeep is off");
        if((block.timestamp - lastTimeStamp) > upKeepInterval) {
            uint _now = block.timestamp;
            uint _nextSlot = _now - (_now % upKeepInterval) + 2 * upKeepInterval;
            uint _toPurchase = accumulatePurchaseOrders(_nextSlot);
            if(_toPurchase > 0) {
                upkeepNeeded = true;
            }
        }
    }

    // [test_timestamp] performUpkeep
    function performUpkeep(bytes calldata /* performData */) external override {
        //revalidate the upkeep in the performUpkeep function
        require(onOff == true, "Keeper checkUpkeep is off");
        uint _now = block.timestamp;
        uint _nextSlot = _now - (_now % upKeepInterval) + 2 * upKeepInterval;
        uint _toPurchase = accumulatePurchaseOrders(_nextSlot);
        lastTimeStamp = block.timestamp;
        if (_toPurchase > 0) {

            uint256 _targetPurchased = swap(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa, 
                                            0xd0A1E359811322d97991E03f863a0C30C2cF029C,
                                            _toPurchase
                                            ,0);

            // update each account's scheduledBalance, targetBalance, and purchasesRemaining
            for(uint i = 0; i < purchaseOrders[_nextSlot].length; i++) {
                accounts[purchaseOrders[_nextSlot][i].user].scheduledBalance -= purchaseOrders[_nextSlot][i].purchaseAmount;
                accounts[purchaseOrders[_nextSlot][i].user].purchasesRemaining -= 1;
                accounts[purchaseOrders[_nextSlot][i].user].targetBalance += purchaseOrders[_nextSlot][i].purchaseAmount * (_targetPurchased * 10000) / _toPurchase; // stored as N * 10 ** 4
            }
            emit PurchaseExecuted(_nextSlot, _targetPurchased);
        } else {
            emit PerformUpkeepFailed(block.timestamp);
        }
    }

    // reconstruct deployment schedule of account's strategy; naive implementation (works for un-executed strategies)
    function reconstructSchedule(address _account) public view returns (uint256[] memory, uint256[] memory) {
        // get account data
        uint _accountStart = accounts[_account].accountStart;
        uint _scheduledBalance = accounts[_account].scheduledBalance;
        uint _interval = accounts[_account].interval;
        uint _purchasesRemaining = accounts[_account].purchasesRemaining;
        uint _purchaseAmount = accounts[_account].purchaseAmount;

        // create temporary arrays to be returned
        uint[] memory timestamps = new uint[](_purchasesRemaining);
        uint[] memory purchaseAmounts = new uint[](_purchasesRemaining);

        // reconstruct strategy's deployment schedule
        uint _unixNextTwoMinSlot = _accountStart - (_accountStart % 120) + 240;
        uint _unixInterval = _interval * 120;
        for(uint i = 1; i <= _purchasesRemaining; i++) {
            uint _nextUnixPurchaseDate = _unixNextTwoMinSlot + (_unixInterval * i);
            timestamps[i - 1] = _nextUnixPurchaseDate;
            purchaseAmounts[i - 1] = (_scheduledBalance / _purchasesRemaining);
        }
        return(timestamps, purchaseAmounts);
    }

    // TO DO: update to handle depositing into existing strategy
    // deposit into existing strategy (basic implementation for single source; would updating strategy)
    function depositSource(address _token, uint256 _amount) internal {
        //require(sourceTokens[_token] == true, "Unsupported asset type");
        require(_amount > 0, "Insufficient value");
        (bool success) = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Deposit unsuccessful: transferFrom");
        emit Deposited(msg.sender, _amount);
    }

    // TO DO: update to handle withdrawing from existing strategy
    // TO do testing for partial withdrawal of LIVE strategy
    function withdraw() external {
        require(accounts[msg.sender].accountStart > 0, "Withdraw Address is Invalid");
        require(!(accounts[msg.sender].withdrawFlag), "Account is withdrawn");

        // Three scenarios for withdrawal
        // 1. Withdraw if purchasesRemaining = 0, withdraw _targetBalance of type _targetAsset and transfer to user
        // 2. Withdraw if no purchases were made, withdraw _sourceBalance of type _sourceAsset and transfer to user
        // 3. Withdraw if partial purchases were made, withdraw _sourceBalance-totalinvestedAmount of type _sourceAsset 
        //    and totalinvestedAmount of type _targetAsset to user

        uint    _purchasesRemaining = accounts[msg.sender].purchasesRemaining;
        address _sourceToken        = accounts[msg.sender].sourceAsset;
        address _targetToken        = accounts[msg.sender].targetAsset;
        uint    _sourceBalance      = accounts[msg.sender].sourceBalance;
        uint    _targetBalance      = accounts[msg.sender].targetBalance;

        accounts[msg.sender].withdrawFlag = true;
        bool success;

        if (_targetBalance == 0){
            require(_sourceBalance > 0,"For zero investment, _sourceBalance is zero");
            
            if(IERC20(_sourceToken).balanceOf(address(this)) < _sourceBalance){
                // TO DO: if treasury do not have enough source asset token, make call to Aave for retrieval
            }

            (success) = IERC20(_sourceToken).transfer(msg.sender, _sourceBalance);
            require(success, "Withdraw from source asset unsuccessful");
            emit Withdrawn(msg.sender, _sourceBalance);
        }
        else if(_purchasesRemaining == 0){
            require(_targetBalance > 0,"Insufficient source asset balance");

            if(IERC20(_targetToken).balanceOf(address(this)) < _targetBalance){
                // TO DO: if treasury do not have enough target asset token, make call to Aave for retrieval
            }

            (success) = IERC20(_targetToken).transfer(msg.sender, _targetBalance);
            require(success, "Withdraw from target asset unsuccessful");
            emit Withdrawn(msg.sender, _sourceBalance);
        }
        else{
            require(_sourceBalance > 0,"Insufficient source asset balance for partial withdrawal");
            require(_targetBalance > 0,"Insufficient target asset balance for partial withdrawal");

            if(IERC20(_targetToken).balanceOf(address(this)) < _targetBalance){
                // TO DO: if treasury do not have enough target asset token, make call to AAVE for retrieval
            }

            if(IERC20(_sourceToken).balanceOf(address(this)) < _sourceBalance){
              // TO DO: if treasury do not have enough source asset token, make call to AAVE for retrieval
            }

            (success) = IERC20(_sourceToken).transfer(msg.sender, _sourceBalance);
            require(success, "Withdraw from source asset unsuccessful");
            emit Withdrawn(msg.sender, _sourceBalance);
            (success) = IERC20(_targetToken).transfer(msg.sender, _targetBalance);
            require(success, "Withdraw from target asset unsuccessful");
            emit Withdrawn(msg.sender, _sourceBalance);
        }
    }

    // [testing] temporary function to extract tokens
    function empty() public {
        require(msg.sender == owner);
        owner.transfer(address(this).balance);
    }

    // [testing] temporary function to control upkeep
    function toggleOnOff(bool _onOff) external {
        require(msg.sender == owner, "Owner only");
        onOff = _onOff;
    }

    receive() external payable {}
}     