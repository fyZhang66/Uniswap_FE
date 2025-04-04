const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require('fs');

const CUSTOM_ADDRESS = "0x91c2F30bc8f156B345B166c9b1F31C4acf7f2163"

async function main() {
  try {
    // Get the signer
    // const [signer] = await hre.ethers.getSigners();
    // const signerAddress = await signer.getAddress();
    const signerAddress = CUSTOM_ADDRESS;
    console.log("Using signer address:", signerAddress);

    // Read deployed addresses
    const addresses = JSON.parse(fs.readFileSync('deployed-addresses.json', 'utf8'));
    const { token1, token2 } = addresses;

    console.log("Connecting to tokens...");
    const Token1 = await hre.ethers.getContractAt("TestToken", token1);
    const Token2 = await hre.ethers.getContractAt("TestToken", token2);

    // Amount to mint (in wei)
    const amount = ethers.parseEther("10000"); // 10,000 tokens each

    // Check current balances
    console.log("Current balances:");
    const balance1 = await Token1.balanceOf(signerAddress);
    const balance2 = await Token2.balanceOf(signerAddress);
    console.log({
      token1: ethers.formatEther(balance1),
      token2: ethers.formatEther(balance2)
    });

    // Mint tokens
    console.log("Minting tokens...");
    const mintTx1 = await Token1.mint(signerAddress, amount);
    await mintTx1.wait();
    console.log("Token1 minted successfully");

    const mintTx2 = await Token2.mint(signerAddress, amount);
    await mintTx2.wait();
    console.log("Token2 minted successfully");

    // Check new balances
    console.log("New balances:");
    const newBalance1 = await Token1.balanceOf(signerAddress);
    const newBalance2 = await Token2.balanceOf(signerAddress);
    console.log({
      token1: ethers.formatEther(newBalance1),
      token2: ethers.formatEther(newBalance2)
    });

  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });