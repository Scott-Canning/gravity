const { ethers } = require("hardhat");

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

    // get signers and test sending the
    [signer1, signer2] = await ethers.getSigners();

    // get balances
    let signer1Balance = await sourceToken.balanceOf(signer1.address);
    console.log("Signer1        : ",  signer1.address);
    console.log("Signer1 balance: ",  signer1Balance);
    console.log("\n");

    // signer1
    const depositAmount1 = 22000;
    const interval1 = 1;
    const purchaseAmount1 = 5000;

    // signer2
    const depositAmount2 = 30000;
    const interval2 = 1;
    const purchaseAmount2 = 5000;
    
    // signer1 approves
    await sourceToken.approve(contract.address, depositAmount1);
    console.log("Initiating new strategy S1...");
    console.log("   Deposit :          ", depositAmount1);
    console.log("   Interval:          ", interval1);
    console.log("   Purchase Amount:   ", purchaseAmount1);
    console.log("   RemainingPurchases:", Math.ceil(depositAmount1/purchaseAmount1));

    // signer1 initiates strategy
    const initNewStratS1 = await contract.initiateNewStrategy(sourceToken.address,
                                                            targetToken.address,
                                                            depositAmount1,
                                                            interval1,
                                                            purchaseAmount1);

    contractBalance = await sourceToken.balanceOf(contract.address);
    console.log("Contract sourceToken balance after S1 initNewStrategy: ",  contractBalance);

    // send signer2 tokens
    console.log("Transferring", depositAmount2," tokens to Signer2...");
    await sourceToken.transfer(signer2.address, depositAmount2);
    console.log("Updated balances after transfer...");
    signer1Balance = await sourceToken.balanceOf(signer1.address);
    console.log("Signer1 balance: ",  signer1Balance);
    signer2Balance = await sourceToken.balanceOf(signer2.address);
    console.log("Signer2 balance: ",  signer2Balance);
    console.log("\n");

    // signer2 approves
    await sourceToken.connect(signer2).approve(contract.address, depositAmount2);
    console.log("Initiating new strategy S2...");
    console.log("   Deposit :          ", depositAmount2);
    console.log("   Interval:          ", interval2);
    console.log("   Purchase Amount:   ", purchaseAmount2);
    console.log("   RemainingPurchases:", Math.ceil(depositAmount2/purchaseAmount2));

    // signer2 initiates strategy
    const initNewStratS2 = await contract.connect(signer2).initiateNewStrategy(sourceToken.address,
                                                              targetToken.address,
                                                              depositAmount2,
                                                              interval2,
                                                              purchaseAmount2);

    contractBalance = await sourceToken.balanceOf(contract.address);
    console.log("Contract sourceToken balance after S2 initNewStrategy: ",  contractBalance);

    const withdrawSrcAmount1 = 6000;
    console.log("Signer1 withdrawing source #1...");
    console.log("   Withdrawal amount :", withdrawSrcAmount1);
    const withdrawSource1 = await contract.connect(signer1).withdrawSource(sourceToken.address, withdrawSrcAmount1);
    contractBalance = await sourceToken.balanceOf(contract.address);
    console.log("Contract sourceToken balance post withdrawal: ",  contractBalance);
    console.log("\n");

    console.log("Read Signer1's schedule withdrawal1...");
    const readSchedule1 = await contract.reconstructSchedule(signer1.address);
    const [ timestamps1, purchaseAmounts1 ] = readSchedule1;
    console.log("timestamps: ", timestamps1);
    console.log("purchase amounts: ", purchaseAmounts1);
    console.log("\n");

    const withdrawSrcAmount2 = 1000;
    console.log("Signer1 withdrawing source #2...");
    console.log("   Withdrawal amount :", withdrawSrcAmount2);
    const withdrawSource2 = await contract.connect(signer1).withdrawSource(sourceToken.address, withdrawSrcAmount2);
    contractBalance = await sourceToken.balanceOf(contract.address);
    console.log("   Contract sourceToken balance post withdrawal: ",  contractBalance);
    console.log("\n");

    console.log("Read Signer1's schedule withdrawal2...");
    const readSchedule2 = await contract.reconstructSchedule(signer1.address);
    const [ timestamps2, purchaseAmounts2 ] = readSchedule2;
    console.log("   timestamps: ", timestamps2);
    console.log("   purchase amounts: ", purchaseAmounts2);
    console.log("\n");

    const withdrawSrcAmount3 = 15000;
    console.log("Signer1 withdrawing source #3...");
    console.log("   Withdrawal amount :", withdrawSrcAmount3);
    const withdrawSource3 = await contract.connect(signer1).withdrawSource(sourceToken.address, withdrawSrcAmount3);
    contractBalance = await sourceToken.balanceOf(contract.address);
    console.log("   Contract sourceToken balance post withdrawal: ",  contractBalance);
    console.log("\n");

    console.log("Read Signer1's schedule withdrawal3...");
    const readSchedule3 = await contract.reconstructSchedule(signer1.address);
    const [ timestamps3, purchaseAmounts3 ] = readSchedule3;
    console.log("   timestamps: ", timestamps3);
    console.log("   purchase amounts: ", purchaseAmounts3);
    console.log("\n");
}

main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });