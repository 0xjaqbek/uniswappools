const rpcEndpoint = 'https://ethereum.publicnode.com';
const contractAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'; // factory address
const contractABI = [{"inputs":[{"internalType":"address","name":"_feeToSetter","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token0","type":"address"},{"indexed":true,"internalType":"address","name":"token1","type":"address"},{"indexed":false,"internalType":"address","name":"pair","type":"address"},{"indexed":false,"internalType":"uint256","name":"","type":"uint256"}],"name":"PairCreated","type":"event"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"allPairs","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"allPairsLength","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"tokenA","type":"address"},{"internalType":"address","name":"tokenB","type":"address"}],"name":"createPair","outputs":[{"internalType":"address","name":"pair","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"feeTo","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"feeToSetter","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"getPair","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_feeTo","type":"address"}],"name":"setFeeTo","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_feeToSetter","type":"address"}],"name":"setFeeToSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}];

const web3 = new Web3(new Web3.providers.HttpProvider(rpcEndpoint));
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Function to request account access
async function requestAccount() {
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log('Account access granted.');
    } catch (error) {
        console.error('User denied account access:', error);
    }
}

async function fetchLiquidityPools() {
    try {
        // Define block intervals for different time frames
        const blockIntervals = {
            '3600': 500,   // Last 1 Hour
            '7200': 1500,  // Last 2 Hours
            '14400': 2500  // Last 4 Hours
            // Add more intervals as needed
        };

        // Get the selected time frame value from the dropdown
        const selectedTimeFrame = document.getElementById('timeFrame').value;
        const blockInterval = blockIntervals[selectedTimeFrame];

        if (!blockInterval) {
            console.error('Invalid time frame selected.');
            return;
        }

        const currentBlock = await web3.eth.getBlockNumber();
        const newestBlock = await web3.eth.getBlock('latest');
        const newestBlockNumber = newestBlock.number;
        const currentTime = new Date().toLocaleTimeString(); // Get the current time

        const events = await contract.getPastEvents('PairCreated', {
            fromBlock: currentBlock - blockInterval,
            toBlock: 'latest'
        });

        // Sort events in reverse order based on block number
        events.sort((a, b) => b.blockNumber - a.blockNumber);

        const liquidityPoolsContainer = document.getElementById('liquidityPools');
        const blockInfoContainer = document.getElementById('blockInfo');
        liquidityPoolsContainer.innerHTML = ''; // Clear previous content

        if (events.length > 0) {
            console.log('Liquidity pools fetched successfully!');
            blockInfoContainer.innerHTML = `
                <p>Current Time: ${currentTime} | Block Range: ${currentBlock} to ${currentBlock - blockInterval} | Newest Block Number: ${newestBlockNumber}</p>
            `;

            // Use Promise.all to parallelize asynchronous calls
            const poolInfoPromises = events.map(async (event) => {
                const [token0Balance, token1Balance] = await getTokenInfo(event.returnValues.pair);

                // Get the timestamp of the block and format it
                const blockTimestamp = (await web3.eth.getBlock(event.blockNumber)).timestamp;
                const blockTime = new Date(blockTimestamp * 1000).toLocaleTimeString();

                // Check if either token address is WETH, case-insensitive
                const token0 = isWETH(event.returnValues.token0) ? 'WETH' : event.returnValues.token0;
                const token1 = isWETH(event.returnValues.token1) ? 'WETH' : event.returnValues.token1;

                // Convert balances to BigNumber for accurate comparison
                const token0BalanceBN = new web3.utils.BN(token0Balance);
                const token1BalanceBN = new web3.utils.BN(token1Balance);

                // Check if either balance is greater than or equal to 0.5 WETH
                if (
                    (token0 === 'WETH' && token0BalanceBN.gte(web3.utils.toWei('0.5', 'ether'))) ||
                    (token1 === 'WETH' && token1BalanceBN.gte(web3.utils.toWei('0.5', 'ether')))
                ) {
                    // Check if both token balances are greater than 0
                    if (token0BalanceBN.gt(0) && token1BalanceBN.gt(0)) {
                        // Create a hyperlink if the token is not WETH
                        const token0Link = isWETH(event.returnValues.token0) ? token0 : `<a href="https://www.dextools.io/app/en/ether/pair-explorer/${event.returnValues.token0}" target="_blank">${token0}</a>`;
                        const token1Link = isWETH(event.returnValues.token1) ? token1 : `<a href="https://www.dextools.io/app/en/ether/pair-explorer/${event.returnValues.token1}" target="_blank">${token1}</a>`;

                        return `
                            <p>Token 0: ${token0Link} Balance: ${token0Balance}</p>
                            <p>Token 1: ${token1Link} Balance: ${token1Balance}</p>
                            <p>Pair Address: ${event.returnValues.pair}</p>
                            <p>Block Number: ${event.blockNumber} (Mined at: ${blockTime})</p>
                            <hr>
                        `;
                    }
                }

                return null; // Skip pools that don't meet the conditions
            });

// Function to check if an address is WETH
function isWETH(address) {
    const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    return address.toLowerCase() === wethAddress.toLowerCase();
}

const web3 = new Web3(new Web3.providers.HttpProvider(rpcEndpoint));
const contract = new web3.eth.Contract(contractABI, contractAddress);

            const poolInfoArray = (await Promise.all(poolInfoPromises)).filter(poolInfo => poolInfo !== null);

            // Append all poolInfo elements to the container
            poolInfoArray.forEach((poolInfo) => {
                const div = document.createElement('div');
                div.innerHTML = poolInfo;
                liquidityPoolsContainer.appendChild(div);
            });
        } else {
            console.log('No liquidity pools found for the selected time frame.');
            blockInfoContainer.innerHTML = '<p>No liquidity pools found for the selected time frame.</p>';
        }
    } catch (error) {
        console.error('Error fetching liquidity pools:', error);
    }
}

async function getTokenInfo(pairAddress) {
    try {
        const pairAbi = [{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount0Out","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1Out","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Swap","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint112","name":"reserve0","type":"uint112"},{"indexed":false,"internalType":"uint112","name":"reserve1","type":"uint112"}],"name":"Sync","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"MINIMUM_LIQUIDITY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"PERMIT_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_token0","type":"address"},{"internalType":"address","name":"_token1","type":"address"}],"name":"initialize","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"kLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"mint","outputs":[{"internalType":"uint256","name":"liquidity","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"price0CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"price1CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"skim","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount0Out","type":"uint256"},{"internalType":"uint256","name":"amount1Out","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"sync","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]; // ABI of the Uniswap V2 pair contract

        const pairContract = new web3.eth.Contract(pairAbi, pairAddress);

        // Get the reserves of the tokens in the pair
        const reserves = await pairContract.methods.getReserves().call();

        // Access the reserves directly from the returned object
        const reserve0 = reserves._reserve0;
        const reserve1 = reserves._reserve1;

        // Convert the balances to human-readable format (assuming 18 decimals for simplicity)
        const reserve0Formatted = web3.utils.fromWei(reserve0, 'ether');
        const reserve1Formatted = web3.utils.fromWei(reserve1, 'ether');

        return [reserve0Formatted, reserve1Formatted];
    } catch (error) {
        console.error('Error fetching token reserves:', error);
        return ['N/A', 'N/A'];
    }
}

// Attach the click event listener after the page has loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get a reference to the fetch button by its id
    const fetchButton = document.getElementById('fetchButton');
    console.log('Event listener is attached.');

    // Attach the click event listener
    fetchButton.addEventListener('click', async () => {
        console.log('Button clicked!');
        // Call the function to request account access before fetching liquidity pools
        await requestAccount();
        // Call the function to fetch liquidity pools
        fetchLiquidityPools();
    });
});
