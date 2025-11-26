# Deposit and Withdraw Scripts

TypeScript scripts for interacting with the Vault contract to deposit and withdraw tokens.

## Setup

1. Install dependencies:
```bash
cd backend/scripts
pnpm install
```

2. Create a `.env` file with the following variables:
```env
# Base Sepolia
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/iJNCam89D3waZumSzuSgR
BASE_TOKEN_ADDRESS=0xCdBb9C109Da8FF1423C753A9D4cEb85d680DC0fa
BASE_VAULT_ADDRESS=0xAa7A0f08cF8E7456DEb46A09a9C77b531C278f3c

# Sepolia
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/iJNCam89D3waZumSzuSgR
SEPOLIA_TOKEN_ADDRESS=0xDB6676239269Ae5b8665d9eF9656D6b272A8C7A8
SEPOLIA_VAULT_ADDRESS=0x3A0568585d83cb3c5349B9aB0F957Ec054177dB0

# Arbitrum Sepolia
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBITRUM_TOKEN_ADDRESS=0x... # Set your Arbitrum token address
ARBITRUM_VAULT_ADDRESS=0x... # Set your Arbitrum Vault address
```

## Usage

### Deposit

Deposit tokens into the Vault contract:

```bash
tsx deposit.ts <chainId> <amount> <privateKey>
```

**Examples:**
```bash
# Deposit 100 USDT to Base Sepolia
tsx deposit.ts 84532 100.0 0xYourPrivateKey

# Deposit 50 USDT to Sepolia
tsx deposit.ts 11155111 50.0 0xYourPrivateKey
```

**Supported chains:**
- `84532` - Base Sepolia
- `11155111` - Sepolia
- `421614` - Arbitrum Sepolia
- `31337` - Localhost Base
- `31338` - Localhost Sepolia
- `31339` - Localhost Arbitrum

### Withdraw

Withdraw tokens from the Vault contract:

```bash
tsx withdraw.ts <chainId> <amount> <privateKey>
```

**Examples:**
```bash
# Withdraw 100 USDT from Base Sepolia
tsx withdraw.ts 84532 100.0 0xYourPrivateKey

# Withdraw 50 USDT from Sepolia
tsx withdraw.ts 11155111 50.0 0xYourPrivateKey
```

## Notes

- Amounts are specified in USDT (6 decimals)
- The deposit script will automatically approve token spending before depositing
- Make sure you have sufficient token balance before depositing
- Make sure you have sufficient vault balance before withdrawing
- Private keys should start with `0x`

