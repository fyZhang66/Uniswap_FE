const { createPublicClient, http } = require('viem');
const { createWalletClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { hardhat } = require('viem/chains');
require('dotenv').config();

// Environment detection - set this to 'tenderly' or 'hardhat'
const ENV = process.env.BLOCKCHAIN_ENV || 'hardhat';
console.log('Environment:', ENV);

// Tenderly configuration
const TENDERLY_RPC_URL = "https://virtual.mainnet.rpc.tenderly.co/4cbb7988-0b91-409b-bbb0-ccee52c414e6";
const TENDERLY_CUSTOM_ADDRESS = "0x91c2F30bc8f156B345B166c9b1F31C4acf7f2163";

// Hardhat configuration
const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Chain configuration
const getTenderlyChain = () => ({
  id: 1, // Ethereum mainnet ID
  rpcUrls: {
    default: {
      http: [TENDERLY_RPC_URL],
    },
  },
});

// Account configuration
const getAccount = () => {
  if (ENV === 'tenderly') {
    return { address: TENDERLY_CUSTOM_ADDRESS };
  } else {
    return privateKeyToAccount(HARDHAT_PRIVATE_KEY);
  }
};

// Public client configuration
const getPublicClient = () => {
  if (ENV === 'tenderly') {
    return createPublicClient({
      chain: getTenderlyChain(),
      transport: http(),
    });
  } else {
    return createPublicClient({
      chain: hardhat,
      transport: http(),
    });
  }
};

// Wallet client configuration
const getWalletClient = () => {
  const account = getAccount();
  
  if (ENV === 'tenderly') {
    return createWalletClient({
      account,
      chain: getTenderlyChain(),
      transport: http(),
    });
  } else {
    return createWalletClient({
      account,
      chain: hardhat,
      transport: http(),
    });
  }
};

module.exports = {
  getAccount,
  getPublicClient,
  getWalletClient,
};