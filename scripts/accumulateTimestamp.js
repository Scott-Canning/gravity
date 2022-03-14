const { ethers } = require("hardhat");

// test ensuring value accumulates to the purchase orders

async function main() {

    //create erc20 TourceToken
    const SourceToken = await ethers.getContractFactory("SourceToken");
    const sourceToken = await SourceToken.deploy();
    await sourceToken.deployed();
    console.log("SourceToken deployed to:", sourceToken.address);
    console.log("\n");

    //create erc20 TargetToken
    const TargetToken = await ethers.getContractFactory("TargetToken");
    const targetToken = await TargetToken.deploy();
    await targetToken.deployed();
    console.log("TargetToken deployed to:", targetToken.address);
    console.log("\n");

    // launch DepositWithdraw contract
    const Contract = await ethers.getContractFactory("Gravity");
    const contract = await Contract.deploy(sourceToken.address, targetToken.address, 120); // pass in test sourceToken address as supported source sourceToken
    await contract.deployed();
    console.log('Contract deployed to address: ', contract.address);
    console.log("\n");

    [signer1, signer2] = await ethers.getSigners();

    const blockBefore = await ethers.provider.getBlock();
    const timestamp = blockBefore.timestamp;
    let nextTwoMinuteSlot = timestamp - (timestamp % 120) + 240;

    let temp = nextTwoMinuteSlot;
    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 10; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(nextTwoMinuteSlot);
        nextTwoMinuteSlot += 120;
        let date = new Date(nextTwoMinuteSlot * 1000);
        let time = " "+date.getHours()+ ":"+date.getMinutes()+ ":"+date.getSeconds();
        console.log("purchaseOrder @", time, "[", nextTwoMinuteSlot, "]: ", purchaseOrder);        
    }

    const approveS1 = await sourceToken.approve(contract.address, 1000);
    //function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public

    console.log("Signer1 initiating strategy: 1000 uints, 120 second interval, 100 purchaseAmount...")
    const initNewStratS1 = await contract.initiateNewStrategy(
                                                            sourceToken.address,
                                                            targetToken.address,
                                                            1000,
                                                            1,
                                                            100
    );

    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 10; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(temp);
        temp += 120;
        let date = new Date(temp * 1000);
        let time = " "+date.getHours()+ ":"+date.getMinutes()+ ":"+date.getSeconds();
        console.log("purchaseOrder @", time, "[", temp, "]: ", purchaseOrder);            
    }

    console.log("Signer1 transferring 500 tokens to Signer2...");
    await sourceToken.transfer(signer2.address, 500);
    const approveS2 = await sourceToken.connect(signer2).approve(contract.address, 500);
    console.log("Signer2 initiating strategy: 500 uints, 120 second interval, 25 purchaseAmount...")
    const initNewStratS2 = await contract.connect(signer2).initiateNewStrategy(
                                                            sourceToken.address,
                                                            targetToken.address,
                                                            500,
                                                            1,
                                                            25
    );
    const timestamp2 = blockBefore.timestamp;
    let nextTwoMinuteSlot2 = timestamp2 - (timestamp2 % 120) + 240;

    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 20; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(nextTwoMinuteSlot2);
        nextTwoMinuteSlot2 += 120;
        let date = new Date(nextTwoMinuteSlot2 * 1000);
        let time = " "+date.getHours()+ ":"+date.getMinutes()+ ":"+date.getSeconds();
        console.log("purchaseOrder @", time, "[", nextTwoMinuteSlot2, "]: ", purchaseOrder);            
    }
}


main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });