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
    console.log('Starting router liquidity addition...');

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

    // Check initial reserves if pair exists
    let reserve0 = BigInt(0);
    let reserve1 = BigInt(0);
    let hasExistingLiquidity = false;
    
    try {
      const initialReserves = await publicClient.readContract({
        address: pair,
        abi: UniswapV2PairABI,
        functionName: 'getReserves',
      });
      reserve0 = initialReserves[0];
      reserve1 = initialReserves[1];
      console.log('Initial reserves:', {
        reserve0: formatEther(reserve0),
        reserve1: formatEther(reserve1),
      });
      
      if (reserve0 > 0 && reserve1 > 0) {
        hasExistingLiquidity = true;
      }
    } catch (error) {
      console.log('Pair not initialized yet, or reserves unavailable');
    }

    // Calculate the amounts to add based on reserves
    let amount1, amount2, minAmount1, minAmount2;
    
    if (hasExistingLiquidity) {
      // If pool already has liquidity, we need to match the ratio
      console.log('Pool already has liquidity. Calculating optimal amounts...');
      
      // Use existing ratio: amount2 = amount1 * reserve1 / reserve0
      amount1 = parseEther('50'); // Base amount for token1
      amount2 = (amount1 * reserve1) / reserve0; // Proportional amount for token2
      
      console.log('Adding liquidity in ratio:', {
        amount1: formatEther(amount1),
        amount2: formatEther(amount2),
      });
      
      // Set minimums with 2% slippage tolerance
      minAmount1 = amount1 * BigInt(98) / BigInt(100);
      minAmount2 = amount2 * BigInt(98) / BigInt(100);
    } else {
      // If no liquidity yet, we can choose any ratio
      amount1 = parseEther('100');
      amount2 = parseEther('100');
      minAmount1 = parseEther('95');
      minAmount2 = parseEther('95');
    }
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes from now

    // Approve tokens for router
    console.log('Approving tokens for router...');
    const approveTx1 = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [router, amount1],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx1 });
    console.log('Token1 approved for router');

    const approveTx2 = await walletClient.writeContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [router, amount2],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx2 });
    console.log('Token2 approved for router');

    // Add liquidity through router
    console.log('Adding liquidity through router...');
    console.log('Parameters:', {
      token1: token1,
      token2: token2,
      amount1: formatEther(amount1),
      amount2: formatEther(amount2),
      minAmount1: formatEther(minAmount1),
      minAmount2: formatEther(minAmount2),
      to: account.address,
      deadline: Number(deadline)
    });
    
    const addLiquidityTx = await walletClient.writeContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: 'addLiquidity',
      args: [
        token1,
        token2,
        amount1,
        amount2,
        minAmount1,
        minAmount2,
        account.address,
        deadline
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: addLiquidityTx });
    console.log('Liquidity added successfully', { transactionHash: addLiquidityTx });

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
    console.log('Token amounts spent:', {
      token1: formatEther(initialBalance1 - finalBalance1),
      token2: formatEther(initialBalance2 - finalBalance2),
    });

    // Get updated pair address (in case it was just created)
    const pairAddress = await publicClient.readContract({
      address: factory,
      abi: require('../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json').abi,
      functionName: 'getPair',
      args: [token1, token2],
    });
    
    if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
      // Check liquidity token balance
      const liquidityBalance = await publicClient.readContract({
        address: pairAddress,
        abi: UniswapV2PairABI,
        functionName: 'balanceOf',
        args: [account.address],
      });
      console.log('Liquidity tokens received:', formatEther(liquidityBalance));

      // Check reserves
      const reserves = await publicClient.readContract({
        address: pairAddress,
        abi: UniswapV2PairABI,
        functionName: 'getReserves',
      });
      console.log('Updated pool reserves:', {
        reserve0: formatEther(reserves[0]),
        reserve1: formatEther(reserves[1]),
      });
    }

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