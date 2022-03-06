require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config({path:__dirname+'/.env'})

module.exports = {
  solidity: "0.7.0",
  paths: {
    artifacts: "./app/artifacts",
  },
  defaultNetwork: "kovan", 
  networks: {
    hardhat: {
    },
    kovan: {
      url: process.env.KOVAN_URL,
      accounts: [process.env.KOVAN_KEY],
    },
  },
  etherscan: {
    apiKey: {
      kovan: process.env.ETHERSCAN_KEY
    }
  },
};