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
const TOKEN_A = 'WETH';   // First token 
const TOKEN_B = 'USDC';   // Second token

// Percentage of LP tokens to remove (0.5 = 50%)
const LIQUIDITY_PERCENTAGE = 0.5;
// ===================================================

// Contract ABIs (from your artifacts)
const UniswapV2RouterABI = require("../artifacts/contracts/UniswapV2Router.sol/UniswapV2Router.json").abi;
const UniswapV2FactoryABI = require("../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json").abi;
const UniswapV2PairABI = require("../artifacts/contracts/UniswapV2Pair.sol/UniswapV2Pair.json").abi;

async function main() {
  try {
    console.log("Starting to remove liquidity for public tokens...");
    console.log(`Account: ${account.address}`);
    
    // Get token addresses from mainnet config
    const tokenAAddress = MAINNET_TOKENS[TOKEN_A];
    const tokenBAddress = MAINNET_TOKENS[TOKEN_B];
    
    if (!tokenAAddress || !tokenBAddress) {
      throw new Error(`Token address not found for ${TOKEN_A} or ${TOKEN_B}`);
    }
    
    console.log(`Removing liquidity for ${TOKEN_A}/${TOKEN_B}`);
    console.log(`Token addresses: ${TOKEN_A}=${tokenAAddress}, ${TOKEN_B}=${tokenBAddress}`);
    console.log(`Using router at: ${router}`);
    console.log(`Using factory at: ${factory}`);
    
    // Get token decimals
    const tokenADecimals = TOKEN_DECIMALS[TOKEN_A];
    const tokenBDecimals = TOKEN_DECIMALS[TOKEN_B];
    
    // Check initial token balances
    const initialBalanceA = await publicClient.readContract({
      address: tokenAAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    const initialBalanceB = await publicClient.readContract({
      address: tokenBAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log("Initial token balances:");
    console.log(`${TOKEN_A}: ${formatUnits(initialBalanceA, tokenADecimals)}`);
    console.log(`${TOKEN_B}: ${formatUnits(initialBalanceB, tokenBDecimals)}`);
    
    // Get pair address
    const pairAddress = await publicClient.readContract({
      address: factory,
      abi: UniswapV2FactoryABI,
      functionName: "getPair",
      args: [tokenAAddress, tokenBAddress],
    });
    
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error(`No liquidity pair exists for ${TOKEN_A}/${TOKEN_B}`);
    }
    
    console.log(`Pair address: ${pairAddress}`);
    
    // Check liquidity token balance
    const liquidityBalance = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log(`Liquidity token balance: ${formatEther(liquidityBalance)}`);
    
    if (liquidityBalance <= BigInt(0)) {
      throw new Error(`No liquidity tokens to remove. Add liquidity first.`);
    }
    
    // Check initial reserves
    const initialReserves = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "getReserves",
    });
    
    console.log("Initial pool reserves:");
    console.log(`Reserve0: ${formatEther(initialReserves[0])}`);
    console.log(`Reserve1: ${formatEther(initialReserves[1])}`);
    
    // Determine token order in the pair
    const token0 = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "token0",
    });
    
    const isTokenAToken0 = token0.toLowerCase() === tokenAAddress.toLowerCase();
    console.log(`${TOKEN_A} is ${isTokenAToken0 ? 'token0' : 'token1'}`);
    
    // Calculate amount of LP tokens to remove
    const liquidityToRemove = (liquidityBalance * BigInt(Math.floor(LIQUIDITY_PERCENTAGE * 100000))) / BigInt(100000);
    console.log(`Removing ${LIQUIDITY_PERCENTAGE * 100}% of liquidity: ${formatEther(liquidityToRemove)} LP tokens`);
    
    // Set minimum amounts and deadline
    const minAmountA = BigInt(0); // Accept any amount for simplicity
    const minAmountB = BigInt(0); // Accept any amount for simplicity
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes from now
    
    // Approve liquidity tokens for router
    console.log(`Approving liquidity tokens for router...`);
    const approveTx = await walletClient.writeContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "approve",
      args: [router, liquidityToRemove],
    });
    
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log("Liquidity tokens approved for router");
    
    // Remove liquidity
    console.log("Removing liquidity with parameters:");
    console.log({
      tokenA: tokenAAddress,
      tokenB: tokenBAddress,
      liquidity: formatEther(liquidityToRemove),
      minAmountA: formatUnits(minAmountA, tokenADecimals),
      minAmountB: formatUnits(minAmountB, tokenBDecimals),
      to: account.address,
      deadline: Number(deadline),
    });
    
    const removeLiquidityTx = await walletClient.writeContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: "removeLiquidity",
      args: [
        tokenAAddress,
        tokenBAddress,
        liquidityToRemove,
        minAmountA,
        minAmountB,
        account.address,
        deadline,
      ],
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: removeLiquidityTx });
    console.log("Liquidity removed successfully", { transactionHash: removeLiquidityTx });
    
    // Check final token balances
    const finalBalanceA = await publicClient.readContract({
      address: tokenAAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    const finalBalanceB = await publicClient.readContract({
      address: tokenBAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log("Final token balances:");
    console.log(`${TOKEN_A}: ${formatUnits(finalBalanceA, tokenADecimals)}`);
    console.log(`${TOKEN_B}: ${formatUnits(finalBalanceB, tokenBDecimals)}`);
    
    console.log("Token amounts received:");
    console.log(`${TOKEN_A}: ${formatUnits(finalBalanceA - initialBalanceA, tokenADecimals)}`);
    console.log(`${TOKEN_B}: ${formatUnits(finalBalanceB - initialBalanceB, tokenBDecimals)}`);
    
    // Check final liquidity token balance
    const finalLiquidityBalance = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log(`Final liquidity token balance: ${formatEther(finalLiquidityBalance)}`);
    console.log(`LP tokens removed: ${formatEther(liquidityBalance - finalLiquidityBalance)}`);
    
    // Check final reserves
    const finalReserves = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "getReserves",
    });
    
    console.log("Final pool reserves:");
    console.log(`Reserve0: ${formatEther(finalReserves[0])}`);
    console.log(`Reserve1: ${formatEther(finalReserves[1])}`);
    
  } catch (error) {
    console.error("Error while removing liquidity:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });