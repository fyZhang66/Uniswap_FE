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

// Amounts to add as liquidity
const AMOUNT_A = '1';  // Amount of first token
const AMOUNT_B = '2000';    // Amount of second token (this should be priced appropriately)
// ===================================================

// Contract ABIs (from your artifacts)
const UniswapV2RouterABI = require("../artifacts/contracts/UniswapV2Router.sol/UniswapV2Router.json").abi;
const UniswapV2FactoryABI = require("../artifacts/contracts/UniswapV2Factory.sol/UniswapV2Factory.json").abi;
const UniswapV2PairABI = require("../artifacts/contracts/UniswapV2Pair.sol/UniswapV2Pair.json").abi;

async function main() {
  try {
    console.log("Starting router liquidity addition with public tokens...");
    console.log(`Account: ${account.address}`);
    
    // Get token addresses from mainnet config
    const tokenAAddress = MAINNET_TOKENS[TOKEN_A];
    const tokenBAddress = MAINNET_TOKENS[TOKEN_B];
    
    if (!tokenAAddress || !tokenBAddress) {
      throw new Error(`Token address not found for ${TOKEN_A} or ${TOKEN_B}`);
    }
    
    console.log(`Adding liquidity for ${TOKEN_A}/${TOKEN_B}`);
    console.log(`Token addresses: ${TOKEN_A}=${tokenAAddress}, ${TOKEN_B}=${tokenBAddress}`);
    console.log(`Using router at: ${router}`);
    console.log(`Using factory at: ${factory}`);

    // Get token decimals
    const tokenADecimals = TOKEN_DECIMALS[TOKEN_A];
    const tokenBDecimals = TOKEN_DECIMALS[TOKEN_B];
    
    // Parse amounts with correct decimals
    const amountA = parseUnits(AMOUNT_A, tokenADecimals);
    const amountB = parseUnits(AMOUNT_B, tokenBDecimals);
    
    // Check initial balances
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
    
    console.log("Initial balances:");
    console.log(`${TOKEN_A}: ${formatUnits(initialBalanceA, tokenADecimals)}`);
    console.log(`${TOKEN_B}: ${formatUnits(initialBalanceB, tokenBDecimals)}`);
    
    // Check if we have sufficient balances
    if (initialBalanceA < amountA) {
      throw new Error(`Insufficient ${TOKEN_A} balance. Have ${formatUnits(initialBalanceA, tokenADecimals)}, need ${AMOUNT_A}`);
    }
    
    if (initialBalanceB < amountB) {
      throw new Error(`Insufficient ${TOKEN_B} balance. Have ${formatUnits(initialBalanceB, tokenBDecimals)}, need ${AMOUNT_B}`);
    }

    // Check initial reserves if pair exists
    let pairAddress = await publicClient.readContract({
      address: factory,
      abi: UniswapV2FactoryABI,
      functionName: "getPair",
      args: [tokenAAddress, tokenBAddress],
    });
    
    let hasExistingLiquidity = false;
    
    if (pairAddress !== "0x0000000000000000000000000000000000000000") {
      console.log(`Pair exists at ${pairAddress}`);
      
      try {
        const initialReserves = await publicClient.readContract({
          address: pairAddress,
          abi: UniswapV2PairABI,
          functionName: "getReserves",
        });
        
        const reserve0 = initialReserves[0];
        const reserve1 = initialReserves[1];
        
        console.log("Initial reserves:");
        console.log(`Reserve0: ${formatEther(reserve0)}`);
        console.log(`Reserve1: ${formatEther(reserve1)}`);
        
        if (reserve0 > 0 && reserve1 > 0) {
          hasExistingLiquidity = true;
          
          // Determine token order in the pair
          const token0 = await publicClient.readContract({
            address: pairAddress,
            abi: UniswapV2PairABI,
            functionName: "token0",
          });
          
          const isTokenAToken0 = token0.toLowerCase() === tokenAAddress.toLowerCase();
          console.log(`${TOKEN_A} is ${isTokenAToken0 ? 'token0' : 'token1'}`);
          
          // For accurate liquidity addition, you might want to adjust amounts 
          // to match the existing ratio, but we'll keep the specified amounts for simplicity
        }
      } catch (error) {
        console.log("Error getting reserves:", error.message);
      }
    } else {
      console.log("Pair doesn't exist yet, it will be created during addLiquidity");
    }
    
    // Set minimum amounts (1% slippage tolerance)
    const minAmountA = (amountA * BigInt(99)) / BigInt(100);
    const minAmountB = (amountB * BigInt(99)) / BigInt(100);
    
    // Set deadline 20 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
    
    // Approve tokens for router
    console.log(`Approving ${TOKEN_A} for router...`);
    const approveTxA = await walletClient.writeContract({
      address: tokenAAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [router, amountA],
    });
    
    await publicClient.waitForTransactionReceipt({ hash: approveTxA });
    console.log(`${TOKEN_A} approved for router`);
    
    console.log(`Approving ${TOKEN_B} for router...`);
    const approveTxB = await walletClient.writeContract({
      address: tokenBAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [router, amountB],
    });
    
    await publicClient.waitForTransactionReceipt({ hash: approveTxB });
    console.log(`${TOKEN_B} approved for router`);
    
    // Add liquidity through router
    console.log("Adding liquidity with parameters:");
    console.log({
      tokenA: tokenAAddress,
      tokenB: tokenBAddress,
      amountA: formatUnits(amountA, tokenADecimals),
      amountB: formatUnits(amountB, tokenBDecimals),
      minAmountA: formatUnits(minAmountA, tokenADecimals),
      minAmountB: formatUnits(minAmountB, tokenBDecimals),
      to: account.address,
      deadline: Number(deadline),
    });
    
    const addLiquidityTx = await walletClient.writeContract({
      address: router,
      abi: UniswapV2RouterABI,
      functionName: "addLiquidity",
      args: [
        tokenAAddress,
        tokenBAddress,
        amountA,
        amountB,
        minAmountA,
        minAmountB,
        account.address,
        deadline,
      ],
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: addLiquidityTx,
    });
    
    console.log("Liquidity added successfully", {
      transactionHash: addLiquidityTx,
    });
    
    // Get updated pair address (in case it was just created)
    pairAddress = await publicClient.readContract({
      address: factory,
      abi: UniswapV2FactoryABI,
      functionName: "getPair",
      args: [tokenAAddress, tokenBAddress],
    });
    console.log(`First created Pair address: ${pairAddress}`);
    
    // Check final balances
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
    
    console.log("Final balances:");
    console.log(`${TOKEN_A}: ${formatUnits(finalBalanceA, tokenADecimals)}`);
    console.log(`${TOKEN_B}: ${formatUnits(finalBalanceB, tokenBDecimals)}`);
    
    console.log("Token amounts spent:");
    console.log(`${TOKEN_A}: ${formatUnits(initialBalanceA - finalBalanceA, tokenADecimals)}`);
    console.log(`${TOKEN_B}: ${formatUnits(initialBalanceB - finalBalanceB, tokenBDecimals)}`);
    
    // Check LP token balance
    const liquidityBalance = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    
    console.log(`Liquidity tokens received: ${formatEther(liquidityBalance)}`);
    
    // Get final reserves
    const finalReserves = await publicClient.readContract({
      address: pairAddress,
      abi: UniswapV2PairABI,
      functionName: "getReserves",
    });
    
    console.log("Final reserves:");
    console.log(`Reserve0: ${formatEther(finalReserves[0])}`);
    console.log(`Reserve1: ${formatEther(finalReserves[1])}`);
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });