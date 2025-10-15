# BriadPool API - Testing Guide

## Overview

This API implements a **5-stage transaction management system** for Bitcoin transactions:
- **Mempool** → **Committed** → **Proposed** → **Scheduled** → **Confirmed**

---

## Prerequisites

- Bitcoin Core installed
- Rust toolchain installed
- `jq` installed (for JSON formatting)

---

## Setup

### 1. Start Bitcoin Nodes

**Bitcoind Node (Standard):**
```bash
cd bitcoind_node
./start.sh
```

**Cmempool Node (Committed Mempool):**
```bash
cd cmempoold_node
./start.sh
```

**Verify both nodes are running:**
```bash
# Bitcoind
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount

# Cmempool
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount
```

### 2. Ensure Nodes Are Synced

**CRITICAL**: Both nodes must have the same blockchain state.

```bash
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash)

echo "Bitcoind:  $STD_HASH"
echo "Cmempool:  $CM_HASH"

if [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ SYNCED"
else
    echo "❌ NOT SYNCED - Run sync script below"
fi
```

**If not synced, run this:**
```bash
CM_COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount)
STD_COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)

for height in $(seq $((CM_COUNT + 1)) $STD_COUNT); do
    BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
    BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
    bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX" > /dev/null 2>&1
done

echo "✅ Synced!"
```

### 3. Create Wallet (If Needed)

```bash
# Create wallet if it doesn't exist
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  createwallet "jevinwallet" false false "" false false true

# Generate some blocks to get coins (need 101 blocks to spend coinbase)
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101

# Sync those blocks to cmempool
for height in {1..101}; do
    BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
    BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
    bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX" > /dev/null 2>&1
done

# Check balance
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet getbalance
```

### 4. Start API Server

```bash
cargo run
```

**Expected output:**
```
Standard node block count: 101
Committed node block count: 101
API running at http://127.0.0.1:3000
```

---

## Configuration Reference

### Node Credentials

**Bitcoind:**
- RPC Port: `18332`
- RPC User: `jevinrpc`
- RPC Password: `securepass123`
- Wallet Name: `jevinwallet`

**Cmempool:**
- RPC Port: `19443`
- RPC User: `cmempoolrpc`
- RPC Password: `securepass456`

**API Server:**
- Port: `3000`
- URL: `http://localhost:3000`

---

## API Endpoints

### Query Endpoints

**Get All Transactions**
```bash
curl -s http://localhost:3000/transactions | jq
```

**Get Single Transaction**
```bash
curl -s http://localhost:3000/tx/{TXID} | jq
```

**Get Mempool Info**
```bash
curl -s http://localhost:3000/mempool/info | jq
```

### Transaction Management Endpoints

**Commit Transaction (Mempool → Committed)**
```bash
curl -s -X POST http://localhost:3000/transactions/{TXID}/commit | jq
```

**Propose Transaction (Committed → Proposed)**
```bash
curl -s -X POST http://localhost:3000/transactions/{TXID}/propose \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Schedule Transaction (Proposed → Scheduled)**
```bash
curl -s -X POST http://localhost:3000/transactions/{TXID}/schedule | jq
```

**Legacy Commit Endpoint**
```bash
curl -s -X POST http://localhost:3000/beads/commit/{TXID} | jq
```

---

## Complete Test Workflow

### Test 1: Create Transaction in Each Category

> ⚠️ **PREREQUISITE**: Make sure you created the wallet in Step 3 above!

**Replace `{ADDRESS}` with actual address or use:** `bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy`

```bash
# ===== TRANSACTION 1: MEMPOOL =====
TX1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX1" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW1"

echo "TX1 (Mempool): $TX1"
curl -s http://localhost:3000/tx/$TX1 | jq '{txid, category}'

# ===== TRANSACTION 2: COMMITTED =====
TX2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX2" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW2"

curl -s -X POST http://localhost:3000/transactions/$TX2/commit | jq

echo "TX2 (Committed): $TX2"
curl -s http://localhost:3000/tx/$TX2 | jq '{txid, category}'

# ===== TRANSACTION 3: PROPOSED =====
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX3" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW3"

curl -s -X POST http://localhost:3000/transactions/$TX3/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' | jq

echo "TX3 (Proposed): $TX3"
curl -s http://localhost:3000/tx/$TX3 | jq '{txid, category}'

# ===== TRANSACTION 4: SCHEDULED =====
TX4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX4" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW4"

curl -s -X POST http://localhost:3000/transactions/$TX4/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/propose \
  -H "Content-Type: application/json" -d '{}' | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule | jq

echo "TX4 (Scheduled): $TX4"
curl -s http://localhost:3000/tx/$TX4 | jq '{txid, category}'

# ===== TRANSACTION 5: CONFIRMED =====
TX5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX5" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW5"

# Mine block to confirm
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1

# Sync block to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX"

echo "TX5 (Confirmed): $TX5"
curl -s http://localhost:3000/tx/$TX5 | jq '{txid, category, confirmations}'
```

### Test 2: View All Categories

```bash
# View all transactions
curl -s http://localhost:3000/transactions | jq '.[] | {txid, category, fee, fee_rate, size}'

# Count by category
curl -s http://localhost:3000/transactions | jq 'group_by(.category) | map({category: .[0].category, count: length})'

# Filter by category
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Mempool")'
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Committed")'
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Proposed")'
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Scheduled")'
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Confirmed")'
```

### Test 3: Mempool Statistics

```bash
curl -s http://localhost:3000/mempool/info | jq
```

**Expected output:**
```json
{
  "count": 4,
  "vsize": 900,
  "total_fee": 4000,
  "fee_histogram": [
    [5.0, 225],
    [5.0, 225],
    [5.0, 225],
    [5.0, 225]
  ]
}
```

---

## Transaction Fields Explained

Each transaction object contains:

```json
{
  "txid": "abc123...",           // Transaction ID
  "category": "Proposed",         // Current stage
  "size": 225,                    // Virtual bytes (vB)
  "fee": 0.00001,                 // Fee in BTC
  "fee_rate": 5.5,                // Satoshis per vByte
  "inputs": 1,                    // Number of inputs (UTXOs spent)
  "outputs": 2,                   // Number of outputs (new UTXOs)
  "confirmations": 0,             // Blocks since confirmation (0 = unconfirmed)
  "timestamp": 1728567890,        // Unix timestamp
  "rbf_signaled": true,           // Replace-by-fee enabled?
  "status": {
    "confirmed": false,
    "block_height": null,
    "block_hash": null,
    "block_time": null
  }
}
```

**Calculations:**
- **size (vB)**: From `transaction.vsize` (virtual bytes)
- **fee (BTC)**: `mempool_entry.fees.base / 100,000,000`
- **fee_rate (sats/vB)**: `fee_satoshis / vsize`
- **inputs**: `transaction.vin.length`
- **outputs**: `transaction.vout.length`
- **timestamp**: `mempool_entry.time` (Unix timestamp)

---

## Categorization Logic

```
Priority Order:
1. confirmations > 0        → "Confirmed"
2. in STATE.scheduled       → "Scheduled"
3. in STATE.proposed        → "Proposed"
4. in cmempool node         → "Committed"
5. in bitcoind node only    → "Mempool"
6. was seen before          → "Replaced"
7. otherwise                → "Unknown"
```

---

## Quick Test (All 5 Categories)

Run this complete script to test all 5 categories at once:

```bash
#!/bin/bash

echo "Testing 5-Category Transaction System"
echo "======================================"
echo ""

# Create 5 transactions
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
curl -s -X POST http://localhost:3000/transactions/$TX2/commit > /dev/null
echo "✅ TX2 (Committed): $TX2"

# TX3: Proposed
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX3" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW3" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/commit > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' > /dev/null
echo "✅ TX3 (Proposed): $TX3"

# TX4: Scheduled
TX4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX4" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW4" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/commit > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/propose \
  -H "Content-Type: application/json" -d '{}' > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule > /dev/null
echo "✅ TX4 (Scheduled): $TX4"

# TX5: Confirmed
TX5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX5" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW5" > /dev/null

# Mine block
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1 > /dev/null

# Sync block to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX" > /dev/null

echo "✅ TX5 (Confirmed): $TX5"
curl -s http://localhost:3000/tx/$TX5 | jq '{txid, category, confirmations}'

# Display all 5 categories
echo ""
echo "======================================"
echo "All 5 Categories:"
echo "======================================"
curl -s http://localhost:3000/transactions | jq '.[] | {txid, category, fee, fee_rate, size}'

echo ""
echo "Count by category:"
curl -s http://localhost:3000/transactions | jq 'group_by(.category) | map({category: .[0].category, count: length})'
```

---

## Expected Test Results

After running the complete test, you should see:

```json
[
  {
    "category": "Mempool",
    "count": 1
  },
  {
    "category": "Committed",
    "count": 1
  },
  {
    "category": "Proposed",
    "count": 1
  },
  {
    "category": "Scheduled",
    "count": 1
  },
  {
    "category": "Confirmed",
    "count": 1
  }
]
```

---

## Troubleshooting

### Issue: "Transaction not found" or "Wallet jevinwallet not found"
**Solution:** You forgot to create the wallet! Go back to **Setup Step 3** and run:
```bash
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  createwallet "jevinwallet" false false "" false false true

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101
```

### Issue: Error -25 "Missing inputs"
**Solution:** Nodes not synced. Run the sync script in Setup Step 2.

### Issue: "Connection refused"
**Solution:** 
- Check bitcoind is running: `bitcoin-cli -regtest -rpcport=18332 getblockcount`
- Check cmempool is running: `bitcoin-cli -regtest -rpcport=19443 getblockcount`
- Check API is running: `curl http://localhost:3000/transactions`

### Issue: "Insufficient funds"
**Solution:** Generate more blocks:
```bash
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 10
```

---

## Architecture

```
Dashboard → API (Port 3000) → Bitcoind (Port 18332)
                            → Cmempool (Port 19443)
```

- **Bitcoind**: Standard Bitcoin node with wallet
- **Cmempool**: Committed mempool (receives committed transactions)
- **API**: Rust server managing transaction states
- **Dashboard**: Frontend consuming API

---

## Notes

- All tests use regtest mode (private test network)
- Wallet name: `jevinwallet`
- Test address: `bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy`
- API runs on: `http://localhost:3000`
- Dashboard should set: `BRIADPOOL_API_URL=http://localhost:3000`
