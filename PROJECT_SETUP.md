# BriadPool - Project Setup Guide

## Project Structure

```
BriadPool/
├── bitcoind_node/              # Standard Bitcoin node
│   ├── bitcoin.conf            # Node configuration
│   └── start.sh                # Startup script
│
├── cmempoold_node/             # Committed mempool node
│   ├── bitcoin.conf            # Node configuration
│   └── start.sh                # Startup script
│
└── braidpoold/                 # API server (Rust)
    ├── src/
    │   ├── main.rs             # Entry point
    │   └── api.rs              # API endpoints & logic
    └── Cargo.toml              # Rust dependencies
```

---

## Setup Instructions

### 1. Create Project Structure

```bash
# Create directories
mkdir -p bitcoind_node
mkdir -p cmempoold_node
mkdir -p braidpoold/src

# Create config and script files
touch bitcoind_node/bitcoin.conf
touch bitcoind_node/start.sh
touch cmempoold_node/bitcoin.conf
touch cmempoold_node/start.sh

# Create Rust files
touch braidpoold/src/main.rs
touch braidpoold/src/api.rs
touch braidpoold/Cargo.toml

# Make start scripts executable
chmod +x bitcoind_node/start.sh
chmod +x cmempoold_node/start.sh
```

### 2. Configure Nodes

**`bitcoind_node/bitcoin.conf`:**
```conf
regtest=1
server=1
txindex=1

rpcuser=<YOUR_RPC_USER>
rpcpassword=<YOUR_RPC_PASSWORD>
rpcport=18332

listen=1
port=18444
bind=127.0.0.1

blocksonly=1
```

**`bitcoind_node/start.sh`:**
```bash
#!/bin/bash
bitcoind -datadir=$(pwd) -conf=$(pwd)/bitcoin.conf
```

**`cmempoold_node/bitcoin.conf`:**
```conf
regtest=1
server=1
txindex=1

rpcuser=<YOUR_CMEMPOOL_RPC_USER>
rpcpassword=<YOUR_CMEMPOOL_RPC_PASSWORD>
rpcport=19443

listen=1
port=19444
bind=127.0.0.1

connect=127.0.0.1:18444
```

**`cmempoold_node/start.sh`:**
```bash
#!/bin/bash
bitcoind -datadir=$(pwd) -conf=$(pwd)/bitcoin.conf
```

### 3. Setup BraidPool API

Place your Rust code in:
- `braidpoold/src/main.rs` - API server entry point
- `braidpoold/src/api.rs` - Transaction management endpoints
- `braidpoold/Cargo.toml` - Dependencies (axum, bitcoincore-rpc, etc.)

---

## First-Time Wallet Setup

### Start Both Nodes

```bash
# Terminal 1: Start bitcoind
cd bitcoind_node
./start.sh

# Terminal 2: Start cmempool
cd cmempoold_node
./start.sh
```

### Create Wallet and Load Spendable Coins

```bash
# Create wallet
bitcoin-cli -regtest \
  -rpcuser=<YOUR_RPC_USER> \
  -rpcpassword=<YOUR_RPC_PASSWORD> \
  -rpcport=18332 \
  createwallet "<YOUR_WALLET_NAME>" false false "" false false true

# Generate 101 blocks to get spendable coins
# (Coinbase needs 100 confirmations)
bitcoin-cli -regtest \
  -rpcuser=<YOUR_RPC_USER> \
  -rpcpassword=<YOUR_RPC_PASSWORD> \
  -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> \
  -generate 101

# Verify balance (should show 50 BTC)
bitcoin-cli -regtest \
  -rpcuser=<YOUR_RPC_USER> \
  -rpcpassword=<YOUR_RPC_PASSWORD> \
  -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> \
  getbalance
```

### Sync Blocks to Cmempool Node

```bash
# Sync all 101 blocks
for height in {1..101}; do
    HASH=$(bitcoin-cli -regtest \
      -rpcuser=<YOUR_RPC_USER> \
      -rpcpassword=<YOUR_RPC_PASSWORD> \
      -rpcport=18332 \
      getblockhash $height)
    
    HEX=$(bitcoin-cli -regtest \
      -rpcuser=<YOUR_RPC_USER> \
      -rpcpassword=<YOUR_RPC_PASSWORD> \
      -rpcport=18332 \
      getblock $HASH 0)
    
    bitcoin-cli -regtest \
      -rpcuser=<YOUR_CMEMPOOL_RPC_USER> \
      -rpcpassword=<YOUR_CMEMPOOL_RPC_PASSWORD> \
      -rpcport=19443 \
      submitblock "$HEX" > /dev/null 2>&1
done

echo "✅ Sync complete!"
```

### Start API Server

```bash
# Terminal 3: Start BraidPool API
cd braidpoold
cargo run
```

---

## Testing All 5 Transaction Categories

### Test Script

```bash
ADDRESS="bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy"

# TX1: Mempool
TX1=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)
RAW1=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> gettransaction "$TX1" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW1" > /dev/null
echo "✅ TX1 (Mempool): $TX1"

# TX2: Committed
TX2=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)
RAW2=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> gettransaction "$TX2" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW2" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX2/commit | jq
echo "✅ TX2 (Committed): $TX2"

# TX3: Proposed
TX3=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)
RAW3=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> gettransaction "$TX3" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW3" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' | jq
echo "✅ TX3 (Proposed): $TX3"

# TX4: Scheduled
TX4=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)
RAW4=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> gettransaction "$TX4" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW4" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/propose \
  -H "Content-Type: application/json" -d '{}' | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule | jq
echo "✅ TX4 (Scheduled): $TX4"

# TX5: Confirmed
TX5=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)
RAW5=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<YOUR_WALLET_NAME> gettransaction "$TX5" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW5" > /dev/null
bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 -generate 1 > /dev/null
HEIGHT=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=<YOUR_RPC_USER> -rpcpassword=<YOUR_RPC_PASSWORD> -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=<YOUR_CMEMPOOL_RPC_USER> -rpcpassword=<YOUR_CMEMPOOL_RPC_PASSWORD> -rpcport=19443 submitblock "$HEX" > /dev/null
echo "✅ TX5 (Confirmed): $TX5"

# View all 5 categories
echo ""
echo "======================================"
echo "All 5 Categories:"
curl -s http://localhost:3000/transactions | jq '.[] | {txid, category, fee, fee_rate, size}'

echo ""
echo "Count by category:"
curl -s http://localhost:3000/transactions | jq 'group_by(.category) | map({category: .[0].category, count: length})'
```

### Expected Output

```json
[
  {"category": "Mempool", "count": 1},
  {"category": "Committed", "count": 1},
  {"category": "Proposed", "count": 1},
  {"category": "Scheduled", "count": 1},
  {"category": "Confirmed", "count": 1}
]
```

---

## Configuration Reference

### Ports
- **Bitcoind RPC**: 18332
- **Bitcoind P2P**: 18444
- **Cmempool RPC**: 19443
- **Cmempool P2P**: 19444
- **BraidPool API**: 3000

### Placeholders to Replace
- `<YOUR_RPC_USER>` - Your bitcoind RPC username
- `<YOUR_RPC_PASSWORD>` - Your bitcoind RPC password
- `<YOUR_CMEMPOOL_RPC_USER>` - Your cmempool RPC username
- `<YOUR_CMEMPOOL_RPC_PASSWORD>` - Your cmempool RPC password
- `<YOUR_WALLET_NAME>` - Your wallet name (e.g., "jevinwallet")

---

## Transaction Categories

1. **Mempool**: Transaction broadcast to bitcoind only
2. **Committed**: Transaction sent to cmempool node via API
3. **Proposed**: Transaction marked for proposal via API
4. **Scheduled**: Transaction marked ready for mining via API
5. **Confirmed**: Transaction included in a mined block

## API Endpoints

- `GET /transactions` - List all transactions
- `GET /tx/{txid}` - Get transaction details
- `POST /transactions/{txid}/commit` - Move to Committed
- `POST /transactions/{txid}/propose` - Move to Proposed
- `POST /transactions/{txid}/schedule` - Move to Scheduled
- `GET /mempool/info` - Get mempool statistics
