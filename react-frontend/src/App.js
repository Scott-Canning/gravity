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
  const [purchaseInterval, setPurchaseInterval] = React.useState("");

  // withdraw state
  const [withdrawSrcAmount, setWithdrawSrcAmount] = React.useState("");
  const [withdrawTgtAmount, setWithdrawTgtAmount] = React.useState("");

  // State variables for user account details
  //const [ordersCount, setOrdersCount] = React.useState("");
  const [srcAsset, setSrcAsset] = React.useState("");
  const [srcAssetBal, setSrcAssetBal] = React.useState("");
  const [tgtAsset, setTgtAsset] = React.useState("");
  const [tgtAssetBal, setTgtAssetBal] = React.useState("");
  const [purchInterval, setPurchInterval] = React.useState("");
  // const [scheduleTimestamps, setScheduleTimestamps] = React.useState([]);
  // const [schedulePurchases, setSchedulePurchases] = React.useState([]);
  const [purchaseSchedule, setPurchaseSchedule] = React.useState({});

  const { ethereum } = window;
  let provider;

  const tokenAddresses = {
    'DAI': DAI_KOVAN,
    'WETH': WETH_KOVAN,
    'LINK': LINK_KOVAN,
  };

  const tokenAddressesRev = {};
    tokenAddressesRev[DAI_KOVAN] = 'DAI';
    tokenAddressesRev[WETH_KOVAN] = 'WETH';
    tokenAddressesRev[LINK_KOVAN] = 'LINK';
  
  const contractJSONs = {
    'DAI': daiJSON,
    'WETH': wethJSON,
    'LINK': linkJSON
  };

  //const ZEROS = '000000000000000000';
  
  if(ethereum) {
    ethereum.request({ method: 'eth_requestAccounts' });
    provider = new ethers.providers.Web3Provider(ethereum);
    displayUserDetails();
    //reconstructSchedule();
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
    // console.log(userAccount);
    const srcAsset = userAccount[1]
    setSrcAsset(tokenAddressesRev[srcAsset]);
    const srcAssetBal = ethers.utils.formatUnits(userAccount[4]); //formatEther(userAccount[4]);
    setSrcAssetBal(srcAssetBal);
    const tgtAsset = userAccount[2]
    setTgtAsset(tokenAddressesRev[tgtAsset]);
    const tgtAssetBal = ethers.utils.formatEther(userAccount[5]);
    setTgtAssetBal(tgtAssetBal);
    const purchInterval = ethers.utils.formatUnits(userAccount[6].toString());
    setPurchInterval(purchInterval[19]);  // has to be a better way to parse this value;

    // // display puchase orders
    // const purchaseOrders = await contractInstance.purchaseOrders;
    // const poCount = purchaseOrders.length;
    // //console.log("PURCHASE ORDERS: ", purchaseOrders);
    // setOrdersCount(poCount);
  }

  async function initiateNewStrategy() {
    const signer = await provider.getSigner();
    const tokenInstance = new ethers.Contract(tokenAddresses[depositAsset], contractJSONs[depositAsset], signer);

    const parsedDepositAmt = ethers.utils.parseUnits(depositAmount.toString(), 18);
    const parsedPurchaseAmt = ethers.utils.parseUnits(purchaseAmount.toString(), 18);
    
    const approve = await tokenInstance.approve(GRAVITY, parsedDepositAmt);
    // console.log("approve: ", approve);

    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const initStrategy = await contractInstance.initiateNewStrategy(tokenAddresses[depositAsset], 
                                                                    tokenAddresses['WETH'], 
                                                                    parsedDepositAmt,
                                                                    purchaseInterval,
                                                                    parsedPurchaseAmt,
                                                                    {gasLimit: 1500000});
    // console.log("initiateNewStrategy: ", initStrategy);
  }

  async function withdrawSource() {
    const parsedAmount = ethers.utils.parseUnits(withdrawSrcAmount.toString());
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const withdrawSource = await contractInstance.withdrawSource(tokenAddresses['DAI'], parsedAmount, {gasLimit: 25000000});
    //console.log("withdrawSource: ", withdrawSource);
  }

  async function withdrawTarget() {
    const parsedAmount = ethers.utils.parseUnits(withdrawTgtAmount.toString());
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const withdrawTarget = await contractInstance.withdrawTarget(tokenAddresses['WETH'], parsedAmount, {gasLimit: 350000});
    //console.log("withdrawTarget: ", withdrawTarget);
  }

  async function reconstructSchedule() {
    const signer = await provider.getSigner();
    const contractInstance = new ethers.Contract(GRAVITY, gravityJSON, signer);
    const readSchedule = await contractInstance.reconstructSchedule(signer.getAddress());
    const [ timestamps, purchaseAmounts ] = readSchedule;
    //console.log(readSchedule);
    let tempSchedule = {};

    for(let i = 0; i < timestamps.length; i++) {
      let formattedTimestamp = timeConverter(ethers.utils.formatEther(timestamps[i]) * 1e18);
      tempSchedule[formattedTimestamp] = ethers.utils.formatUnits(purchaseAmounts[i]);
    }
    setPurchaseSchedule(tempSchedule);
    console.log(purchaseSchedule);
  }

  function timeConverter(UNIX_timestamp){
    let a = new Date(UNIX_timestamp * 1000);
    let months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let year = a.getFullYear();
    let month = months[a.getMonth()];
    let date = a.getDate();
    let hour = a.getHours();
    let min =  a.getMinutes();
    if(min.length > 1) {
      min = "0" + min;
      min = min.substring(-2);
    }
    let time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min;//.substring(-2);
    return time.toString();
  }

  // format deposit and purchase amounts to have 18 zeros.
  // async function formatZeros(_amount) {
  //   const amount = _amount + ZEROS;
  //   return(amount);
  // }

  return (
    <div className="App">
      <div className="title" >
      <a href={CONTRACT_URL} target="_blank" style={{ color: 'inherit', textDecoration: 'inherit'}}>Gravity</a>
      </div>
      <div className="container">
        <ul className="no-bullets">
          <li>
            Connected: {address}
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
        <h3 className="sub-title"> Manage Strategy</h3>
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
            <label> Purchase Interval: </label>
            <input  value={purchaseInterval} onInput={e => setPurchaseInterval(e.target.value)}/>
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
        <h3 className="sub-title">Live Strategy Details</h3>
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
              Purchase Interval: {purchInterval}
            </li>
          </ul>
        </div>
        <div className ="strategy-details">
          <div>
            { Object.keys(purchaseSchedule).map((key, index) => { 
              return (
                  <p key={index}> {key} {purchaseSchedule[{key}]}</p>
              );
              })
            }
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
