const hre = require("hardhat");

async function main() {
  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  // Get contract instances
  const token1Address = "0x74Ce26A2e4c1368C48A0157CE762944d282896Db";
  const token2Address = "0x7c77704007C9996Ee591C516f7319828BA49d91E";
  const factoryAddress = "0x676F5F71DAE1C83Dc31775E4c61212bC9e799d9C";

  const Token1 = await hre.ethers.getContractAt("TestToken", token1Address);
  const Token2 = await hre.ethers.getContractAt("TestToken", token2Address);
  const Factory = await hre.ethers.getContractAt("UniswapV2Factory", factoryAddress);

  // Check token balances
  const token1Balance = await Token1.balanceOf(signerAddress);
  const token2Balance = await Token2.balanceOf(signerAddress);

  console.log("Token1 balance:", hre.ethers.formatEther(token1Balance));
  console.log("Token2 balance:", hre.ethers.formatEther(token2Balance));

  // Get pair address
  const pairAddress = await Factory.getPair(token1Address, token2Address);
  console.log("Pair address:", pairAddress);

  if (pairAddress !== hre.ethers.ZeroAddress) {
    const Pair = await hre.ethers.getContractAt("UniswapV2Pair", pairAddress);
    const reserves = await Pair.getReserves();
    console.log("Pair reserves:", {
      reserve0: hre.ethers.formatEther(reserves[0]),
      reserve1: hre.ethers.formatEther(reserves[1])
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 