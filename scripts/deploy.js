const hre = require("hardhat");
const { ethers } = require('ethers');
require('dotenv').config();

const sourceToken = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'; // DAI
const targetToken = '0xd0A1E359811322d97991E03f863a0C30C2cF029C'; // WETH

async function deploy() {
  const url = process.env.KOVAN_URL;
  const provider = new ethers.providers.JsonRpcProvider(url);

  let privateKey = process.env.PRIVATE_KEY;
  let wallet = new ethers.Wallet(privateKey, provider);

  let artifacts = await hre.artifacts.readArtifact("Gravity");
  let factory = new ethers.ContractFactory(artifacts.abi, artifacts.bytecode, wallet);
  let contract = await factory.deploy(sourceToken, targetToken, 120); // 30 is to test initial integration

  console.log("Contract address:", contract.address);
  await contract.deployed();
}

deploy()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
