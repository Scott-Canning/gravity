import { ethers } from 'ethers';
import './App.css';
import React from 'react';
import gravityJSON from './utils/gravity.json';
import linkJSON from './utils/link.json';

const gravityAddress = '0xF9E95c9b65D79565755B2d7c006913E1404bec8d';

// const DAI_KOVAN = '0xC4375B7De8af5a38a93548eb8453a498222C4fF2';
// const wETH_KOVAN = '0xd0A1E359811322d97991E03f863a0C30C2cF029C';
const LINK_KOVAN = '0xa36085F69e2889c224210F603D836748e7dC0088';

function App() {
  const [address, setAddress] = React.useState("");
  const [balance, setBalance] = React.useState("");
  const [depositAsset, setDepositAsset] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("");
  const [withdrawAsset, setWithdrawAsset] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");

  const { ethereum } = window;
  let provider;
  
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

  async function deposit() {
    const signer = await provider.getSigner();
    //left off here - do i need an ABI for LINK on Kovan to test?
    const tokenInstance = new ethers.Contract(LINK_KOVAN, linkJSON, signer);
    const approve = await tokenInstance.approve(gravityAddress, depositAmount);
    console.log("approve: ", approve);

    const contractInstance = new ethers.Contract(gravityAddress, gravityJSON.abi, signer);
    const deposit = await contractInstance.deposit(depositAsset, depositAmount, {gasLimit: 350000});
    console.log("deposit: ", deposit);
  }

  async function withdraw() {
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(gravityAddress, gravityJSON.abi, signer);
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
        <button className="deposit-button" onClick={deposit}> Deposit </button>
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
