import { ethers } from 'ethers';
import './App.css';
import React from 'react';
import { GRAVITY_KOVAN, DAI_KOVAN, WETH_KOVAN, LINK_KOVAN } from './Addresses.js';
import gravityJSON from './utils/gravity.json';
import daiJSON from './utils/dai.json';
import wethJSON from './utils/weth.json';
import linkJSON from './utils/link.json';

const GRAVITY = GRAVITY_KOVAN;
const CONTRACT_URL = "https://kovan.etherscan.io/address/" + GRAVITY;

function App() {
  const [address, setAddress] = React.useState("");
  const [balance, setBalance] = React.useState("");
  
  // State variables for user erc20 balances.
  const [daiBalance, setDaiBalance] = React.useState("");
  const [linkBalance, setLinkBalance] = React.useState("");
  const [wethBalance, setWethBalance] = React.useState("");
  
  const [depositAsset, setDepositAsset] = React.useState("");
  const [depositAmount, setDepositAmount] = React.useState("");
  const [purchaseAmount, setPurchaseAmount] = React.useState("");
  const [purchaseFrequency, setPurchaseFrequency] = React.useState("");
  const [withdrawSrcAmount, setWithdrawSrcAmount] = React.useState("");
  const [withdrawTgtAmount, setWithdrawTgtAmount] = React.useState("");

  // State variables for user account details
  const [ordersCount, setOrdersCount] = React.useState("");
  const [srcAsset, setSrcAsset] = React.useState("");
  const [srcAssetBal, setSrcAssetBal] = React.useState("");
  const [tgtAsset, setTgtAsset] = React.useState("");
  const [tgtAssetBal, setTgtAssetBal] = React.useState("");
  const [scheduleTimestamps, setScheduleTimestamps] = React.useState([]);
  const [schedulePurchases, setSchedulePurchases] = React.useState([]);

  const { ethereum } = window;
  let provider;

  const tokenAddresses = {
    'DAI': DAI_KOVAN,
    'ETH': WETH_KOVAN,
    'LINK': LINK_KOVAN,
  };

  const tokenAddressesRev = {};
    tokenAddressesRev[DAI_KOVAN] = 'DAI';
    tokenAddressesRev[WETH_KOVAN] = 'ETH';
    tokenAddressesRev[LINK_KOVAN] = 'LINK';
  
  const contractJSONs = {
    'DAI': daiJSON,
    'WETH': wethJSON,
    'LINK': linkJSON
  };

  const ZEROS = '000000000000000000';
  
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

    const daiContract = new ethers.Contract(DAI_KOVAN, daiJSON, signer);
    const userDaiBalance = await daiContract.balanceOf(userAddress);
    setDaiBalance(ethers.utils.formatEther(userDaiBalance));

    const wethContract = new ethers.Contract(WETH_KOVAN, linkJSON, signer);
    const userWethBalance = await wethContract.balanceOf(userAddress);
    setWethBalance(ethers.utils.formatEther(userWethBalance));

    const linkContract = new ethers.Contract(LINK_KOVAN, linkJSON, signer);
    const userLinkBalance = await linkContract.balanceOf(userAddress);
    setLinkBalance(ethers.utils.formatEther(userLinkBalance));
    
    // account strategy information
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const userAccount = await contractInstance.accounts(userAddress);
    const srcAsset = userAccount[1]
    setSrcAsset(tokenAddressesRev[srcAsset]);
    const srcAssetBal = ethers.utils.formatEther(userAccount[4]); // not sure this is the right index
    setSrcAssetBal(srcAssetBal);
    const tgtAsset = userAccount[2]
    setTgtAsset(tokenAddressesRev[tgtAsset]);
    const tgtAssetBal = ethers.utils.formatEther(userAccount[5]);
    setTgtAssetBal(tgtAssetBal);

    // display puchase orders
    //const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const purchaseOrders = await contractInstance.purchaseOrders;
    const poCount = purchaseOrders.length;
    //console.log("PURCHASE ORDERS: ", purchaseOrders);
    setOrdersCount(poCount);
  }

  async function initiateNewStrategy() {
    const signer = await provider.getSigner();
    const tokenInstance = new ethers.Contract(tokenAddresses[depositAsset], contractJSONs[depositAsset], signer);
    console.log("tokenInstance address:", tokenAddresses[depositAsset]);

    // Format Deposit Amount 
    const depositAmountFormatted = formatZeros(depositAmount);
    console.log("depositAmount: ", depositAmount);
    console.log("depositAmountFormatted: ", depositAmountFormatted);

    const purchaseAmountFormatted = formatZeros(purchaseAmount);
    console.log("purchaseAmount: ", purchaseAmount);
    console.log("purchaseAmountFormatted: ", purchaseAmountFormatted);

    const approve = await tokenInstance.approve(GRAVITY, depositAmountFormatted);
    console.log("approve: ", approve);

    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const initStrategy = await contractInstance.initiateNewStrategy(tokenAddresses[depositAsset], 
                                                                    tokenAddresses['ETH'], 
                                                                    depositAmountFormatted,
                                                                    purchaseFrequency,
                                                                    purchaseAmountFormatted,
                                                                    {gasLimit: 1500000});
    console.log("initiateNewStrategy: ", initStrategy);
    console.log("source asset address:", tokenAddresses[depositAsset]);
  }

  async function withdrawSource() {
    const formattedWithdrawalAmount = formatZeros(withdrawSrcAmount);
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const withdrawSource = await contractInstance.withdrawSource(tokenAddresses['DAI'], formattedWithdrawalAmount, {gasLimit: 750000});
    console.log("withdrawSource: ", withdrawSource);
  }

  async function withdrawTarget() {
    const formattedWithdrawalAmount = formatZeros(withdrawTgtAmount);
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const withdrawTarget = await contractInstance.withdrawTarget(tokenAddresses['WETH'], formattedWithdrawalAmount, {gasLimit: 350000});
    console.log("withdrawTarget: ", withdrawTarget);
  }

  async function reconstructSchedule() {
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const readSchedule = await contractInstance.reconstructSchedule(signer.getAddress());
    const [ timestamps, purchaseAmounts ] = readSchedule;
    let tempTimestamps = [];
    let tempPurchases = [];

    for(let i = 0; i < timestamps.length; i++) {
      tempTimestamps.push(ethers.utils.formatEther(timestamps[i]) * 1e18);
    }
    for(let i = 0; i < purchaseAmounts.length; i++) {
      tempPurchases.push(ethers.utils.formatEther(purchaseAmounts[i]));
    }

    setScheduleTimestamps(tempTimestamps => [...tempTimestamps, `${tempTimestamps.length}`]);
    setSchedulePurchases(tempPurchases => [...tempPurchases, `${tempPurchases.length}`]);
    //setScheduleTimestamps(timestamps);
    //setSchedulePurchases(purchaseAmounts);
    console.log("tempTimestamps: ", tempTimestamps);
    console.log("scheduleTimestamps: ", scheduleTimestamps);
    console.log("tempPurchases: ", tempPurchases);
    console.log("tempPurchases: ", schedulePurchases);
  }

  // format deposit and purchase amounts to have 18 zeros.
  async function formatZeros(_amount) {
    const amount = _amount + ZEROS;
    return(amount);
  }

  return (
    <div className="App">
      <div className="title">
        Gravity
      </div>
      <div className="container">
        <h3 className="sub-title">Addresses</h3>
        <ul className="no-bullets">
          <li>
            Contract: <a href={CONTRACT_URL} target="_blank">{GRAVITY}</a>
          </li>
          <li>
            Account: {address}
          </li>
        </ul>
      </div>
      <div className="container">
          <h3 className="sub-title">Account Balances</h3>
          <ul className="no-bullets">
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
              WETH: {wethBalance}
            </li>
          </ul>
        </div>
      <div className="container">
        <h3 className="sub-title">
          Manage Strategy
        </h3>
        <div className="deposit">
          <b>Configure New DCA Strategy</b>
          <div className="input-row">
            <label> Funding Asset: </label>
            <input  value={depositAsset} onInput={e => setDepositAsset(e.target.value)}/>
          </div>
          <div className="input-row">
            <label> Funding Amount: </label>
            <input  value={depositAmount} onInput={e => setDepositAmount(e.target.value)}/>
          </div>
          <div className="input-row">
            <label> Purchase Amount: </label>
            <input  value={purchaseAmount} onInput={e => setPurchaseAmount(e.target.value)}/>
          </div>
          <div className="input-row">
            <label> Purchase Frequency: </label>
            <input  value={purchaseFrequency} onInput={e => setPurchaseFrequency(e.target.value)}/>
          </div>
            <div className="deposit-button">
              <button onClick={initiateNewStrategy}> Initiate Strategy </button>
            </div>
        </div>
        
        <div className="withdraw">
          <b>Withdraw Funding Asset</b>
          <div className="input-row">     
            <label> Withdraw Amount: </label>
            <input value={withdrawSrcAmount} onInput={e => setWithdrawSrcAmount(e.target.value)}/>
          </div>
          <div className="withdraw-button">  
            <button  onClick={withdrawSource}> Withdraw </button>
          </div>
        </div>
        <div className="withdraw">
          <b>Withdraw Target Asset</b>
          <div className="input-row">     
            <label> Withdraw Amount: </label>
            <input value={withdrawTgtAmount} onInput={e => setWithdrawTgtAmount(e.target.value)}/>
          </div>
          <div className="withdraw-button">  
            <button  onClick={withdrawTarget}> Withdraw </button>
          </div>
        </div>
      </div>
      <div className="container">
        <h3 className="sub-title">Live Strategy</h3>
        <div className ="strategy-details">
          <ul className="no-bullets">
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
        <div className ="strategy-details">
          <div>
            Timestamps: 
            {/* { scheduleTimestamps.map((timestamp) => { 
              return (timestamp);
              })
            } */}
          </div>
          <div>
          Purchase Amounts: 
            {/* { schedulePurchases.map((timestamp) => { 
              return (timestamp);
              })
            } */}
          </div>
          <div className="schedule-button">  
            <button onClick={reconstructSchedule}> Get Schedule </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
