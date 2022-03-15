const { expect } = require("chai");
const { time } = require("console");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { BlockList } = require("net");
const { hrtime } = require("process");

describe("GravityTrader", function () {
  let deployer, usdcTokenOwner, usdcTokenOwner1,linkTokenOwner;
  const swapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

  let usdcToken;
  let linkToken;

  let gravityTrader;

  const initialSupply = ethers.utils.parseUnits("1000", 18);
  const purchaseAmount = ethers.utils.parseUnits("100", 18);

  const pollingInterval = 120;

  beforeEach(async function () {
    [deployer, usdcTokenOwner, usdcTokenOwner1,linkTokenOwner] = await ethers.getSigners();

    let USDCToken = await ethers.getContractFactory("USDCToken", usdcTokenOwner);
    usdcToken = await USDCToken.deploy(initialSupply.mul(2));

    await usdcToken.deployed();

    // move half of initial supply to usdcTokenOwner1

    depositusdcTxn = await usdcToken.transfer(usdcTokenOwner1.address,initialSupply);
    await depositusdcTxn.wait();

    console.log("usdcTokenOwner",usdcTokenOwner.address);
    console.log("usdcTokenOwner1",usdcTokenOwner1.address);
    console.log("linkTokenOwner",linkTokenOwner.address);

  });

  beforeEach(async function () {
    [deployer, usdcTokenOwner, usdcTokenOwner1,linkTokenOwner] = await ethers.getSigners();

    const LINKToken = await ethers.getContractFactory("LINKToken", linkTokenOwner);
    linkToken = await LINKToken.deploy(initialSupply);

    await linkToken.deployed();
    
  });

  beforeEach(async function () {
    const GravityTrader = await ethers.getContractFactory("Gravity");
    gravityTrader = await GravityTrader.deploy(usdcToken.address,linkToken.address,pollingInterval);

    await gravityTrader.deployed();

    console.log("usdcToken.address",usdcToken.address);
    console.log("linkToken.address",linkToken.address);
    console.log("gravityTrader.address",gravityTrader.address);

    //gravityTrader.addNewToken("USDCT",usdcToken.address);
    //gravityTrader.addNewToken("LINKT",linkToken.address);
  });

  it.only("deposits erc20 token", async function () {
    
    await printBalances('before deposits');

    // Test case for 1st initiate strategy of sourcebalance=1000,purchaseamount=100,interval=1
    let totalSourceBalance = 0;
    gravityTrader = await gravityTrader.connect(usdcTokenOwner);
    let approveTxn = await usdcToken.approve(gravityTrader.address, initialSupply);
    await approveTxn.wait();

    console.log("After 1st approved",await usdcToken.allowance(usdcTokenOwner.address,gravityTrader.address));

    let depositusdcTxn = await gravityTrader.initiateNewStrategy(usdcToken.address,linkToken.address,initialSupply,1,purchaseAmount);
    await depositusdcTxn.wait();

    await printBalances("after 1st initial strategy of user usdcTokenOwner");

    let usdcTokenOwnerBalance = await usdcToken.balanceOf(usdcTokenOwner.address);
    let gravityTraderBalance = await usdcToken.balanceOf(gravityTrader.address);
    let accounts = await gravityTrader.accounts(usdcTokenOwner.address);

    let expectedPurchasesRemaining;
    if ((accounts.purchaseAmount * accounts.purchasesRemaining) > accounts.sourceBalance)
      expectedPurchasesRemaining = Math.floor(accounts.sourceBalance/accounts.purchaseAmount) + 1;
    else 
      expectedPurchasesRemaining = Math.floor(accounts.sourceBalance/accounts.purchaseAmount);

    expect(usdcTokenOwnerBalance).to.equal(ethers.BigNumber.from("0"));
    expect(gravityTraderBalance).to.equal(initialSupply);
    expect(accounts.accountStart).to.not.equal(ethers.BigNumber.from("0"));
    expect(accounts.sourceAsset).to.equal(usdcToken.address);
    expect(accounts.targetAsset).to.equal(linkToken.address);
    expect(accounts.targetBalance).to.equal(ethers.BigNumber.from("0"));
    expect(expectedPurchasesRemaining).to.equal(accounts.purchasesRemaining);
    totalSourceBalance = accounts.sourceBalance.add(totalSourceBalance);

    // Test case for 2nd initiate strategy of sourcebalance=1000,purchaseamount=90,interval=1
    // for this strategy, we will use  usdcTokenOwner1 (another owner having usdc asset)  
    gravityTrader = await gravityTrader.connect(usdcTokenOwner1); // connect to gravity as new user
    usdcToken = await usdcToken.connect(usdcTokenOwner1); //connect to usdc token as new user to approve
    
    approveTxn = await usdcToken.approve(gravityTrader.address, initialSupply);
    await approveTxn.wait();

    depositusdcTxn = await gravityTrader.initiateNewStrategy(usdcToken.address,linkToken.address,initialSupply,7,purchaseAmount);
    await depositusdcTxn.wait();

    await printBalances("after 1st initial strategy of user usdcTokenOwner1");

    usdcTokenOwner1Balance = await usdcToken.balanceOf(usdcTokenOwner1.address);
    gravityTraderBalance = await usdcToken.balanceOf(gravityTrader.address);
    accounts = await gravityTrader.accounts(usdcTokenOwner1.address);
        
    if ((accounts.purchaseAmount * accounts.purchasesRemaining) > accounts.sourceBalance)
      expectedPurchasesRemaining = Math.floor(accounts.sourceBalance/accounts.purchaseAmount) + 1;
    else 
      expectedPurchasesRemaining = Math.floor(accounts.sourceBalance/accounts.purchaseAmount);

      expect(usdcTokenOwner1Balance).to.equal(ethers.BigNumber.from("0"));
      expect(gravityTraderBalance).to.equal(initialSupply.mul(2));
      expect(accounts.accountStart).to.not.equal(ethers.BigNumber.from("0"));
      expect(accounts.sourceAsset).to.equal(usdcToken.address);
      expect(accounts.targetAsset).to.equal(linkToken.address);
      expect(accounts.targetBalance).to.equal(ethers.BigNumber.from("0"));
      expect(expectedPurchasesRemaining).to.equal(accounts.purchasesRemaining);

      totalSourceBalance = accounts.sourceBalance.add(totalSourceBalance);
      
      // test if purchase order mapping is populated correctly
      // loop for maximum of days to iterate and in this case it is strategy no. 2
      // purchase order for strategy 1 will also be added to total
      console.log("Purchase Order will be accumulated over",accounts.interval*accounts.purchasesRemaining,"days");
      let intervalPOamount = 0;
      let accountStart = accounts.accountStart;
      let nextSlot = accountStart - (accountStart % pollingInterval)+2*pollingInterval;
      let unixInterval = pollingInterval;
      for (let i=1;i<=accounts.purchasesRemaining*accounts.interval;i++){
        let nextPurchaseSlot = nextSlot + (unixInterval*i);
        ethers.provider.send("evm_increaseTime",[pollingInterval]);
        ethers.provider.send("evm_mine");

        //let now =(await ethers.provider.getBlock("latest")).timestamp;
        
        console.log(nextPurchaseSlot);
        console.log(intervalPOamount);
        intervalPOamount = (await gravityTrader.accumulatePurchaseOrders(nextPurchaseSlot)).add(intervalPOamount);
      }
      console.log("Total Purchase Amount for all initiate strategies",intervalPOamount);

      expect(intervalPOamount).to.equal(totalSourceBalance);
  });

 /* it("initiates strategies by depositing token and withdraws erc20 target token", async function () {
    await printBalances('before deposits');
    //Deposit test case start=======================================
    gravityTrader = await gravityTrader.connect(usdcTokenOwner);
    const approveusdcTxn = await usdcToken.approve(gravityTrader.address, initialSupply);
    await approveusdcTxn.wait();
    const depositusdcTxn = await gravityTrader.initiateNewStrategy(usdcToken.address,linkToken.address,initialSupply,7,purchaseAmount);
    await depositusdcTxn.wait();
    gravityTrader = await gravityTrader.connect(linkTokenOwner);
    const approvelinkTxn = await linkToken.approve(gravityTrader.address, initialSupply);
    await approvelinkTxn.wait();    
    // Added this deposit to make sure Gravity Contract has enough link tokens for withdrawal 
    const depositLinkTxn = await gravityTrader.initiateNewStrategy(linkToken.address,usdcToken.address,initialSupply,7,purchaseAmount);
    await depositLinkTxn.wait();
    await printBalances("after deposits");
    //Deposit test case end======================
    // Withdrawal Test Cases
    gravityTrader = await gravityTrader.connect(usdcTokenOwner); // Connect as usdcTokenOwner and withdraw from Gravity Contract
    
    const usdcwithdrawTxn = await gravityTrader.withdraw();
    await usdcwithdrawTxn.wait();
    let usdcTokenOwnerBalance = await usdcToken.balanceOf(usdcTokenOwner.address);
    let gravityTraderBalance = await usdcToken.balanceOf(gravityTrader.address);
    await printBalances("after withdrawals of no investment strategy");
    expect(usdcTokenOwnerBalance).to.equal(initialSupply);
    expect(gravityTraderBalance).to.equal(ethers.BigNumber.from("0"));
  });*/

  /*it("swaps with counterparty", async function () {
    gravityTrader = await gravityTrader.connect(usdcTokenOwner);
    await printBalances("before deposits");
    // 1. approve contract to spend MunchinToken on user's behalf
    let approveTxn = await munchinToken.approve(gravityTrader.address, initialSupply);
    await approveTxn.wait();
    // 2. deposit MunchinToken to contract
    const depositTxn = await gravityTrader.initiateNewStrategy('USDCT','LINKT',initialSupply,intervalAmount,'Daily');
    await depositTxn.wait();
    trustlessTrader = await trustlessTrader.connect(bengalTokenOwner);
    // 1. approve contract to spend BengalToken on user's behalf
    approveTxn = await bengalToken.approve(trustlessTrader.address, initialSupply);
    await approveTxn.wait();
    // 2. deposit BengalToken to contract
    depositTxn = await trustlessTrader.deposit(bengalToken.address, initialSupply);
    await depositTxn.wait();
    await printBalances("after deposits");
    // 3. perform trustlessTrader.tradeWith()
    trustlessTrader = await trustlessTrader.connect(munchinTokenOwner);
    const swapWithTxn = await trustlessTrader.tradeWith(bengalTokenOwner.address);
    await swapWithTxn.wait();
    await printBalances('after tradeWith()');
  });*/

  async function printBalances(msg) {
    usdcTokenOwnerUSDCBalance = await usdcToken.balanceOf(usdcTokenOwner.address);
    usdcTokenOwner1USDCBalance = await usdcToken.balanceOf(usdcTokenOwner1.address);
    linkTokenOwnerUSDCBalance = await usdcToken.balanceOf(linkTokenOwner.address);
    gravityTraderUSDCBalance = await usdcToken.balanceOf(gravityTrader.address);

    usdcTokenOwnerlinkBalance = await linkToken.balanceOf(usdcTokenOwner.address);
    usdcTokenOwner1linkBalance = await linkToken.balanceOf(usdcTokenOwner1.address);
    linkTokenOwnerlinkBalance = await linkToken.balanceOf(linkTokenOwner.address);
    gravityTraderlinkBalance = await linkToken.balanceOf(gravityTrader.address);

    console.log(`--------------------------------------------------`);
    console.log(`USDCToken Balances ${msg}`);
    console.log(`    usdcTokenOwner = ${ethers.utils.formatUnits(usdcTokenOwnerUSDCBalance, 18)}`);
    console.log(`    usdcTokenOwner1 = ${ethers.utils.formatUnits(usdcTokenOwner1USDCBalance, 18)}`);
    console.log(`    linkTokenOwner = ${ethers.utils.formatUnits(linkTokenOwnerUSDCBalance, 18)}`);
    console.log(`    GravityTraderContract = ${ethers.utils.formatUnits(gravityTraderUSDCBalance, 18)}`);

    console.log(`--------------------------------------------------`);
    console.log(`LINKToken Balances ${msg}`);
    console.log(`    usdcTokenOwner = ${ethers.utils.formatUnits(usdcTokenOwnerlinkBalance, 18)}`);
    console.log(`    usdcTokenOwner1 = ${ethers.utils.formatUnits(usdcTokenOwner1linkBalance, 18)}`);
    console.log(`    linkTokenOwner = ${ethers.utils.formatUnits(linkTokenOwnerlinkBalance, 18)}`);
    console.log(`    GravityTraderContract = ${ethers.utils.formatUnits(gravityTraderlinkBalance, 18)}`);
  }
});