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
    console.log('Starting router swap...');

    // Amount to swap
    const amountIn = parseEther('10'); // 10 tokens

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

    // Get expected output amount
    const path = [token1, token2];
    const amountsOut = await publicClient.readContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: 'getAmountsOut',
      args: [amountIn, path],
    });
    const expectedOutput = amountsOut[1];
    console.log('Expected output amount:', formatEther(expectedOutput));
    
    // Set minimum output with 5% slippage
    const minAmountOut = (expectedOutput * BigInt(95)) / BigInt(100);
    console.log('Minimum output amount (5% slippage):', formatEther(minAmountOut));
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes from now

    // Approve token1 for router
    console.log('Approving token1 for router...');
    const approveTx = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [router, amountIn],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('Token1 approved for router');

    // Execute swap
    console.log('Executing swap...');
    console.log('Swap parameters:', {
      amountIn: formatEther(amountIn),
      minAmountOut: formatEther(minAmountOut),
      path: path,
      to: account.address,
      deadline: Number(deadline)
    });
    
    const swapTx = await walletClient.writeContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: 'swapExactTokensForTokens',
      args: [
        amountIn,
        minAmountOut,
        path,
        account.address,
        deadline
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
    console.log('Swap executed successfully', { transactionHash: swapTx });

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
    console.log('Token1 spent:', formatEther(initialBalance1 - finalBalance1));
    console.log('Token2 received:', formatEther(finalBalance2 - initialBalance2));

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

  } catch (error) {
    console.error('Error during swap:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });