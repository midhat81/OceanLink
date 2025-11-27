# feeder

Minimal feeder demo for the OceanLink cross-chain stablecoin netting protocol.

## What it does

- Mints 1B mock USDC for users **B**, **C**, **D** on Arbitrum.
- Preloads three maker intents (B: 500k, C: 300k, D: 200k) from Arbitrum → Base.
- Exposes REST endpoints so user **A** can:
  - Simulate a deposit on Base.
  - Submit an order intent (Base → Arbitrum).
  - Trigger the fixed matching engine that nets A against B/C/D.
- Returns a hard-coded six-transfer netting plan when A provides at least 1M USDC.

## Run locally

```bash
cd feeder
cargo run
```

Server listens on `http://127.0.0.1:8081`.

## API

All payloads are JSON.

### `POST /deposit`

```json
{
  "user": "A",
  "chain": "Base",
  "amount": 1000000,
  "recipient_on_other_chain": "A_arbitrum_address"
}
```

Adds USDC to the in-memory balance map.

### `POST /order`

```json
{
  "user": "A",
  "from_chain": "Base",
  "to_chain": "Arbitrum",
  "amount": 1000000,
  "signature": "0x123"
}
```

Stores A's intent in the orderbook.

### `POST /match`

Returns the six-transfer plan once A's total taker size is ≥ 1,000,000 USDC.

### `GET /orderbook`

Inspect the in-memory orderbook.

### `GET /balances`

Inspect current balances per chain/user.

## Demo flow

1. `POST /deposit` (A deposits 1,000,000 on Base).
2. `POST /order` (A submits Base → Arbitrum order).
3. `POST /match` (returns netting plan that nets A with B, C, D).

This crate is intentionally simplified: no signature checks, no actual blockchain, and maker intents remain forever.

