import React from 'react';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { mainnet, goerli, localhost } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { UniswapInterface } from './components/UniswapInterface';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet, goerli, localhost],
  [publicProvider()]
);

const config = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
  connectors: [
    new MetaMaskConnector({
      chains,
      options: {
        shimDisconnect: true,
      },
    }),
  ],
});

function App() {
  return (
    <WagmiConfig config={config}>
      <div className="App">
        <header className="App-header">
          <h1>Uniswap V2 Interface</h1>
        </header>
        <main>
          <UniswapInterface />
        </main>
      </div>
    </WagmiConfig>
  );
}

export default App; 