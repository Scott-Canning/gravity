import { ethers } from 'ethers';
import './App.css';
import React from 'react';
import { GRAVITY_KOVAN, DAI_KOVAN, WETH_KOVAN, LINK_KOVAN } from './Addresses.js';
import gravityJSON from './utils/gravity.json';
import daiJSON from './utils/dai.json';
import linkJSON from './utils/link.json';

const GRAVITY = GRAVITY_KOVAN;
const DAI = DAI_KOVAN;
const WETH = WETH_KOVAN;
const LINK = LINK_KOVAN;

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

  // State variables for user account details
  const [ordersCount, setOrdersCount] = React.useState("");
  const [srcAsset, setSrcAsset] = React.useState("");
  const [srcAssetBal, setSrcAssetBal] = React.useState("");
  const [tgtAsset, setTgtAsset] = React.useState("");
  const [tgtAssetBal, setTgtAssetBal] = React.useState("");

  const { ethereum } = window;
  let provider;

  const tokenAddresses = {};
  tokenAddresses['DAI'] = DAI_KOVAN;
  tokenAddresses['ETH'] = WETH_KOVAN;
  tokenAddresses['LINK'] = LINK_KOVAN;

  const tokenAddressesRev = {};
  tokenAddressesRev[DAI_KOVAN] = 'DAI';
  tokenAddressesRev[WETH_KOVAN] = 'ETH';
  tokenAddressesRev[LINK_KOVAN] = 'LINK';

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

    const daiContract = new ethers.Contract(DAI_KOVAN, daiJSON, signer);
    const userDaiBalance = await daiContract.balanceOf(userAddress);
    setDaiBalance(ethers.utils.formatEther(userDaiBalance));

    const linkContract = new ethers.Contract(LINK_KOVAN, linkJSON, signer);
    const userLinkBalance = await linkContract.balanceOf(userAddress);
    setLinkBalance(ethers.utils.formatEther(userLinkBalance));

    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    
    // account strategy information
    const userAccount = await contractInstance.accounts(userAddress);
    const srcAsset = userAccount[1]
    setSrcAsset(tokenAddressesRev[srcAsset]);
    const srcAssetBal = ethers.utils.formatEther(userAccount[4]); // not sure this is the right index
    setSrcAssetBal(srcAssetBal);
    const tgtAsset = userAccount[2]
    setTgtAsset(tokenAddressesRev[tgtAsset]);
    const tgtAssetBal = ethers.utils.formatEther(userAccount[5]);
    setTgtAssetBal(tgtAssetBal);

    // Display puchase orders
    //const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const purchaseOrders = await contractInstance.purchaseOrders;
    const poCount = purchaseOrders.length;
    //console.log("PURCHASE ORDERS: ", purchaseOrders);
    console.log(poCount);
    setOrdersCount(poCount);
  }

  async function initiateNewStrategy() {
    //const depositBigNum = ethers.BigNumber.from("depositAmount" + "");
    const signer = await provider.getSigner();
    const tokenInstance = new ethers.Contract(tokenAddresses[depositAsset], contractJSONs[depositAsset], signer);
    console.log("tokenInstance address:", tokenAddresses[depositAsset]);
    const approve = await tokenInstance.approve(GRAVITY, depositAmount);
    console.log("approve: ", approve);

    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const initStrategy = await contractInstance.initiateNewStrategy(tokenAddresses[depositAsset], 
                                                                    tokenAddresses['ETH'], 
                                                                    depositAmount,
                                                                    1,
                                                                    purchaseAmount,
                                                                    {gasLimit: 1500000}); //30000000
    console.log("initiateNewStrategy: ", initStrategy);
    console.log("source asset address:", tokenAddresses[depositAsset]);
  }

  // async function getTargetAssetBalance() {
  //   const signer = await provider.getSigner();
  //   const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
  //   const targetAssetBalance = await contractInstance.accounts(signer.address).targetBalance;
  //   setTargetAssetBalance(ethers.utils.formatEther(targetAssetBalance));
  // }

  async function withdraw() {
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
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
            Contract address: {GRAVITY}
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
            <button onClick={initiateNewStrategy}> Initiate Strategy </button>
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
          <h3>Open Strategy</h3>
          <ul>
            <li>
              Source Asset: {srcAsset}
            </li>
            <li>
              Scheduled Balance: {srcAssetBal}
            </li>
            <li>
              Target Asset: {tgtAsset}
            </li>
            <li>
              Target Asset Balance: {tgtAssetBal}
            </li>
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
