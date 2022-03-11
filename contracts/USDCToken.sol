//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCToken is ERC20 {
  constructor(uint initialSupply) ERC20("USDCToken", "USDC") {
    _mint(msg.sender, initialSupply);
  }
}