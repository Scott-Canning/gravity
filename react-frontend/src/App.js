import { ethers } from 'ethers';
import './App.css';
import React from 'react';
import gravityJSON from './utils/gravity.json';
import daiJSON from './utils/dai.json';
import linkJSON from './utils/link.json';

const gravityAddress = '0x5C1Ede612Cbd50cE32dDB899b615823D1F75D0c0';
const DAI_KOVAN = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa';
const WETH_KOVAN = '0xd0A1E359811322d97991E03f863a0C30C2cF029C';
const LINK_KOVAN = '0xa36085F69e2889c224210F603D836748e7dC0088';

function App() {
  const [address, setAddress] = React.useState("");
  const [balance, setBalance] = React.useState("");
  
  // State variables for user erc20 balances.
  const [daiBalance, setDaiBalance] = React.useState("");
  const [linkBalance, setLinkBalance] = React.useState("");
  //const [wethBalance, setWethBalance] = React.useState("");
  
  const [depositAsset, setDepositAsset] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [withdrawAsset, setWithdrawAsset] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");

  // State variables for user orders and order details.
  const [ordersCount, setOrdersCount] = React.useState("");

  const { ethereum } = window;
  let provider;

  const tokenAddresses = {};
  tokenAddresses['DAI'] = DAI_KOVAN;
  tokenAddresses['ETH'] = WETH_KOVAN;
  tokenAddresses['LINK'] = LINK_KOVAN;

  const contractJSONs = {};
  contractJSONs['DAI'] = daiJSON;
  contractJSONs['LINK'] = linkJSON;
  
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
    //console.log("User Balance: ", userBalance);
    setAddress(userAddress);
    setBalance(ethers.utils.formatEther(userBalance));

    //
    const daiContract = new ethers.Contract(DAI_KOVAN, daiJSON, signer);
    const userDaiBalance = await daiContract.balanceOf(userAddress);
    //console.log("DAI BALANCE: ", userDaiBalance);
    setDaiBalance(ethers.utils.formatEther(userDaiBalance));
    //
    const linkContract = new ethers.Contract(LINK_KOVAN, linkJSON, signer);
    const userLinkBalance = await linkContract.balanceOf(userAddress);
    //console.log("LINK BALANCE: ", userLinkBalance);
    setLinkBalance(ethers.utils.formatEther(userLinkBalance));


    // Display puchase orders

    const contractInstance = new ethers.Contract(gravityAddress, gravityJSON, signer);
    const purchaseOrders = await contractInstance.purchaseOrders;
    const poCount = purchaseOrders.length;
    //console.log("PURCHASE ORDERS: ", purchaseOrders);
    console.log(poCount);
    setOrdersCount(poCount);
    //
    // for(let i=0; i<poCount; i++) {
    //  console.log(purchaseOrders[i]);
    // }

    // Accounts
    const accountsList = await contractInstance.accounts;
    console.log(accountsList);
    console.log(accountsList.length);
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
                                                                    {gasLimit: 30000000});
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
        <h3>Contract Details</h3>
        <ul>
          <li>
            Contract address: {gravityAddress}
          </li>
          <li>
            Your address: {address}
          </li>
        </ul>
      </div>
      <div className="user-balances">
        <h3>Your Balances</h3>
        <ul>
          <li>
            ETH: {balance}
          </li>
          <li>
            DAI: {daiBalance}
          </li>
          <li>
            LINK: {linkBalance}
          </li>
          <li>
            WETH: {/* {wethBalance} */}
          </li>
        </ul>
      </div>
      <div className="container">
        <h3>Manage Strategies</h3>
        <div className="deposit">
          <b>Open New (Deposit)</b>
          <div className="input-row">
            <label> Deposit Asset: </label>
            <input  value={depositAsset} onInput={e => setDepositAsset(e.target.value)}/>
          </div>
          <div className="input-row">
            <label> Deposit Amount: </label>
            <input  value={depositAmount} onInput={e => setDepositAmount(e.target.value)}/>
          </div>
          <div className="input-row">
            <label> Purchase Amount: </label>
            <input  value={purchaseAmount} onInput={e => setPurchaseAmount(e.target.value)}/>
          </div>
          <div className="deposit-button">
            <button onClick={initiateNewStrategy}> initiateNewStrategy </button>
          </div>
        </div>
        
        <div className="withdraw">
          <b>Close Strategy (Withdraw)</b>
          <div className="input-row">
            <label> Withdraw Asset: </label>
            <input value={withdrawAsset} onInput={e => setWithdrawAsset(e.target.value)}/>
          </div>
          <div className="input-row">     
            <label> Withdraw Amount: </label>
            <input value={withdrawAmount} onInput={e => setWithdrawAmount(e.target.value)}/>
          </div>
          <div className="withdraw-button">  
            <button  onClick={withdraw}> Withdraw </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="user-strategies">
          <h3>My Strategies</h3>
          <ul>
            <li>
              Open Orders: {ordersCount}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
