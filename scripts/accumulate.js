const { ethers } = require("hardhat");

// test ensuring value accumulates to the purchase orders

async function main() {


    // testing accumulation
    // for(uint i = 0; i < 3; i++) {
    //     purchaseOrders[i].push(PurchaseOrder(msg.sender, 1));
    //     purchaseOrders[i].push(PurchaseOrder(msg.sender, 1));
    // }

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
    const contract = await Contract.deploy(sourceToken.address, targetToken.address, 30); // pass in test sourceToken address as supported source sourceToken
    await contract.deployed();
    console.log('Contract deployed to address: ', contract.address);
    console.log("\n");

    [signer1, signer2] = await ethers.getSigners();

    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 10; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(i);
        console.log("purchaseOrder", i, ": ", purchaseOrder);        
    }
    const approveS1 = await sourceToken.approve(contract.address, 1000);
    //function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public

    console.log("Signer1 initiating strategy...")
    const initNewStratS1 = await contract.initiateNewStrategy(
                                                            sourceToken.address,
                                                            targetToken.address,
                                                            1000,
                                                            1,
                                                            100
    );

    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 10; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(i);
        console.log("purchaseOrder", i, ": ", purchaseOrder);        
    }

    console.log("Signer1 transferring 500 tokens to Signer2...");
    await sourceToken.transfer(signer2.address, 500);
    const approveS2 = await sourceToken.connect(signer2).approve(contract.address, 500);
    console.log("Signer2 initiating strategy...")
    const initNewStratS2 = await contract.connect(signer2).initiateNewStrategy(
                                                            sourceToken.address,
                                                            targetToken.address,
                                                            500,
                                                            1,
                                                            25
    );

    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 20; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(i);
        console.log("purchaseOrder", i, ": ", purchaseOrder);        
    }
}


main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });