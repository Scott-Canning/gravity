const { ethers } = require("hardhat");

async function main() {

  // create erc20 token
  const Token = await ethers.getContractFactory("Jupiter");
  const token = await Token.deploy();
  await token.deployed();
  console.log("Token deployed to:", token.address);
  
  // get signers and test sending the
  [signer1, signer2] = await ethers.getSigners();
  let ownerBalance = await token.balanceOf(signer1.address);
  console.log("Signer1        : ",  signer1.address);
  console.log("Signer1 balance: ",  ownerBalance);
  console.log("Signer2        : ",  signer2.address);
  console.log("Transferring 20 tokens to Signer2...");
  await token.transfer(signer2.address, 20);
  const signer2balance = await token.balanceOf(signer2.address);
  console.log("Signer2 balance: ",  signer2balance);
  ownerBalance = await token.balanceOf(signer1.address);
  console.log("Signer1 balance: ",  ownerBalance);
  console.log("\n");
  

  // launch contract
  const Contract = await ethers.getContractFactory("DepositWithdraw");
  const contract = await Contract.deploy();
  await contract.deployed();
  console.log('Contract deployed to address: ', contract.address);

  // signer 1 approves and allowance for the Contract to take the deposit
  const approve = await token.approve(contract.address, 11);
  //const approve = await contract.approveDeposit(token.address, 11);
  console.log('Approve: ', approve);

  const allowance = await token.allowance(signer1.address, contract.address);
  console.log('Allowance: ', allowance);


  const deposit = await contract.deposit(token.address, 10);
  console.log('Deposit: ', deposit);
  contract.on("Deposited", (_address, _uint256) =>  {
    console.log("Deposited: ", _address, _uint256);
  })
  const contractBalance = await token.balanceOf(contract.address);
  console.log("Contract balance: ",  contractBalance);

}

main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });