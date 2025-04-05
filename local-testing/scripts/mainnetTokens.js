// mainnetTokens.js
// Configuration file for public token addresses on Ethereum mainnet

// Mainnet token addresses
const MAINNET_TOKENS = {
    // Ethereum and wrapped ETH
    ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Special placeholder for ETH
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    
    // Stablecoins
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    
    // Other popular tokens
    SHIB: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  };
  
  // Token decimals for common tokens (to avoid extra RPC calls)
  const TOKEN_DECIMALS = {
    ETH: 18,
    WETH: 18,
    USDC: 6,
    USDT: 6,
    DAI: 18,
    SHIB: 18,
    UNI: 18,
    LINK: 18,
  };
  
  // ABI for ERC20 tokens - using proper viem format
  const ERC20_ABI = [
    {
      name: "name",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }]
    },
    {
      name: "symbol",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "string" }]
    },
    {
      name: "decimals",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint8" }]
    },
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ type: "address", name: "owner" }],
      outputs: [{ type: "uint256" }]
    },
    {
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [
        { type: "address", name: "owner" },
        { type: "address", name: "spender" }
      ],
      outputs: [{ type: "uint256" }]
    },
    {
      name: "approve",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { type: "address", name: "spender" },
        { type: "uint256", name: "value" }
      ],
      outputs: [{ type: "bool" }]
    },
    {
      name: "transfer",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { type: "address", name: "to" },
        { type: "uint256", name: "value" }
      ],
      outputs: [{ type: "bool" }]
    },
    {
      name: "transferFrom",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { type: "address", name: "from" },
        { type: "address", name: "to" },
        { type: "uint256", name: "value" }
      ],
      outputs: [{ type: "bool" }]
    }
  ];
  
  // ABI for WETH (extends ERC20 with deposit/withdraw)
  const WETH_ABI = [
    ...ERC20_ABI,
    {
      name: "deposit",
      type: "function",
      stateMutability: "payable",
      inputs: [],
      outputs: []
    },
    {
      name: "withdraw",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [{ type: "uint256", name: "wad" }],
      outputs: []
    }
  ];
  
  module.exports = {
    MAINNET_TOKENS,
    TOKEN_DECIMALS,
    ERC20_ABI,
    WETH_ABI
  };