const { createPublicClient, http, parseEther, formatEther } = require('viem');
const { hardhat } = require('viem/chains');
const { createWalletClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

// Read deployed addresses
const addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
const { token1, token2, factory, pair, router } = addresses;

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
const UniswapV2RouterABI = require('../artifacts/contracts/UniswapV2Router.sol/UniswapV2Router.json').abi;

async function main() {
  try {
    console.log('Starting to remove liquidity...');

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

    console.log('Initial token balances:', {
      token1: formatEther(initialBalance1),
      token2: formatEther(initialBalance2),
    });

    // Check liquidity token balance
    const liquidityBalance = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    console.log('Liquidity token balance:', formatEther(liquidityBalance));

    if (liquidityBalance <= BigInt(0)) {
      console.log('No liquidity tokens to remove. Add liquidity first.');
      process.exit(0);
    }

    // Check initial reserves
    const initialReserves = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'getReserves',
    });

    console.log('Initial pool reserves:', {
      reserve0: formatEther(initialReserves[0]),
      reserve1: formatEther(initialReserves[1]),
    });

    // Amount of liquidity to remove (half of balance)
    const liquidityToRemove = liquidityBalance / BigInt(2);
    console.log('Removing liquidity amount:', formatEther(liquidityToRemove));

    // Set min amounts and deadline
    const amountAMin = BigInt(0); // We accept any amount
    const amountBMin = BigInt(0); // We accept any amount
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes from now

    // Approve liquidity tokens for router
    console.log('Approving liquidity tokens for router...');
    const approveTx = await walletClient.writeContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'approve',
      args: [router, liquidityToRemove],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('Liquidity tokens approved for router');

    // Remove liquidity
    console.log('Removing liquidity...');
    const removeLiquidityTx = await walletClient.writeContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: 'removeLiquidity',
      args: [
        token1,
        token2,
        liquidityToRemove,
        amountAMin,
        amountBMin,
        account.address,
        deadline,
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: removeLiquidityTx });
    console.log('Liquidity removed successfully', { transactionHash: removeLiquidityTx });

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

    console.log('Final token balances:', {
      token1: formatEther(finalBalance1),
      token2: formatEther(finalBalance2),
    });

    console.log('Token amounts received:', {
      token1: formatEther(finalBalance1 - initialBalance1),
      token2: formatEther(finalBalance2 - initialBalance2),
    });

    // Check final liquidity token balance
    const finalLiquidityBalance = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    console.log('Final liquidity token balance:', formatEther(finalLiquidityBalance));

    // Check final reserves
    const finalReserves = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'getReserves',
    });

    console.log('Final pool reserves:', {
      reserve0: formatEther(finalReserves[0]),
      reserve1: formatEther(finalReserves[1]),
    });

  } catch (error) {
    console.error('Error while removing liquidity:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });