const { assert } = require("chai");
const { ethers } = require("hardhat"); // hardhat ethers plug-in

// NOTE: MUST COMMENT OUT LENDING/REDEEM FUNCTIONS

function checkUpkeep(now, ) {


}


function performUpkeep() {


}

describe("simulateUpkeep", function () {
    /// param configuration
    const upKeepInterval = 120;
    // signer1
    const depositAmount1 = 22000;
    const interval1 = 1;
    const purchaseAmount1 = 5000;

    // signer2
    const depositAmount2 = 30000;
    const interval2 = 1;
    const purchaseAmount2 = 5000;

    let contract, sourceToken, targetToken, signer1, signer2;

    before("deploy testing tokens and contract", async function () { 
        // create erc20 sourceToken
        const SourceToken = await ethers.getContractFactory("SourceToken");
        sourceToken = await SourceToken.deploy();
        await sourceToken.deployed();

        // create erc20 targetToken
        const TargetToken = await ethers.getContractFactory("TargetToken");
        targetToken = await TargetToken.deploy();
        await targetToken.deployed();

        // deploy gravity contract instance
        const Gravity = await ethers.getContractFactory("Gravity");
        contract = await Gravity.deploy(sourceToken.address, targetToken.address, upKeepInterval); // pass in test sourceToken address as supported source sourceToken
        await contract.deployed();

        // get signers and test sending the
        [signer1, signer2] = await ethers.getSigners();

        // split sourceToken
        const transferAmount1 = ethers.utils.parseUnits("25", 18);
        await sourceToken.transfer(signer2.address, transferAmount1);
    });

    it("Reconstruct schedule should properly reflect remaining balances after performUpkeep executes", async function () {
        // signer1 initiates strategy
        await sourceToken.approve(contract.address, depositAmount1);
        await contract.initiateNewStrategy(sourceToken.address,
                                            targetToken.address,
                                            depositAmount1,
                                            interval1,
                                            purchaseAmount1);

        // signer2 initiates strategy
        await sourceToken.connect(signer2).approve(contract.address, depositAmount2);
        await contract.connect(signer2).initiateNewStrategy(sourceToken.address,
                                                            targetToken.address,
                                                            depositAmount2,
                                                            interval2,
                                                            purchaseAmount2);




        });
});