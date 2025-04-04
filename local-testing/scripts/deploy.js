const hre = require("hardhat");

async function main() {
  try {
    // Get the signer
    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();
    console.log("Using signer address:", signerAddress);

    // Deploy TestToken1
    console.log("Deploying TestToken1...");
    const Token1 = await hre.ethers.getContractFactory("TestToken");
    const token1 = await Token1.deploy("Test Token 1", "TEST1", 0);
    await token1.waitForDeployment();
    const token1Address = await token1.getAddress();
    console.log("TestToken1 deployed to:", token1Address);

    // Deploy TestToken2
    console.log("Deploying TestToken2...");
    const Token2 = await hre.ethers.getContractFactory("TestToken");
    const token2 = await Token2.deploy("Test Token 2", "TEST2", 0);
    await token2.waitForDeployment();
    const token2Address = await token2.getAddress();
    console.log("TestToken2 deployed to:", token2Address);

    // Deploy UniswapV2Factory
    console.log("Deploying UniswapV2Factory...");
    const Factory = await hre.ethers.getContractFactory("UniswapV2Factory");
    const factory = await Factory.deploy(signerAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log("UniswapV2Factory deployed to:", factoryAddress);

    // Create a pair between the two tokens
    console.log("Creating pair...");
    const createPairTx = await factory.createPair(token1Address, token2Address);
    await createPairTx.wait();
    const pairAddress = await factory.getPair(token1Address, token2Address);
    console.log("Pair created at:", pairAddress);

    // Mint initial tokens to the signer
    console.log("Minting initial tokens...");
    const mintAmount = hre.ethers.parseEther("10000");
    const mintTx1 = await token1.mint(signerAddress, mintAmount);
    await mintTx1.wait();
    const mintTx2 = await token2.mint(signerAddress, mintAmount);
    await mintTx2.wait();
    console.log("Initial tokens minted successfully");

    // Log final addresses for reference
    console.log("\nContract addresses:");
    console.log("Token1:", token1Address);
    console.log("Token2:", token2Address);
    console.log("Factory:", factoryAddress);
    console.log("Pair:", pairAddress);

    // Save addresses to a file for later use
    const fs = require('fs');
    const addresses = {
      token1: token1Address,
      token2: token2Address,
      factory: factoryAddress,
      pair: pairAddress
    };
    fs.writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
    console.log("\nAddresses saved to deployed-addresses.json");

  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 