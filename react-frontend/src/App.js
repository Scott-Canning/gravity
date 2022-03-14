import { ethers } from 'ethers';
import './App.css';
import React from 'react';
import gravityJSON from './utils/gravity.json';
import daiJSON from './utils/dai.json';

const gravityAddress = '0xbc0118491e7205BC6b8CF27284e8c31469fA0f7E';
const DAI_KOVAN = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa';
const WETH_KOVAN = '0xd0A1E359811322d97991E03f863a0C30C2cF029C';
//const LINK_KOVAN = '0xa36085F69e2889c224210F603D836748e7dC0088';

function App() {
  const [address, setAddress] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [depositAsset, setDepositAsset] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [withdrawAsset, setWithdrawAsset] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");

  const { ethereum } = window;
  let provider;

  const tokenAddresses = {};
  tokenAddresses['DAI'] = DAI_KOVAN;
  tokenAddresses['ETH'] = WETH_KOVAN;

  const contractJSONs = {};
  contractJSONs['DAI'] = daiJSON;
  
  if(ethereum) {
    ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.providers.Web3Provider(ethereum);
    displayUserDetails();
  } else {
    console.log("Please install MetaMask!");
  }

  async function displayUserDetails() {
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    const userBalance = await provider.getBalance(userAddress);
    setAddress(userAddress);
    setBalance(ethers.utils.formatEther(userBalance));
  }

  async function initiateNewStrategy() {
    const signer = await provider.getSigner();
    const tokenInstance = new ethers.Contract(tokenAddresses[depositAsset], contractJSONs[depositAsset], signer);
    console.log("tokenInstance address:", tokenAddresses[depositAsset]);
    const approve = await tokenInstance.approve(gravityAddress, depositAmount);
    console.log("approve: ", approve);

    const contractInstance = new ethers.Contract(gravityAddress, gravityJSON, signer);


    const initStrategy = await contractInstance.initiateNewStrategy(tokenAddresses[depositAsset], 
                                                                    tokenAddresses['ETH'], 
                                                                    depositAmount, 
                                                                    1,
                                                                    purchaseAmount,
                                                                    {gasLimit: 1500000}); //30000000
    console.log("initiateNewStrategy: ", initStrategy);
    console.log("source asset address:", tokenAddresses[depositAsset]);
  }

  async function withdraw() {
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(gravityAddress, gravityJSON, signer);
    const withdraw = await contractInstance.withdraw(withdrawAsset, withdrawAmount, {gasLimit: 350000});
    console.log("deposit: ", withdraw);
  }

  return (
    <div className="App">
      <div className="title">
        Gravity [Kovan]
      </div>
      <div className="user-info">
        <p>
          <b>Contract address:</b> {gravityAddress}
        </p>
        <p>
          <b>Your address:</b> {address}
        </p>
        <p>
          <b>Your balance:</b> {balance}
        </p>
      </div>
      <p>
        <label> Deposit Asset: </label>
        <input className="deposit-input" value={depositAsset} onInput={e => setDepositAsset(e.target.value)}/>
        <label> Deposit Amount: </label>
        <input className="deposit-input" value={depositAmount} onInput={e => setDepositAmount(e.target.value)}/>
        <label> Purchase Amount: </label>
        <input className="deposit-input" value={purchaseAmount} onInput={e => setPurchaseAmount(e.target.value)}/>
        <button className="deposit-button" onClick={initiateNewStrategy}> initiateNewStrategy </button>
      </p>
      <p>
        <label> Withdraw Asset: </label>
        <input className="withdraw-input" value={withdrawAsset} onInput={e => setWithdrawAsset(e.target.value)}/>
        <label> Withdraw Amount: </label>
        <input className="withdraw-input" value={withdrawAmount} onInput={e => setWithdrawAmount(e.target.value)}/>
        <button className="withdraw-button" onClick={withdraw}> Withdraw </button>
      </p>
    </div>
  );
}

export default App;
