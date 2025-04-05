const { parseEther, parseUnits, formatEther, formatUnits } = require("viem");
const fs = require("fs");
const { getAccount, getPublicClient, getWalletClient } = require("./clientConfig");
const { MAINNET_TOKENS, TOKEN_DECIMALS, ERC20_ABI, WETH_ABI } = require("./mainnetTokens");

// Read deployed addresses (your custom Uniswap contracts)
const addresses = JSON.parse(
  fs.readFileSync("deployed-addresses.json", "utf8")
);
const { factory, router } = addresses;

// Get clients from the shared config
const publicClient = getPublicClient();
const account = getAccount();
const walletClient = getWalletClient();

// CONFIGURE THESE PARAMETERS BASED ON YOUR TEST NEEDS
// ===================================================
// Token selection (using your imported mainnet tokens)
const FROM_TOKEN = 'WETH';   // Token to swap from
const TO_TOKEN = 'USDC';     // Token to swap to

// Amount to swap (in FROM_TOKEN units)
const SWAP_AMOUNT = '0.005'; // E.g., 0.005 WETH

// Slippage tolerance in percentage (0.5 = 0.5%)
const SLIPPAGE = 0.5;
// ===================================================

// Contract ABIs (from your artifacts)
const UniswapV2RouterABI = require("../artifacts/contracts/UniswapV2Router.sol/UniswapV2Router.json").abi;
const UniswapV2FactoryABI = require("../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json").abi;
const UniswapV2PairABI = require("../artifacts/contracts/UniswapV2Pair.sol/UniswapV2Pair.json").abi;

async function main() {
  try {
    console.log("Starting router swap with public tokens...");
    console.log(`Account: ${account.address}`);
    
    // Get token addresses from mainnet config
    const fromTokenAddress = MAINNET_TOKENS[FROM_TOKEN];
    const toTokenAddress = MAINNET_TOKENS[TO_TOKEN];
    
    if (!fromTokenAddress || !toTokenAddress) {
      throw new Error(`Token address not found for ${FROM_TOKEN} or ${TO_TOKEN}`);
    }
    
    console.log(`Swapping ${FROM_TOKEN} to ${TO_TOKEN}`);
    console.log(`Token addresses: ${FROM_TOKEN}=${fromTokenAddress}, ${TO_TOKEN}=${toTokenAddress}`);
    console.log(`Using router at: ${router}`);
    console.log(`Using factory at: ${factory}`);
    
    // Get token decimals
    const fromTokenDecimals = TOKEN_DECIMALS[FROM_TOKEN];
    const toTokenDecimals = TOKEN_DECIMALS[TO_TOKEN];
    
    // Parse amount with correct decimals
    const amountIn = parseUnits(SWAP_AMOUNT, fromTokenDecimals);
    
    // Check initial balances
    const initialFromBalance = await publicClient.readContract({
      address: fromTokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    const initialToBalance = await publicClient.readContract({
      address: toTokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log("Initial balances:");
    console.log(`${FROM_TOKEN}: ${formatUnits(initialFromBalance, fromTokenDecimals)}`);
    console.log(`${TO_TOKEN}: ${formatUnits(initialToBalance, toTokenDecimals)}`);
    
    // Check if we have sufficient balance
    if (initialFromBalance < amountIn) {
      throw new Error(`Insufficient ${FROM_TOKEN} balance. Have ${formatUnits(initialFromBalance, fromTokenDecimals)}, need ${SWAP_AMOUNT}`);
    }
    
    // Get pair address to check if it exists
    const pairAddress = await publicClient.readContract({
      address: factory,
      abi: UniswapV2FactoryABI,
      functionName: "getPair",
      args: [fromTokenAddress, toTokenAddress],
    });
    
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error(`No liquidity pair exists for ${FROM_TOKEN}/${TO_TOKEN}. Add liquidity first.`);
    }
    
    console.log(`Pair address: ${pairAddress}`);
    
    // Check initial reserves
    const initialReserves = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "getReserves",
    });
    
    console.log("Initial reserves:");
    console.log(`Reserve0: ${formatEther(initialReserves[0])}`);
    console.log(`Reserve1: ${formatEther(initialReserves[1])}`);
    
    // Determine token order in the pair
    const token0 = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "token0",
    });
    
    const isFromToken0 = token0.toLowerCase() === fromTokenAddress.toLowerCase();
    console.log(`${FROM_TOKEN} is ${isFromToken0 ? 'token0' : 'token1'}`);
    
    // Get expected output amount using getAmountsOut
    const path = [fromTokenAddress, toTokenAddress];
    
    const amountsOut = await publicClient.readContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: "getAmountsOut",
      args: [amountIn, path],
    });
    
    const expectedOutput = amountsOut[1];
    console.log(`Expected output amount: ${formatUnits(expectedOutput, toTokenDecimals)} ${TO_TOKEN}`);
    
    // Calculate minimum output with slippage tolerance
    const minAmountOut = (expectedOutput * BigInt(Math.floor((100 - SLIPPAGE) * 1000))) / BigInt(100000);
    console.log(`Minimum output amount (${SLIPPAGE}% slippage): ${formatUnits(minAmountOut, toTokenDecimals)} ${TO_TOKEN}`);
    
    // Set deadline 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
    
    // Approve fromToken for router
    console.log(`Approving ${FROM_TOKEN} for router...`);
    const approveTx = await walletClient.writeContract({
      address: fromTokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [router, amountIn],
    });
    
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`${FROM_TOKEN} approved for router`);
    
    // Execute swap
    console.log("Executing swap with parameters:");
    console.log({
      amountIn: formatUnits(amountIn, fromTokenDecimals),
      minAmountOut: formatUnits(minAmountOut, toTokenDecimals),
      path: path,
      to: account.address,
      deadline: Number(deadline),
    });
    
    const swapTx = await walletClient.writeContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        minAmountOut,
        path,
        account.address,
        deadline,
      ],
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
    console.log("Swap executed successfully", { transactionHash: swapTx });
    
    // Check final balances
    const finalFromBalance = await publicClient.readContract({
      address: fromTokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    const finalToBalance = await publicClient.readContract({
      address: toTokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log("Final balances:");
    console.log(`${FROM_TOKEN}: ${formatUnits(finalFromBalance, fromTokenDecimals)}`);
    console.log(`${TO_TOKEN}: ${formatUnits(finalToBalance, toTokenDecimals)}`);
    
    console.log(`${FROM_TOKEN} spent: ${formatUnits(initialFromBalance - finalFromBalance, fromTokenDecimals)}`);
    console.log(`${TO_TOKEN} received: ${formatUnits(finalToBalance - initialToBalance, toTokenDecimals)}`);
    
    // Check final reserves
    const finalReserves = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "getReserves",
    });
    
    console.log("Final reserves:");
    console.log(`Reserve0: ${formatEther(finalReserves[0])}`);
    console.log(`Reserve1: ${formatEther(finalReserves[1])}`);
    
  } catch (error) {
    console.error("Error during swap:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });