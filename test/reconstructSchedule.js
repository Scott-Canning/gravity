const { assert } = require("chai");
const { ethers } = require("hardhat"); // hardhat ethers plug-in

// NOTE: MUST COMMENT OUT LENDING/REDEEM FUNCTIONS

describe("reconstructSchedule()", function () {
    /// param configuration
    const upKeepInterval = 120;
    const depositAmount1 = 22000;
    const interval1 = 1;
    const purchaseAmount1 = 5000;
    /// param configuration

    let contract, purchaseSlot, sourceToken, targetToken, signer1;

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
        purchaseSlot = 0;

        // get signer and test sending the
        [signer1] = await ethers.getSigners();

    });

    it("Accumulated purchase orders should match reconstructed purchase schedule", async function () {
        // signer1 initiates strategy
        await sourceToken.approve(contract.address, depositAmount1);
        await contract.initiateNewStrategy(sourceToken.address,
                                            targetToken.address,
                                            depositAmount1,
                                            interval1,
                                            purchaseAmount1);

        const purchaseCount = Math.ceil(depositAmount1 / purchaseAmount1);

        let totalAccPO = 0;
        let totalRsPO = 0;
        
        const readSchedule = await contract.reconstructSchedule(signer1.address);
        const [ purchaseSlots, purchaseAmounts ] = readSchedule;
        // console.log(purchaseSlots, purchaseAmounts);

        for(let i = 0; i < purchaseCount; i++) {
            // compare purchaseSlots
            let rsPurchaseSlot = parseFloat(ethers.utils.formatUnits(purchaseSlots[i])) * 1e18;
            // console.log(rsPurchaseSlot, purchaseSlot);
            assert.equal(rsPurchaseSlot, purchaseSlot);

            // compare purchaseAmounts
            let accPO = await contract.connect(signer1).accumulatePurchaseOrders(purchaseSlot);
            let accPOformatted = ethers.utils.formatUnits(accPO) * 1e18;
            totalAccPO += accPOformatted;
            let rsPOs = ethers.utils.formatUnits(purchaseAmounts[i]) * 1e18;
            // console.log(rsPOs, accPO);
            totalRsPO += rsPOs;
            assert.equal(accPOformatted, rsPOs);

            // increment next slot
            purchaseSlot += 1;
        }
    
        assert.equal(totalAccPO, totalRsPO);
      });
});