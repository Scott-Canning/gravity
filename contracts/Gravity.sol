//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Gravity {
    address payable owner;
    uint numberOfAccounts; // count of Strategies

    mapping (address => Account) public accounts;  // user address => user balance
    mapping (address => bool) public sourceTokens; // mapping for supported tokens
    mapping (address => bool) public targetTokens; // mapping for supported tokens
    mapping (uint => PurchaseOrder[]) public purchaseOrders;

    event NewStrategy(address);
    event Deposited(address, uint256);
    event Withdrawn(address, uint256);

    struct Account {
        uint            accountStart;
        address         sourceAsset;
        address         targetAsset;
        uint            sourceBalance;
        uint            deployedBalance;
        uint            targetBalance;
        uint            interval;           // 1, 7, 14, 21, 30
        uint            purchaseAmount;     // purchase amount per interval of sourceBalance
        uint            purchasesRemaining;
        bool            withdrawFlag;
    }

    struct PurchaseOrder {
        address user;
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

    // [production] accumulatePurchaseOrders
    // function accumulatePurchaseOrders() internal view returns (uint) {
    //     uint _now = block.timestamp;
    //     uint _unixNoonToday = _now - (_now % 86400) + 43200;
    //     uint _total;
    //     for(uint i = 0; i < purchaseOrders[_unixNoonToday].length; i++) {
    //         _total += purchaseOrders[_unixNoonToday][i].purchaseAmount;
    //     }
    //     return _total;
    // }

    // create new strategy
    function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public {
        require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
        require(accounts[msg.sender].sourceAsset !=_sourceAsset, "User has existing policy");
        //require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
        require(_sourceBalance > 0, "Deposit Balance should be greater than zero");
        require(_purchaseAmount > 0 && _purchaseAmount <= _sourceBalance, "Interval Puchase Amount is Incorrect");
        require(IERC20(_sourceAsset).balanceOf(msg.sender) >= _sourceBalance,"Insufficient deposit amount");
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
                                       _purchasesRemaining,
                                       false);

        // populate purchaseOrders mapping
        uint _unixNoonToday = _accountStart - (_accountStart % 86400) + 43200;
        uint _unixInterval = _interval * 86400;
        for(uint i = 1; i <= _purchasesRemaining; i++) {
            uint _nextUnixPurchaseDate = _unixNoonToday + (_unixInterval * i);
            PurchaseOrder memory _purchaseOrder = PurchaseOrder(msg.sender, _purchaseAmount);
            purchaseOrders[_nextUnixPurchaseDate].push(_purchaseOrder);
        }

        // Call depositSource to move account holders sourcebalance to Gravity contract
        depositSource(_sourceAsset,_sourceBalance);
    }

    // TO DO: batch transactions

    // TO DO: DEX swap

    // TO DO: Aave deposit stablecoins

    // TO DO: update to handle depositing into existing strategy
    // deposit into existing strategy (basic implementation for single source; would updating strategy)
    function depositSource(address _token, uint256 _amount) internal {
        //require(sourceTokens[_token] == true, "Unsupported asset type");
        require(_amount > 0, "Insufficient value");
        (bool success) = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Deposit unsuccessful: transferFrom");
        emit Deposited(msg.sender, _amount);
    }

        // TO do testing for partial withdrawal of LIVE strategy
     function withdraw() external {
        
        require(accounts[msg.sender].accountStart > 0, "Withdraw Address is Invalid");
        require(!(accounts[msg.sender].withdrawFlag), "Account is withdrawn");

        // Three scenarios for withdrawal
        // 1. Withdraw if purchasesRemaining = 0, withdraw _targetBalance of type _targetAsset and transfer to user
        // 2. Withdraw if no purchases were made, withdraw _sourceBalance of type _sourceAsset and transfer to user
        // 3. Withdraw if partial purchases were made, withdraw _sourceBalance-totalinvestedAmount of type _sourceAsset 
        //    and totalinvestedAmount of type _targetAsset to user

        uint _purchasesRemaining = accounts[msg.sender].purchasesRemaining;
        address _sourceToken = accounts[msg.sender].sourceAsset;
        address _targetToken = accounts[msg.sender].targetAsset;
        uint _sourceBalance = accounts[msg.sender].sourceBalance;
        uint _targetBalance = accounts[msg.sender].targetBalance;

        console.log("_purchasesRemaining",_purchasesRemaining);
        console.log("_targetBalance",_targetBalance);
        console.log("_sourceBalance",_sourceBalance);

        accounts[msg.sender].withdrawFlag = true;
        bool success;

        if (_targetBalance == 0){
            require(_sourceBalance > 0,"For zero investment, _sourceBalance is zero");
            
            if(IERC20(_sourceToken).balanceOf(address(this)) < _sourceBalance){
                console.log("Less balance source");
                // TO DO: if treasury do not have enough source asset token, make call to Aave for retrieval
            }

            (success) = IERC20(_sourceToken).transfer(msg.sender, _sourceBalance);
            require(success, "Withdraw from source asset unsuccessful");
            emit Withdrawn(msg.sender, _sourceBalance);
        }
        else if(_purchasesRemaining == 0){
            require(_targetBalance > 0,"Insufficient source asset balance");

            if(IERC20(_targetToken).balanceOf(address(this)) < _targetBalance){
                console.log("Less balance target");
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
                console.log("Less balance target");
                // TO DO: if treasury do not have enough target asset token, make call to AAVE for retrieval
            }

            if(IERC20(_sourceToken).balanceOf(address(this)) < _sourceBalance){
              console.log("Less balance source");
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

    // temporary function to extract tokens
    function empty() public {
        require(msg.sender == owner);
        owner.transfer(address(this).balance);
    }

    receive() external payable {}
}