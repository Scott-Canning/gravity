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

    [signer1] = await ethers.getSigners();

    const blockBefore = await ethers.provider.getBlock();
    const timestamp = blockBefore.timestamp;
    let nextTwoMinuteSlot = timestamp - (timestamp % 120) + 240;

    let temp = nextTwoMinuteSlot;
    console.log("Accumulated purchase orders...");
    for(let i = 0; i < 10; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(nextTwoMinuteSlot);
        let date = new Date(nextTwoMinuteSlot * 1000);
        let time = " "+date.getHours()+ ":"+date.getMinutes()+ ":"+date.getSeconds();
        console.log("purchaseOrder @", time, "[", nextTwoMinuteSlot, "]: ", purchaseOrder);
        nextTwoMinuteSlot += 120;
    }

    await sourceToken.approve(contract.address, 1050);

    //function initiateNewStrategy(address _sourceAsset, address _targetAsset, uint _sourceBalance, uint _interval, uint _purchaseAmount) public
    console.log("Signer1 initiating strategy: 1000 uints, 120 second interval, 100 purchaseAmount...")
    await contract.initiateNewStrategy(
                                        sourceToken.address,
                                        targetToken.address,
                                        1050,
                                        1,
                                        100
    );

    console.log("Accumulated purchase orders...");
    for(let i = 0; i <= 11; i++){
        let purchaseOrder = await contract.accumulatePurchaseOrders(temp);
        let date = new Date(temp * 1000);
        let time = " "+date.getHours()+ ":"+date.getMinutes()+ ":"+date.getSeconds();
        console.log("purchaseOrder @", time, "[", temp, "]: ", purchaseOrder);
        temp += 120;            
    }

    console.log("Read Signer1's deployment schedule...");
    const readSchedule = await contract.reconstructSchedule(signer1.address);
    const [ timestamps, purchaseAmounts ] = readSchedule;
    console.log("timestamps: ", timestamps);
    console.log("\n");
    console.log("purchase amounts: ", purchaseAmounts);

}


main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });