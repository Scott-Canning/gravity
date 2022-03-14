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
  const contract = await Contract.deploy(sourceToken.address, targetToken.address); // pass in test sourceToken address as supported source sourceToken
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

  let signer2Balance = await sourceToken.balanceOf(signer2.address);
  console.log("Signer2        : ",  signer2.address);
  console.log("Signer2 balance: ",  signer2Balance);
  console.log("\n");

  console.log("Transferring 20 tokens to Signer2...");
  await sourceToken.transfer(signer2.address, 20);
  console.log("Updated balances after transfer...");
  signer1Balance = await sourceToken.balanceOf(signer1.address);
  console.log("Signer1 balance: ",  signer1Balance);
  signer2Balance = await sourceToken.balanceOf(signer2.address);
  console.log("Signer2 balance: ",  signer2Balance);
  console.log("\n");
  
  // signer 1 approves and allowance for the Contract to take the deposit
  const approve = await sourceToken.approve(contract.address, 1000);
  //const approve = await contract.approveDeposit(sourceToken.address, 11);
  //console.log('Approve: ', approve);

  const initNewStrat = await contract.initiateNewStrategy(sourceToken.address,
                                                          targetToken.address,
                                                          1000,
                                                          1,
                                                          100);
  console.log("Initiate new strategy (Signer1): ", initNewStrat);

  /*
  const allowance = await sourceToken.allowance(signer1.address, contract.address);
  console.log('Allowance: ', allowance);

  console.log("depositing 10 tokens into contract...");
  const deposit = await contract.depositSource(sourceToken.address, 10);

  let contractBalance = await sourceToken.balanceOf(contract.address);
  console.log("Contract balance: ",  contractBalance);

  console.log("withdrawing 5 tokens from contract...");
  const withdraw = await contract.withdrawSource(sourceToken.address, 5);
  */

  contractBalance = await sourceToken.balanceOf(contract.address);
  console.log("Contract balance: ",  contractBalance);
}

main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });