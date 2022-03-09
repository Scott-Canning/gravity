const hre = require("hardhat");
const { ethers } = require('ethers');
require('dotenv').config();

const sourceToken = '0xC4375B7De8af5a38a93548eb8453a498222C4fF2'; // DAI
const targetToken = '0xd0A1E359811322d97991E03f863a0C30C2cF029C'; // WETH

async function deploy() {
  const url = process.env.KOVAN_URL;
  const provider = new ethers.providers.JsonRpcProvider(url);

  let privateKey = process.env.PRIVATE_KEY;
  let wallet = new ethers.Wallet(privateKey, provider);

  let artifacts = await hre.artifacts.readArtifact("Gravity");
  let factory = new ethers.ContractFactory(artifacts.abi, artifacts.bytecode, wallet);
  let contract = await factory.deploy(sourceToken, targetToken);

  console.log("Contract address:", contract.address);
  await contract.deployed();
}

deploy()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});
