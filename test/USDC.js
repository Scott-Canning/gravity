const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("USDCToken", function () {
  let deployer;
  let usdcToken;

  const initialSupply = ethers.utils.parseUnits("1000", 18);

  before(async function () {
    [deployer] = await ethers.getSigners();

    const USDCToken = await ethers.getContractFactory("USDCToken");
    usdcToken = await USDCToken.deploy(initialSupply);

    await usdcToken.deployed();
  });

  it("should have minted initial supply to the deployer with initial allowance", async function () {
    const deployerBalance = await usdcToken.balanceOf(deployer.address);

    console.log(`deployerBalance = ${ethers.utils.formatUnits(deployerBalance, 18)}`);

    expect(deployerBalance).to.equal(initialSupply);
  });
});
