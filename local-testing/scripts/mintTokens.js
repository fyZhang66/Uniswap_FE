const hre = require("hardhat");

async function main() {
  try {
    // Get the signer
    const [signer] = await hre.ethers.getSigners();
    const signerAddress = await signer.getAddress();
    console.log("Using signer address:", signerAddress);

    // Get contract instances
    const token1Address = "0x74Ce26A2e4c1368C48A0157CE762944d282896Db";
    const token2Address = "0x7c77704007C9996Ee591C516f7319828BA49d91E";
    const factoryAddress = "0x676F5F71DAE1C83Dc31775E4c61212bC9e799d9C";

    console.log("Connecting to tokens...");
    const Token1 = await hre.ethers.getContractAt("TestToken", token1Address);
    const Token2 = await hre.ethers.getContractAt("TestToken", token2Address);

    // Amount to mint (in wei)
    const amount = hre.ethers.parseEther("10000"); // 10,000 tokens each

    // Check current balances
    console.log("Current balances:");
    const balance1 = await Token1.balanceOf(signerAddress);
    const balance2 = await Token2.balanceOf(signerAddress);
    console.log({
      token1: hre.ethers.formatEther(balance1),
      token2: hre.ethers.formatEther(balance2)
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
      token1: hre.ethers.formatEther(newBalance1),
      token2: hre.ethers.formatEther(newBalance2)
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