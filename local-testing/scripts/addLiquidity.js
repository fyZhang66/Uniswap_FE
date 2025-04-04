const { createPublicClient, http, parseEther, formatEther } = require('viem');
const { hardhat } = require('viem/chains');
const { createWalletClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

// Read deployed addresses
const addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
const { token1, token2, factory, pair } = addresses;

// Create clients
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(),
});

const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'); // Hardhat default account

const walletClient = createWalletClient({
  account,
  chain: hardhat,
  transport: http(),
});

// Contract ABIs
const TestTokenABI = require('../artifacts/contracts/ERC20.sol/TestToken.json').abi;
const UniswapV2PairABI = require('../artifacts/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;

async function main() {
  try {
    console.log('Starting liquidity addition...');

    // Amounts to add (in wei)
    const amount1 = parseEther('1000');
    const amount2 = parseEther('1000');

    // Check initial balances
    const initialBalance1 = await publicClient.readContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    const initialBalance2 = await publicClient.readContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log('Initial balances:', {
      token1: formatEther(initialBalance1),
      token2: formatEther(initialBalance2),
    });

    // Check initial reserves
    const initialReserves = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'getReserves',
    });
    console.log('Initial reserves:', {
      reserve0: formatEther(initialReserves[0]),
      reserve1: formatEther(initialReserves[1]),
    });

    // Approve tokens
    console.log('Approving Token1...');
    const approveToken1Tx = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, amount1],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveToken1Tx });
    console.log('Token1 approved');

    console.log('Approving Token2...');
    const approveToken2Tx = await walletClient.writeContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, amount2],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveToken2Tx });
    console.log('Token2 approved');

    // Add liquidity
    console.log('Adding liquidity...');
    const addLiquidityTx = await walletClient.writeContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'mint',
      args: [account.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: addLiquidityTx });
    console.log('Liquidity added successfully');

    // Check final balances
    const finalBalance1 = await publicClient.readContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    const finalBalance2 = await publicClient.readContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log('Final balances:', {
      token1: formatEther(finalBalance1),
      token2: formatEther(finalBalance2),
    });

    // Check final reserves
    const finalReserves = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'getReserves',
    });
    console.log('Final reserves:', {
      reserve0: formatEther(finalReserves[0]),
      reserve1: formatEther(finalReserves[1]),
    });

    // Check LP token balance
    const lpBalance = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log('LP tokens received:', formatEther(lpBalance));

    console.log('Liquidity addition completed successfully!');

  } catch (error) {
    console.error('Error during liquidity addition:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 