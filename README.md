# 5-Stage Transaction Management System

## Quick Start (For Reviewers)

This PR implements a **5-category transaction workflow**: `Mempool` → `Committed` → `Proposed` → `Scheduled` → `Confirmed`

### How to Test (4 Steps)

> 🚨 **FIRST TIME?** Read [FIRST_TIME_SETUP.md](FIRST_TIME_SETUP.md) first! The wallet doesn't exist by default.

**1. Start Bitcoin Nodes**
```bash
# Terminal 1: Start bitcoind
cd bitcoind_node
./start.sh

# Terminal 2: Start cmempoold  
cd cmempoold_node
./start.sh
```

**2. Create Wallet (IMPORTANT - First Time Only)**
```bash
# Create the wallet (only need to do this once)
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  createwallet "jevinwallet" false false "" false false true

# Generate 101 blocks to get spendable coins (coinbase needs 100 confirmations)
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101

# Sync those blocks to cmempool node
for height in {1..101}; do
    BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
    BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
    bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX" > /dev/null 2>&1
done

# Verify you have coins
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet getbalance
# Should show: 50.00000000 (or more)

echo "✅ Wallet created and funded!"
```

**3. Start API Server**
```bash
# Terminal 3: Run API (from project root where main.rs is located)
cargo run
```

**4. Run Tests**

See **[TESTING_GUIDE.md](TESTING_GUIDE.md)** for complete testing instructions.

**Quick test - Create 1 transaction in each category:**

> ⚠️ **IMPORTANT**: Make sure you created the wallet first (see Step 2 above)!  
> If you see error "wallet not found", go back to Step 2.

```bash
# Just copy-paste this entire block:

ADDRESS="bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy"

# TX1: Mempool
TX1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX1" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW1" > /dev/null
echo "✅ TX1 (Mempool): $TX1"

# TX2: Committed
TX2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX2" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW2" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX2/commit | jq
echo "✅ TX2 (Committed): $TX2"

# TX3: Proposed
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX3" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW3" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' | jq
echo "✅ TX3 (Proposed): $TX3"

# TX4: Scheduled
TX4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX4" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW4" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/propose \
  -H "Content-Type: application/json" -d '{}' | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule | jq
echo "✅ TX4 (Scheduled): $TX4"

# TX5: Confirmed
TX5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX5" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW5" > /dev/null
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1 > /dev/null
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX" > /dev/null
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

**Expected output:**
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

## What Changed

### Core Features

✅ **5 Transaction Categories**
- `Mempool`: Transaction in bitcoind only
- `Committed`: Sent to cmempool node
- `Proposed`: Marked for consideration
- `Scheduled`: Ready for mining
- `Confirmed`: Included in a block

✅ **Transaction Metrics**
- Size (vB): Virtual bytes
- Fee (BTC): Transaction fee
- Fee Rate (sats/vB): Fee per virtual byte
- Inputs/Outputs: UTXO counts
- Timestamp: Unix time

✅ **API Endpoints**
- `GET /transactions` - List all transactions
- `GET /tx/{txid}` - Get transaction details
- `POST /transactions/{txid}/commit` - Move to Committed
- `POST /transactions/{txid}/propose` - Move to Proposed
- `POST /transactions/{txid}/schedule` - Move to Scheduled
- `GET /mempool/info` - Mempool statistics

### File Structure

**Essential Files:**
```
main.rs                         # API entry point
api.rs                          # Transaction logic & endpoints
bitcoind_node/
  ├── bitcoin.conf             # Standard node config
  └── start.sh                 # Start script
cmempoold_node/
  ├── bitcoin.conf             # Committed mempool config
  └── start.sh                 # Start script
README.md                      # This file
TESTING_GUIDE.md               # Complete testing instructions
```

**Configuration:**
- **API Port**: 3000
- **Bitcoind RPC**: Port 18332, User: `jevinrpc`, Pass: `securepass123`
- **Cmempool RPC**: Port 19443, User: `cmempoolrpc`, Pass: `securepass456`
- **Wallet**: `jevinwallet`

---

## Architecture

```
┌─────────────┐
│  Dashboard  │ (Frontend)
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│  API:3000   │ (Rust/Axum)
│             │ - State management
│             │ - Category logic
└──────┬──────┘
       │ RPC
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌──────┐
│Bitcoind│ │Cmempool│
│:18332 │ │:19443  │
└────────┘ └────────┘
```

**Key Components:**
1. **Bitcoind Node**: Standard Bitcoin node with wallet (creates transactions)
2. **Cmempool Node**: Committed mempool (receives committed transactions)
3. **API Server**: Manages state & exposes REST endpoints
4. **Dashboard**: Visualizes transactions by category

---

## Troubleshooting

**Problem: "Wallet not found" or "Transaction not found"**
→ Solution: You didn't create the wallet! Go to **Step 2** above and create "jevinwallet"

**Problem: "Insufficient funds"**
→ Solution: Generate blocks:
```bash
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101
```

**Problem: Error -25 "Missing inputs"**
→ Solution: Nodes not synced. See TESTING_GUIDE.md "Step 2: Ensure Nodes Are Synced"

---

## For More Details

- **Complete Testing Instructions**: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **All API Endpoints**: See TESTING_GUIDE.md "API Endpoints" section
- **Architecture Deep Dive**: See TESTING_GUIDE.md "Architecture" section

---

## Summary

This PR enables:
1. ✅ Multi-stage transaction workflow across 2 Bitcoin nodes
2. ✅ REST API for transaction management
3. ✅ Automatic categorization with priority logic
4. ✅ Transaction metrics calculation (size, fee, fee rate, inputs, outputs)
5. ✅ State persistence for Proposed/Scheduled categories
6. ✅ Complete testing infrastructure

**Ready to test!** 🚀
