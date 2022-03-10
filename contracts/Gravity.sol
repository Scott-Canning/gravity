//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Gravity {
    address payable owner;
    uint    numberOfAccounts; // count of Strategies

    mapping (address => mapping (uint => Account)) public accounts; // mapping for each address => AccountId(one of many) => Account
    mapping (address => bool) public sourceTokens; // mapping for supported tokens
    mapping (address => bool) public targetTokens; // mapping for supported tokens

    mapping (uint => PurchaseOrder[]) public purchaseOrders; // Purchase Order mapping to populate purchases for every 

    event NewStrategy(address,uint);
    event Deposited(address, uint256,uint256);
    event Withdrawn(address, uint256, uint256);

    struct Account {
        uint            accountStart;
        address         sourceAsset;
        address         targetAsset;
        uint            sourceBalance;
        uint            deployedBalance;
        uint            targetBalance;
        uint            interval;           // 1, 7, 14, 21, 30
        uint            purchasePercentage;     // % of sourceBalance
        uint            purchasesRemaining;
        bool            withdrawFlag;
    }

    struct PurchaseOrder {
        address user;
        uint    accountId;
        uint    purchaseAmount;
    }    

    constructor(address _sourceToken, address _targetToken) {
        owner = payable(msg.sender);
        // for testing
        sourceTokens[address(_sourceToken)] = true; // TestToken (testing only)
        targetTokens[address(_targetToken)] = true;

        targetTokens[address(_sourceToken)] = true; // Interchanged Target and Source to test withdrawals
        sourceTokens[address(_targetToken)] = true;

        // load asset Kovan addresses into tokenAddress mapping
        // sourceTokens[address(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa)] = true; // DAI
        // sourceTokens[address(0xd0A1E359811322d97991E03f863a0C30C2cF029C)] = true; // WETH
        // sourceTokens[address(0xa36085F69e2889c224210F603D836748e7dC0088)] = true; // LINK
    }

    // create new strategy
    function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchasePercentage) public {
        require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
        //require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
        require(_sourceBalance > 0, "Deposit Balance should be greated than zero");
        require(_purchasePercentage > 0 && _purchasePercentage <= 100, "Percentage is invalid");
        require(IERC20(_sourceAsset).balanceOf(msg.sender) >= _sourceBalance,"Insufficient deposit amount");
        require(_interval == 1 || _interval == 7 || _interval == 14 || _interval == 21 || _interval == 30, "Unsupported interval");
        numberOfAccounts++;
        uint _accountId             = numberOfAccounts;
        uint _accountStart = block.timestamp;

        uint _purchasePerInterval = (_purchasePercentage * _sourceBalance)/100;
        uint _purchasesRemaining = _sourceBalance / _purchasePerInterval;
        accounts[msg.sender][_accountId] = Account(_accountStart, 
                                       _sourceAsset, 
                                       _targetAsset, 
                                       _sourceBalance, 
                                       0, 
                                       0, 
                                       _interval, 
                                       _purchasePerInterval, 
                                       _purchasesRemaining,
                                       false);

        // populate purchaseOrders mapping
        uint _unixNoonToday = _accountStart - (_accountStart % 86400) + 43200;
        uint _unixInterval = _interval * 86400;
        for(uint i = 1; i <= _purchasesRemaining; i++) {
            uint _nextUnixPurchaseDate = _unixNoonToday + (_unixInterval * i);
            PurchaseOrder memory _purchaseOrder = PurchaseOrder(msg.sender, _accountId,_purchasePercentage);
            purchaseOrders[_nextUnixPurchaseDate].push(_purchaseOrder);
        }

        // Call depositSource to move account holders sourcebalance to Gravity contract
        depositSource(_accountId,_sourceAsset,_sourceBalance);

        emit NewStrategy(msg.sender,_accountId);
    }

    // TO DO: batch transactions

    // TO DO: DEX swap

    // TO DO: Aave deposit stablecoins

    // TO DO: update to handle depositing into existing strategy
    // deposit into existing strategy (basic implementation for single source; would updating strategy)
    function depositSource(uint _accountId,address _token, uint256 _amount) internal {
        require(sourceTokens[_token] == true, "Unsupported asset type");
        require(_amount > 0, "Insufficient value");
        //accounts[msg.sender][_accountId].sourceBalance += _amount;
        (bool success) = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Deposit unsuccessful: transferFrom");
        emit Deposited(msg.sender, _accountId, _amount);
    }

    // TO DO: update to handle withdrawing from existing strategy
    function withdraw(uint _accountId) external {
        console.log("numberOfAccounts",numberOfAccounts);
        require(_accountId >= 1 && _accountId <= numberOfAccounts, "Withdraw AccountId is Invalid");
        require(!(accounts[msg.sender][_accountId].withdrawFlag), "AccountId is withdrawn");
   
        // Three scenarios for withdrawal
        // 1. Withdraw if purchasesRemaining = 0, withdraw _targetBalance of type _targetAsset and transfer to user
        // 2. Withdraw if no purchases were made, withdraw _sourceBalance of type _sourceAsset and transfer to user
        // 3. Withdraw if partial purchases were made, withdraw _sourceBalance-totalinvestedAmount of type _sourceAsset 
        //    and totalinvestedAmount of type _targetAsset to user

        uint _purchasesRemaining = accounts[msg.sender][_accountId].purchasesRemaining;
        address _sourceToken = accounts[msg.sender][_accountId].sourceAsset;
        address _targetToken = accounts[msg.sender][_accountId].sourceAsset;
        uint _sourceBalance = accounts[msg.sender][_accountId].sourceBalance;
        uint _targetBalance = accounts[msg.sender][_accountId].targetBalance;

        accounts[msg.sender][_accountId].withdrawFlag = true;
        bool success;

        if (_targetBalance == 0){
            require(_sourceBalance > 0,"Insufficient source asset balance");
            (success) = IERC20(_sourceToken).transfer(msg.sender, _sourceBalance);
            require(success, "Withdraw from source asset unsuccessful");
            emit Withdrawn(msg.sender, _accountId,_sourceBalance);
        }
        else if(_purchasesRemaining == 0){
            require(_targetBalance > 0,"Insufficient source asset balance");
            (success) = IERC20(_targetToken).transfer(msg.sender, _targetBalance);
            require(success, "Withdraw from target asset unsuccessful");
            emit Withdrawn(msg.sender, _accountId,_sourceBalance);
        }
        else{
            require(_sourceBalance > 0,"Insufficient source asset balance");
            require(_targetBalance > 0,"Insufficient source asset balance");
            (success) = IERC20(_sourceToken).transfer(msg.sender, _sourceBalance);
            require(success, "Withdraw from source asset unsuccessful");
            emit Withdrawn(msg.sender, _accountId,_sourceBalance);
            (success) = IERC20(_targetToken).transfer(msg.sender, _targetBalance);
            require(success, "Withdraw from target asset unsuccessful");
            emit Withdrawn(msg.sender, _accountId,_sourceBalance);
        }
    }
        
    // temporary function to extract tokens
    function empty() public {
        require(msg.sender == owner);
        owner.transfer(address(this).balance);
    }

    receive() external payable {}
}
