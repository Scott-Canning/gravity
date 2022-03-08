//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@chainlink/contracts/src/v0.7/KeeperCompatible.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom( address from, address to, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Gravity is ERC20, KeeperCompatibleInterface {
    uint strategyCount;
    uint tradeAmount;
    bool tradeExecuted;

    enum IntervalFrquency { Daily, Weekly, Monthly, Quaterly, HalfYearly } // Deepak: More descriptive intervals
    // sourceAsset, targetAsset enum
    enum AssetType { DAI, USDC, wETH, wBTC }

    // user address to user Account policy mapping
    mapping (address => Account[]) public accounts;
    // timestamp interval to PurchaseOrder mapping
    mapping (uint => PurchaseOrder[]) public liveStrategies;
    // ERC20 token address mapping
    mapping (AssetType => address) public tokenAddresses;

    constructor() {
        // load asset addresses into tokenAddress mapping
        tokenAddresses[AssetType.DAI] = '0xC4375B7De8af5a38a93548eb8453a498222C4fF2';
        tokenAddresses[AssetType.wETH] = '0xd0A1E359811322d97991E03f863a0C30C2cF029C';
        // tokenAddresses[AssetType.USDC] = ;
        // tokenAddresses[AssetType.wBTC] = ;
    }

    event Deposited(address, uint256);
    event Withdrawn(address, uint256);

    // data structure for each account policy
    struct Account {
        uint             accountId;
        uint             accountStart;
        AssetType        sourceAsset;
        AssetType        targetAsset;
        uint             sourceBalance;
        uint             targetBalance;
        uint             intervalAmount;
        IntervalFrquency strategyFrequency;   // number of interval days, minimum will be 1 day and max yearly;         // timestamp offset
    }

    // purchase order details for a user & account policy at a specific interval
    struct PurchaseOrder {
        address user;
        uint    accountId;
        uint    purchaseAmount;
    }

    // function to remove prior days array value from liveStrategies
    function deleteKV(uint _timestamp) internal {
        delete liveStrategies[timestamp];
    }

    // constant time function to remove users with 0 daiBalance, decrement dailyPoolUserCount
    function removePurchaseOrder(uint _index) internal {
        require(index < liveStrategies.length, "Index out of range");
        liveStrategies[_index] = liveStrategies[liveStrategies.length - 1];
        liveStrategies.pop();
    }

    // function initiateNewStrategy() {
        // Validate inputs for accounts
        // Populate account
        // Populate Strategy
    // }

    // deposit first requires approving an allowance by the msg.sender
    // e.g.: const approve = await erc20token.approve(Gravity.address, _amount);

    function deposit(AssetType _sourceAsset, uint256 _amount) external {
        require(_amount > 0, "Insufficient value");
        address _token = tokenAddresses[_sourceAsset];
        require(_token == 0, "Unsupported asset type");
        balances[msg.sender] += _amount;
        (bool success) = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Deposit unsuccessful: transferFrom");
        emit Deposited(msg.sender, _amount);
    }

    // contract needs to inherit ERC20
    function withdrawSource(uint _accountId, AssetType _sourceAsset, uint _amount) external payable {
        // find user account that matches provide _accountId
        // (front-end can handle querying account <-> accountId <-> AssetType)
        uint _id;
        for(uint i = 0; i < accounts[msg.sender]; i++) {
            if(accounts[msg.sender][i] == _accountId) {
                id = _accoundId
            }
        }
        // require AssetType withdraw to equal 
        require(_sourceAsset == accounts[msg.sender][_id].sourceAsset);
        if(accounts[msg.sender].sourceBalance >= _amount) {
            address _token = tokenAddresses[_sourceAsset];
            (bool success) = IERC20(_token).transfer(msg.sender, _amount);
            require(success, "Withdraw unsuccessful");
            emit Withdrawn(msg.sender, _amount);

        } else if ()
        
    }

    // function withdrawTarget() {

    // }


    /*
        TO DO: inherit Chainlink Keepers contract functionality
    */
    function checkUpkeep(bytes calldata /* checkData */) external override returns (bool upkeepNeeded, bytes memory /* performData */) {
        require(tradeExecuted == false);
        upkeepNeeded = (block.timestamp % 24 * 60 * 60 == 0);
        // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
    }

    // performs the work on the contract, if instructed by checkUpkeep().
    function performUpkeep(bytes calldata /* performData */) external override {
        //We highly recommend revalidating the upkeep in the performUpkeep function
        // We don't use the performData in this example. The performData is generated by the Keeper's call to your checkUpkeep function
    }

    // keeper performUpkeep function executes batchTransaction once per day
    function batchTransaction() external payable {

        // daily range to check whether user has purchase to be made today
        uint today = block.timestamp;
        uint todayStart = today - (12 * 60 * 60);
        uint todayEnd = today + (12 * 60 * 60); 

        // loop over liveStrategies
        for(uint i = 0; i < strategyCount; i++) {
            uint userNextPurchase = liveStrategies[i].initStrategy + (liveStrategies[i].purchaseFrequency * 24 * 60 * 60);

            // if user still has purchasesRemaining continue
            if(liveStrategies[i].purchasesRemaining > 0) {

                // if users next purchase falls within today
                if(userNextPurchase > todayStart && userNextPurchase < todayEnd) {

                    // check balance is above user's purchase amount
                    if(accounts[liveStrategies[i].user].daiBalance > liveStrategies[i].purchaseAmount) {

                        // decrement user's daiBalance
                        accounts[liveStrategies[i].user].daiBalance - liveStrategies[i].purchaseAmount;

                        // decrement user's purchasesRemaining;
                        liveStrategies[i].purchasesRemaining -= 1;

                        // increment daiDailyPurchase for today
                        daiDailyPurchase += liveStrategies[i].purchaseAmount;
                    }
                }
            }
            else { // purchasesRemaining == 0; remove from liveStrategies array 
                removeStrategy(i);
            }
        }
        require(daiDailyPurchase > 0, "DA daily purchase insufficient");
        
        /*
            TO DO: integrate executeTrade() function
        */

        /*
            TO DO: run allocate function to update user ETH balances
        */

    }


    /*
        TO DO: yield function/treasury allocation 
    */
}