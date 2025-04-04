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
const UniswapV2FactoryABI = require('../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json').abi;
const UniswapV2PairABI = require('../artifacts/contracts/UniswapV2Pair.sol/UniswapV2Pair.json').abi;

async function main() {
  try {
    console.log('Starting Uniswap V2 tests...');

    // 1. Mint tokens
    console.log('\n1. Minting tokens...');
    const mintAmount = parseEther('10000');
    
    const mintToken1Tx = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'mint',
      args: [account.address, mintAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintToken1Tx });
    console.log('Minted Token1');

    const mintToken2Tx = await walletClient.writeContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'mint',
      args: [account.address, mintAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintToken2Tx });
    console.log('Minted Token2');

    // 2. Add liquidity
    console.log('\n2. Adding liquidity...');
    const liquidityAmount = parseEther('1000');

    // Approve tokens
    const approveToken1Tx = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, liquidityAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveToken1Tx });
    console.log('Approved Token1');

    const approveToken2Tx = await walletClient.writeContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, liquidityAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveToken2Tx });
    console.log('Approved Token2');

    // Add liquidity
    const addLiquidityTx = await walletClient.writeContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'mint',
      args: [account.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: addLiquidityTx });
    console.log('Added liquidity');

    // 3. Perform swap
    console.log('\n3. Performing swap...');
    const swapAmount = parseEther('100');
    const minOut = parseEther('99');

    // Approve token for swap
    const approveSwapTx = await walletClient.writeContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'approve',
      args: [pair, swapAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveSwapTx });
    console.log('Approved Token1 for swap');

    // Perform swap
    const swapTx = await walletClient.writeContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'swap',
      args: [swapAmount, minOut],
    });
    await publicClient.waitForTransactionReceipt({ hash: swapTx });
    console.log('Swap completed');

    // 4. Verify final state
    console.log('\n4. Verifying final state...');
    
    const token1Balance = await publicClient.readContract({
      address: token1,
      abi: TestTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log('Token1 balance:', formatEther(token1Balance));

    const token2Balance = await publicClient.readContract({
      address: token2,
      abi: TestTokenABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log('Token2 balance:', formatEther(token2Balance));

    const reserves = await publicClient.readContract({
      address: pair,
      abi: UniswapV2PairABI,
      functionName: 'getReserves',
    });
    console.log('Pool reserves:', {
      reserve0: formatEther(reserves[0]),
      reserve1: formatEther(reserves[1]),
    });

    console.log('\nAll tests completed successfully!');

  } catch (error) {
    console.error('Error during tests:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 