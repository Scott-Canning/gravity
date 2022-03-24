const ethers = require("ethers");
const abi = require("./utils/gravity.json");
require('dotenv').config();

async function main() {
    const url = process.env.KOVAN_URL;
    const provider = new ethers.providers.JsonRpcProvider(url);
    const contractAddress = "0x4Ca9C14d4Ca0CA5114fF4af8677d9BBCE8b49792";
    let iface = new ethers.utils.Interface(abi);
    console.log('Pulling logs for ' + contractAddress + '...')

    let events;
    await provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: contractAddress,
    }).then(function(logs) {
        console.log("Printing array of events:");
        events = logs.map((log) => iface.parseLog(log))
    }).catch(function(err){
        console.log(err);
    });

    for(let i = 0; i < events.length; i++) {
      console.log(events[i]);
    }
}

main()
 .then(() => process.exit(0))
 .catch(error => {
   console.error(error);
   process.exit(1);
 });