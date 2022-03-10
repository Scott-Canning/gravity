//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Gravity {
    address payable owner;

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
        uint            purchaseAmount;     // % of sourceBalance
        uint            purchasesRemaining;
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

        // load asset Kovan addresses into tokenAddress mapping
        // sourceTokens[address(0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa)] = true; // DAI
        // sourceTokens[address(0xd0A1E359811322d97991E03f863a0C30C2cF029C)] = true; // WETH
        // sourceTokens[address(0xa36085F69e2889c224210F603D836748e7dC0088)] = true; // LINK
    }

    // create new strategy
    function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public {
        require(sourceTokens[_sourceAsset] == true, "Unsupported source asset type");
        //require(targetTokens[_targetAsset] == true, "Unsupported target asset type");
        require(_sourceBalance > 0, "Insufficient deposit amount");
        require(_interval == 1 || _interval == 7 || _interval == 14 || _interval == 21 || _interval == 30, "Unsupported interval");
        uint _accountStart = block.timestamp;
        uint _purchasePerInterval = _purchaseAmount * _sourceBalance;
        uint _purchasesRemaining = _sourceBalance / _purchasePerInterval;
        accounts[msg.sender] = Account(_accountStart, 
                                       _sourceAsset, 
                                       _targetAsset, 
                                       _sourceBalance, 
                                       0, 
                                       0, 
                                       _interval, 
                                       _purchasePerInterval, 
                                       _purchasesRemaining);

        // populate purchaseOrders mapping
        uint _unixNoonToday = _accountStart - (_accountStart % 86400) + 43200;
        uint _unixInterval = _interval * 86400;
        for(uint i = 1; i <= _purchasesRemaining; i++) {
            uint _nextUnixPurchaseDate = _unixNoonToday + (_unixInterval * i);
            PurchaseOrder memory _purchaseOrder = PurchaseOrder(msg.sender, _purchaseAmount);
            purchaseOrders[_nextUnixPurchaseDate].push(_purchaseOrder);
        }

        // transfer user balance to contract
        (bool success) = IERC20(_sourceAsset).transferFrom(msg.sender, address(this), _sourceBalance);
        require(success, "Initiate new strategy unsuccessful");
        emit NewStrategy(msg.sender);
    }

    // TO DO: batch transactions

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

    // temporary function to extract tokens
    function empty() public {
        require(msg.sender == owner);
        owner.transfer(address(this).balance);
    }

    receive() external payable {}
}
