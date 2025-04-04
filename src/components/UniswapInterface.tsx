import React, { useState } from 'react';
import { useMintTokens, useAddLiquidity, useSwap, useVerify } from '../hooks/useUniswap';

export function UniswapInterface() {
  const [mintAmount, setMintAmount] = useState('1000');
  const [liquidityAmount1, setLiquidityAmount1] = useState('1000');
  const [liquidityAmount2, setLiquidityAmount2] = useState('1000');
  const [swapAmount, setSwapAmount] = useState('100');
  const [swapMinOut, setSwapMinOut] = useState('99');

  const { mintTokens, isMinting } = useMintTokens();
  const { addLiquidity, isApproving, isMinting: isAddingLiquidity } = useAddLiquidity();
  const { performSwap, isApproving: isApprovingSwap, isSwapping } = useSwap();
  const { token1Balance, token2Balance, reserves } = useVerify();

  const handleMint = async () => {
    try {
      await mintTokens(mintAmount);
    } catch (error) {
      console.error('Minting failed:', error);
    }
  };

  const handleAddLiquidity = async () => {
    try {
      await addLiquidity(liquidityAmount1, liquidityAmount2);
    } catch (error) {
      console.error('Adding liquidity failed:', error);
    }
  };

  const handleSwap = async () => {
    try {
      await performSwap(swapAmount, swapMinOut);
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  return (
    <div className="uniswap-interface">
      <div className="section">
        <h2>Mint Tokens</h2>
        <input
          type="text"
          value={mintAmount}
          onChange={(e) => setMintAmount(e.target.value)}
          placeholder="Amount to mint"
        />
        <button onClick={handleMint} disabled={isMinting}>
          {isMinting ? 'Minting...' : 'Mint Tokens'}
        </button>
      </div>

      <div className="section">
        <h2>Add Liquidity</h2>
        <input
          type="text"
          value={liquidityAmount1}
          onChange={(e) => setLiquidityAmount1(e.target.value)}
          placeholder="Token 1 amount"
        />
        <input
          type="text"
          value={liquidityAmount2}
          onChange={(e) => setLiquidityAmount2(e.target.value)}
          placeholder="Token 2 amount"
        />
        <button 
          onClick={handleAddLiquidity} 
          disabled={isApproving || isAddingLiquidity}
        >
          {isApproving ? 'Approving...' : isAddingLiquidity ? 'Adding Liquidity...' : 'Add Liquidity'}
        </button>
      </div>

      <div className="section">
        <h2>Swap</h2>
        <input
          type="text"
          value={swapAmount}
          onChange={(e) => setSwapAmount(e.target.value)}
          placeholder="Amount in"
        />
        <input
          type="text"
          value={swapMinOut}
          onChange={(e) => setSwapMinOut(e.target.value)}
          placeholder="Minimum amount out"
        />
        <button 
          onClick={handleSwap} 
          disabled={isApprovingSwap || isSwapping}
        >
          {isApprovingSwap ? 'Approving...' : isSwapping ? 'Swapping...' : 'Swap'}
        </button>
      </div>

      <div className="section">
        <h2>Current State</h2>
        <p>Token 1 Balance: {token1Balance}</p>
        <p>Token 2 Balance: {token2Balance}</p>
        {reserves && (
          <>
            <p>Reserve 0: {reserves.reserve0}</p>
            <p>Reserve 1: {reserves.reserve1}</p>
          </>
        )}
      </div>
    </div>
  );
} 