import React from 'react';
import Select from 'react-select';
import { GRAVITY, DAI_KOVAN, WETH_KOVAN, LINK_KOVAN } from './Addresses.js';

const Networks = [
    { id: 0, label: "DAI", value: DAI_KOVAN },
    { id: 1, label: "ETH", value: WETH_KOVAN },
];

function Dropdown(props) {
  const{ network, updateHandler} = props;

    return (
        <div style={{ margin: "10px 50% 0px 0px" }}>
            <Select options={Networks} 
                    defaultValue={Networks[0]}
                    placeholder="Select Network"
                    value={network}
                    // onChange={updateHandler}
                    />
        </div>
    );
}

export default Dropdown