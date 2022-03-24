const { assert } = require("chai");
const { ethers } = require("hardhat"); // hardhat ethers plug-in

// NOTE: MUST COMMENT OUT LENDING/REDEEM FUNCTIONS

describe("withdrawSource()", function () {
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

    // withdrawal amounts
    const withdrawSrcAmount1 = 6000;
    const withdrawSrcAmount2 = 1000;
    const withdrawSrcAmount3 = 15000;

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

    it("Contract balance should update in-line with withdrawals", async function () {
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

        const contractBalance1 = await sourceToken.balanceOf(contract.address);

        const totalDeposits = depositAmount1 + depositAmount2;
        assert.equal(contractBalance1, totalDeposits);

        // withdraw1
        await contract.connect(signer1).withdrawSource(sourceToken.address, withdrawSrcAmount1);
        const contractBalance2 = await sourceToken.balanceOf(contract.address);
        assert.equal(contractBalance1 - withdrawSrcAmount1, contractBalance2);

        // assert purchases remaining are equivalent after withdraw1
        const readSchedule1 = await contract.reconstructSchedule(signer1.address);
        const [ purchaseSlots1, purchaseAmounts1 ] = readSchedule1;
        const purchaseCount1 = Math.ceil((depositAmount1 - withdrawSrcAmount1 ) / purchaseAmount1);
        assert.equal(purchaseSlots1.length, purchaseCount1);

 
        // withdraw2
        await contract.connect(signer1).withdrawSource(sourceToken.address, withdrawSrcAmount2);
        const contractBalance3 = await sourceToken.balanceOf(contract.address);
        assert.equal(contractBalance2 - withdrawSrcAmount2, contractBalance3);

        // assert purchases remaining are equivalent after withdraw2
        const readSchedule2 = await contract.reconstructSchedule(signer1.address);
        const [ purchaseSlots2, purchaseAmounts2 ] = readSchedule2;
        const purchaseCount2 = Math.ceil((depositAmount1 - (withdrawSrcAmount1 + 
                                                            withdrawSrcAmount2)) / purchaseAmount1);
        assert.equal(purchaseSlots2.length, purchaseCount2);


        // withdraw3
        await contract.connect(signer1).withdrawSource(sourceToken.address, withdrawSrcAmount3);
        const contractBalance4 = await sourceToken.balanceOf(contract.address);
        assert.equal(contractBalance3 - withdrawSrcAmount3, contractBalance4);

        // assert purchases remaining are equivalent after withdraw3
        const readSchedule3 = await contract.reconstructSchedule(signer1.address);
        const [ purchaseSlots3, purchaseAmounts3 ] = readSchedule3;
        const purchaseCount3 = Math.ceil((depositAmount1 - (withdrawSrcAmount1 + 
                                                            withdrawSrcAmount2 + 
                                                            withdrawSrcAmount3)) / purchaseAmount1);
        assert.equal(purchaseSlots3.length, purchaseCount3);
    });
});