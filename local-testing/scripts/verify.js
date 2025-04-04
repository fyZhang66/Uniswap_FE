const hre = require("hardhat");

async function main() {
  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  try {
    // Read the deployed addresses
    const fs = require('fs');
    let deployedAddresses;
    
    try {
      deployedAddresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
      console.log('Found deployed-addresses.json file');
    } catch (error) {
      console.log('No deployed-addresses.json file found, using hardcoded addresses');
    }

    const { token1: token1Address, token2: token2Address, factory: factoryAddress, router: routerAddress, pair: pairAddress } = deployedAddresses;

    console.log("Verifying contract addresses:");
    console.log("Token1:", token1Address);
    console.log("Token2:", token2Address);
    console.log("Factory:", factoryAddress);
    
    if (routerAddress) {
      console.log("Router:", routerAddress);
    } else {
      console.log("Router address not found in deployed-addresses.json");
    }

    // Get contract instances
    const Token1 = await hre.ethers.getContractAt("TestToken", token1Address);
    const Token2 = await hre.ethers.getContractAt("TestToken", token2Address);
    const Factory = await hre.ethers.getContractAt("UniswapV2Factory", factoryAddress);

    // Check token balances
    const token1Balance = await Token1.balanceOf(signerAddress);
    const token2Balance = await Token2.balanceOf(signerAddress);

    console.log("\nToken balances:");
    console.log("Token1 balance:", hre.ethers.formatEther(token1Balance));
    console.log("Token2 balance:", hre.ethers.formatEther(token2Balance));

    // Get pair address (either from deployed-addresses.json or from factory)
    let verifiedPairAddress;
    if (pairAddress) {
      verifiedPairAddress = pairAddress;
      console.log("\nPair address from file:", verifiedPairAddress);
    } else {
      verifiedPairAddress = await Factory.getPair(token1Address, token2Address);
      console.log("\nPair address from factory:", verifiedPairAddress);
    }

    if (verifiedPairAddress !== hre.ethers.ZeroAddress) {
      const Pair = await hre.ethers.getContractAt("UniswapV2Pair", verifiedPairAddress);
      const reserves = await Pair.getReserves();
      
      console.log("\nPair reserves:");
      console.log({
        reserve0: hre.ethers.formatEther(reserves[0]),
        reserve1: hre.ethers.formatEther(reserves[1])
      });

      // Check user's liquidity position
      const liquidityBalance = await Pair.balanceOf(signerAddress);
      console.log("\nLiquidity tokens owned:", hre.ethers.formatEther(liquidityBalance));
    } else {
      console.log("\nNo pair exists for these tokens yet");
    }

    // Verify router if available
    if (routerAddress) {
      const Router = await hre.ethers.getContractAt("UniswapV2Router", routerAddress);
      const routerFactory = await Router.factory();
      
      console.log("\nRouter information:");
      console.log("Router factory address:", routerFactory);
      console.log("Factory matches router's factory:", routerFactory === factoryAddress);

      if (verifiedPairAddress !== hre.ethers.ZeroAddress) {
        // Test quote function on router
        try {
          const Pair = await hre.ethers.getContractAt("UniswapV2Pair", verifiedPairAddress);
          const reserves = await Pair.getReserves();
          const testAmount = hre.ethers.parseEther("1"); // 1 token
          
          const quote = await Router.quote(testAmount, reserves[0], reserves[1]);
          console.log("\nRouter quote test:");
          console.log("Amount in:", hre.ethers.formatEther(testAmount));
          console.log("Quoted amount out:", hre.ethers.formatEther(quote));
        } catch (error) {
          console.log("\nError testing router quote function:", error.message);
        }
      }
    }

  } catch (error) {
    console.error("Error verifying contracts:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });