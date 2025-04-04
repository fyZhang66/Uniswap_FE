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

    // Amount of liquidity to add (smaller amounts)
    const amount1 = parseEther('100'); // 100 tokens
    const amount2 = parseEther('100'); // 100 tokens

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

    // Approve tokens
    console.log('Approving tokens...');
    const approveTx1 = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, amount1],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx1 });
    console.log('Token1 approved');

    const approveTx2 = await walletClient.writeContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, amount2],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx2 });
    console.log('Token2 approved');

    // Transfer tokens to pair
    console.log('Transferring tokens to pair...');
    const transferTx1 = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'transfer',
      args: [pair, amount1],
    });
    await publicClient.waitForTransactionReceipt({ hash: transferTx1 });
    console.log('Token1 transferred');

    const transferTx2 = await walletClient.writeContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'transfer',
      args: [pair, amount2],
    });
    await publicClient.waitForTransactionReceipt({ hash: transferTx2 });
    console.log('Token2 transferred');

    // Add liquidity
    console.log('Adding liquidity...');
    const mintTx = await walletClient.writeContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'mint',
      args: [account.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
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

    // Check reserves
    const reserves = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'getReserves',
    });
    console.log('Pool reserves:', {
      reserve0: formatEther(reserves[0]),
      reserve1: formatEther(reserves[1]),
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 