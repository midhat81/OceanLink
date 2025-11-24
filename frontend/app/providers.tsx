'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http, defineChain } from 'wagmi'
import { baseSepolia, arbitrumSepolia, localhost } from 'wagmi/chains'
import { injected, metaMaskSafe } from 'wagmi/connectors'
import { useState } from 'react'

// Define custom localhost chains with different chain IDs
const localhostBase = defineChain({
  ...localhost,
  id: 31337,
  name: 'Localhost Base',
})

const localhostArbitrum = defineChain({
  ...localhost,
  id: 31338,
  name: 'Localhost Arbitrum',
})

const config = createConfig({
  chains: [baseSepolia, arbitrumSepolia, localhostBase, localhostArbitrum],
  connectors: [
    injected(),
    metaMaskSafe(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [arbitrumSepolia.id]: http(),
    [localhostBase.id]: http(),
    [localhostArbitrum.id]: http(),
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

