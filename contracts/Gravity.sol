//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";

contract Gravity is KeeperCompatibleInterface {
    address payable owner;
    bool public onOff = true; // [testing] toggle Keeper on/off
    uint public immutable upKeepInterval;
    uint public lastTimeStamp;
    uint public priorSlot;
    uint public nextSlot = 1;

    mapping (address => Account) public accounts;               // user address => user Account
    mapping (address => bool) public sourceTokens;              // mapping for supported tokens
    mapping (address => bool) public targetTokens;              // mapping for supported tokens
    mapping (uint => PurchaseOrder[]) public purchaseOrders;

    event NewStrategy(address);
    event PurchaseExecuted(uint256);    // testing
    event PurchaseNotExecuted(uint256); // testing
    event Deposited(address, uint256);
    event Withdrawn(address, uint256);

    struct Account {
        uint            accountStart;
        address         sourceAsset;
        address         targetAsset;
        uint            sourceBalance;
        uint            scheduledBalance;
        uint            targetBalance;
        uint            interval;               // 1, 7, 14, 21, 30
        uint            purchaseAmount;         // purchase amount per interval of sourceBalance
        uint            purchasesRemaining;
    }

    struct PurchaseOrder {
        address user;
        uint    purchaseAmount;
    }    

    constructor(address _sourceToken, address _targetToken, uint _upKeepInterval) {
        owner = payable(msg.sender);
        // keeper variables
        upKeepInterval = _upKeepInterval; // in seconds
        lastTimeStamp = block.timestamp;

        // for testing
        sourceTokens[address(_sourceToken)] = true; // TestToken (testing only)
        targetTokens[address(_targetToken)] = true;

        // load initial Kovan asset addresses into tokenAddress mapping
        // sourceTokens[address(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa)] = true; // DAI
        // sourceTokens[address(0xd0A1E359811322d97991E03f863a0C30C2cF029C)] = true; // WETH
        // sourceTokens[address(0xa36085F69e2889c224210F603D836748e7dC0088)] = true; // LINK
    }

    /*
    * - - - - - - - - - - - - keeper integration [start] - - - - - - - - - - - - 
    */

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
    //     upkeepNeeded = false;
    // }

    // [test_timestamp] accumulatePurchaseOrders
    function accumulatePurchaseOrders(uint _timestamp) public view returns (uint) {
        uint _total;
        for(uint i = 0; i < purchaseOrders[_timestamp].length; i++) {
            _total += purchaseOrders[_timestamp][i].purchaseAmount;
        }
        return _total;
    }

    // [test_timestamp] initiateNewStrategy
    function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public {
        require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
        require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
        require(_sourceBalance > 0, "Insufficient deposit amount");
        require(_interval == 1 || _interval == 7 || _interval == 14 || _interval == 21 || _interval == 30, "Unsupported interval");
        uint _accountStart = block.timestamp;
        uint _purchasesRemaining = _sourceBalance / _purchaseAmount;
        accounts[msg.sender] = Account(_accountStart, 
                                       _sourceAsset, 
                                       _targetAsset, 
                                       _sourceBalance, 
                                       0, 
                                       0, 
                                       _interval, 
                                       _purchaseAmount, 
                                       _purchasesRemaining);

        // populate purchaseOrders mapping
        uint _unixNextTwoMinSlot = _accountStart - (_accountStart % 60) + 120;
        uint _unixInterval = _interval * 120;
        for(uint i = 1; i <= _purchasesRemaining; i++) {
            uint _nextUnixPurchaseDate = _unixNextTwoMinSlot + (_unixInterval * i);
            purchaseOrders[_nextUnixPurchaseDate].push(PurchaseOrder(msg.sender, _purchaseAmount));
        }

        // transfer user balance to contract
        (bool success) = IERC20(_sourceAsset).transferFrom(msg.sender, address(this), _sourceBalance);
        require(success, "Initiate new strategy unsuccessful");
        emit NewStrategy(msg.sender);
    }

    // [test] checkUpkeep
    function checkUpkeep(bytes calldata /* checkData */) external override returns (bool upkeepNeeded, bytes memory /* performData */) {
        require(onOff == true, "Keeper checkUpkeep is off");
        if((block.timestamp - lastTimeStamp) > upKeepInterval) {
            uint _now = block.timestamp;
            nextSlot = _now - (_now % 60) + 120;
            if(priorSlot != nextSlot) {
                uint _total = accumulatePurchaseOrders(nextSlot);
                if(_total > 0) {
                    priorSlot = nextSlot;
                    upkeepNeeded = true;
                }
            }
        }
    }

    // [test] performUpkeep
    function performUpkeep(bytes calldata /* performData */) external override {
        //revalidate the upkeep in the performUpkeep function
        require(onOff == true, "Keeper checkUpkeep is off");
        uint _total = accumulatePurchaseOrders(nextSlot);
        if (_total > 0) {
            /*
            * TO DO: add dex transaction
            */
            emit PurchaseExecuted(block.timestamp);
        }
    }

    /*
    *  - - - - - - - - - - - - keeper integration [end] - - - - - - - - - - - - 
    */

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
    //     uint _unixTwoMinsFromNow = _accountStart - (_accountStart % 86400) + 86400 + 43200;
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


    // TO DO: DEX swap

    // TO DO: Aave deposit stablecoins

    // TO DO: update to handle depositing into existing strategy
    // deposit into existing strategy (basic implementation for single source; would updating strategy)
    function depositSource(address _token, uint256 _amount) external {
        //require(sourceTokens[_token] == true, "Unsupported asset type");
        require(_amount > 0, "Insufficient value");
        accounts[msg.sender].sourceBalance += _amount;
        (bool success) = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Deposit unsuccessful: transferFrom");
        emit Deposited(msg.sender, _amount);
    }

    // TO DO: update to handle withdrawing from existing strategy
    function withdrawSource(address _token, uint256 _amount) external {
        //require(sourceTokens[_token] == true, "Unsupported asset type");
        require(accounts[msg.sender].sourceBalance >= _amount);
        accounts[msg.sender].sourceBalance -= _amount;
        (bool success) = IERC20(_token).transfer(msg.sender, _amount);
        require(success, "Withdraw unsuccessful");
        emit Withdrawn(msg.sender, _amount);
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
