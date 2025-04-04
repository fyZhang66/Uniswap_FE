Router Contract Testing Guide
Overview
This document describes the testing process for our Uniswap V2 implementation with a focus on the Router contract, which provides a safer and more convenient interface for interacting with the protocol.
Contracts Implemented

UniswapV2Router: Abstracts complex interactions with the protocol, handling token swaps and liquidity management with safety features
UniswapV2Library: Helper library with functions for price calculations and path handling
Interface files: IUniswapV2Factory.sol, IUniswapV2Pair.sol, and IERC20.sol

Testing Process
Step 1: Deployment
Run the deployment script to set up all contracts:
npx hardhat run scripts/deploy.js --network localhost

This script:
Deploys ERC20 test tokens
Deploys the UniswapV2Factory contract
Creates a pair between the test tokens
Deploys the UniswapV2Router contract
Mints initial tokens to your address
Saves all contract addresses to deployed-addresses.json

Step 2: Add Liquidity
Test adding liquidity through the router:
npx hardhat run scripts/routerAddLiquidity.js --network localhost

This script:
approves tokens for the router
Adds liquidity to the pair through the router
Verifies token balances and pool reserves
Shows the liquidity tokens received

Step 3: Swap Tokens
Test token swapping through the router:
npx hardhat run scripts/routerSwap.js --network localhost
This script:

Calculates expected output amount
Approves tokens for the router
Executes a token swap with slippage protection
Verifies balances and reserves after the swap

Step 4: Remove Liquidity
Test removing liquidity through the router:
npx hardhat run scripts/routerRemoveLiquidity.js --network localhost

This script:
Approves liquidity tokens for the router
Removes half of the liquidity
Verifies returned token amounts
Shows updated balances and reserves

Key Router Features
Simplified Interface: The router provides a single contract for all common operations.
Safety Features:
Deadline parameters to prevent stale transactions
Minimum output amounts to protect against slippage
Optimal amount calculations for liquidity provision


Common Issues and Solutions

Insufficient Output Amount Error:

Problem: Swap fails due to price impact exceeding slippage tolerance
Solution: Increase slippage tolerance or reduce swap size relative to pool liquidity


The router improves upon direct pair interaction by:
Calculating optimal token amounts automatically
Handling token transfers and interactions with the pair
Providing slippage protection
Supporting deadline parameters to prevent transaction delay issues
Offering consistent interface for all operations

This testing process verifies that all router functionality works correctly with the underlying Uniswap V2 implementation.