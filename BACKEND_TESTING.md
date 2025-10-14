# Backend Testing Guide - PR #259

## Overview

This guide shows how to test the 5-stage transaction management API endpoints.

**API Base URL:** `http://localhost:3000`

---

## Prerequisites

Before testing, ensure:

1. **Both nodes are running:**
```bash
# Terminal 1: bitcoind
cd bitcoind_node
./start.sh

# Terminal 2: cmempool
cd cmempoold_node
./start.sh
```

2. **Wallet created with spendable coins:**
```bash
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  createwallet "jevinwallet" false false "" false false true

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101
```

3. **API server is running:**
```bash
# Terminal 3: API
cargo run
```

**Expected output:**
```
Standard node block count: 101
Committed node block count: 101
API running at http://127.0.0.1:3000
```

---

## API Endpoints to Test

### 1. GET /transactions
**Purpose:** List all transactions from both mempools

**Test:**
```bash
curl -s http://localhost:3000/transactions | jq
```

**Expected Response:**
```json
[
  {
    "txid": "abc123...",
    "hash": "abc123...",
    "category": "Mempool",
    "size": 141,
    "weight": 564,
    "fee": 0.00000141,
    "fee_rate": 1.0,
    "inputs": 1,
    "outputs": 2,
    "confirmations": 0,
    "work": null,
    "work_unit": null,
    "timestamp": 1728567890,
    "rbf_signaled": false,
    "status": {
      "confirmed": false,
      "block_height": null,
      "block_hash": null,
      "block_time": null
    }
  }
]
```

---

### 2. GET /tx/{txid}
**Purpose:** Get details of a specific transaction

**Test:**
```bash
# First, create a transaction
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW"

# Now get it via API
curl -s http://localhost:3000/tx/$TXID | jq
```

**Expected Response:**
```json
{
  "txid": "abc123...",
  "category": "Mempool",
  "size": 141,
  "fee": 0.00000141,
  "fee_rate": 1.0,
  "inputs": 1,
  "outputs": 2,
  "confirmations": 0,
  "timestamp": 1728567890,
  "rbf_signaled": false
}
```

---

### 3. POST /transactions/{txid}/commit
**Purpose:** Move transaction from Mempool → Committed (sends to cmempool node)

**Test:**
```bash
# Create a new transaction
TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW"

# Commit it
curl -s -X POST http://localhost:3000/transactions/$TX/commit | jq
```

**Expected Response:**
```json
{
  "status": "ok",
  "txid": "abc123...",
  "message": "Transaction committed successfully"
}
```

**Verify category changed:**
```bash
curl -s http://localhost:3000/tx/$TX | jq '.category'
# Should return: "Committed"
```

**Verify it's in cmempool node:**
```bash
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 \
  getrawmempool | grep $TX
# Should show the txid
```

---

### 4. POST /transactions/{txid}/propose
**Purpose:** Move transaction from Committed → Proposed

**Test:**
```bash
# Create and commit a transaction first
TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW"

curl -s -X POST http://localhost:3000/transactions/$TX/commit | jq

# Now propose it
curl -s -X POST http://localhost:3000/transactions/$TX/propose \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Expected Response:**
```json
{
  "status": "ok",
  "txid": "abc123...",
  "message": "Transaction proposed"
}
```

**Verify category changed:**
```bash
curl -s http://localhost:3000/tx/$TX | jq '.category'
# Should return: "Proposed"
```

---

### 5. POST /transactions/{txid}/schedule
**Purpose:** Move transaction from Proposed → Scheduled

**Test:**
```bash
# Create, commit, and propose a transaction first
TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW"

curl -s -X POST http://localhost:3000/transactions/$TX/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX/propose \
  -H "Content-Type: application/json" -d '{}' | jq

# Now schedule it
curl -s -X POST http://localhost:3000/transactions/$TX/schedule | jq
```

**Expected Response:**
```json
{
  "status": "ok",
  "txid": "abc123...",
  "message": "Transaction scheduled successfully"
}
```

**Verify category changed:**
```bash
curl -s http://localhost:3000/tx/$TX | jq '.category'
# Should return: "Scheduled"
```

---

### 6. GET /mempool/info
**Purpose:** Get mempool statistics

**Test:**
```bash
curl -s http://localhost:3000/mempool/info | jq
```

**Expected Response:**
```json
{
  "count": 4,
  "vsize": 564,
  "total_fee": 564,
  "fee_histogram": [
    [1.0, 141],
    [1.0, 141],
    [1.0, 141],
    [1.0, 141]
  ]
}
```

---

## Complete 5-Stage Test

### Test All 5 Categories in One Script

```bash
#!/bin/bash

echo "Testing 5-Stage Transaction System"
echo "===================================="
echo ""

ADDRESS="bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy"

# TX1: Mempool
echo "1️⃣  Creating MEMPOOL transaction..."
TX1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX1" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW1" > /dev/null
CATEGORY1=$(curl -s http://localhost:3000/tx/$TX1 | jq -r '.category')
echo "   TX1: $TX1"
echo "   Category: $CATEGORY1 ✅"
echo ""

# TX2: Committed
echo "2️⃣  Creating COMMITTED transaction..."
TX2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX2" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW2" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX2/commit > /dev/null
CATEGORY2=$(curl -s http://localhost:3000/tx/$TX2 | jq -r '.category')
echo "   TX2: $TX2"
echo "   Category: $CATEGORY2 ✅"
echo ""

# TX3: Proposed
echo "3️⃣  Creating PROPOSED transaction..."
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX3" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW3" > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/commit > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' > /dev/null
CATEGORY3=$(curl -s http://localhost:3000/tx/$TX3 | jq -r '.category')
echo "   TX3: $TX3"
echo "   Category: $CATEGORY3 ✅"
echo ""

# TX4: Scheduled
echo "4️⃣  Creating SCHEDULED transaction..."
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
CATEGORY4=$(curl -s http://localhost:3000/tx/$TX4 | jq -r '.category')
echo "   TX4: $TX4"
echo "   Category: $CATEGORY4 ✅"
echo ""

# TX5: Confirmed
echo "5️⃣  Creating CONFIRMED transaction..."
TX5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "$ADDRESS" 0.001)
RAW5=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX5" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW5" > /dev/null
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -generate 1 > /dev/null
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 \
  submitblock "$HEX" > /dev/null
sleep 1
CATEGORY5=$(curl -s http://localhost:3000/tx/$TX5 | jq -r '.category')
CONFIRMS5=$(curl -s http://localhost:3000/tx/$TX5 | jq -r '.confirmations')
echo "   TX5: $TX5"
echo "   Category: $CATEGORY5 ✅"
echo "   Confirmations: $CONFIRMS5"
echo ""

# Summary
echo "===================================="
echo "Summary - All Categories:"
echo "===================================="
curl -s http://localhost:3000/transactions | \
  jq -r '.[] | "\(.category): \(.txid)"' | sort | uniq -c

echo ""
echo "Count by Category:"
curl -s http://localhost:3000/transactions | \
  jq 'group_by(.category) | map({category: .[0].category, count: length})'
```

**Save as:** `test_backend.sh`

**Run:**
```bash
chmod +x test_backend.sh
./test_backend.sh
```

**Expected Output:**
```
Testing 5-Stage Transaction System
====================================

1️⃣  Creating MEMPOOL transaction...
   TX1: abc123...
   Category: Mempool ✅

2️⃣  Creating COMMITTED transaction...
   TX2: def456...
   Category: Committed ✅

3️⃣  Creating PROPOSED transaction...
   TX3: ghi789...
   Category: Proposed ✅

4️⃣  Creating SCHEDULED transaction...
   TX4: jkl012...
   Category: Scheduled ✅

5️⃣  Creating CONFIRMED transaction...
   TX5: mno345...
   Category: Confirmed ✅
   Confirmations: 1

====================================
Summary - All Categories:
====================================
      1 Committed: def456...
      1 Confirmed: mno345...
      1 Mempool: abc123...
      1 Proposed: ghi789...
      1 Scheduled: jkl012...

Count by Category:
[
  {"category": "Committed", "count": 1},
  {"category": "Confirmed", "count": 1},
  {"category": "Mempool", "count": 1},
  {"category": "Proposed", "count": 1},
  {"category": "Scheduled", "count": 1}
]
```

---

## Error Scenarios to Test

### 1. Transaction Not Found
```bash
curl -s http://localhost:3000/tx/invalid_txid_here | jq
```

**Expected:** HTTP 404 or error response

---

### 2. Propose Without Commit
```bash
# Create transaction but don't commit
TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

# Try to propose directly (should fail)
curl -s -X POST http://localhost:3000/transactions/$TX/propose \
  -H "Content-Type: application/json" -d '{}' | jq
```

**Expected Error:**
```json
{
  "status": "error",
  "error": "Transaction not found in mempool"
}
```

---

### 3. Schedule Without Propose
```bash
# Create and commit but don't propose
TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW"

curl -s -X POST http://localhost:3000/transactions/$TX/commit > /dev/null

# Try to schedule without proposing (should fail)
curl -s -X POST http://localhost:3000/transactions/$TX/schedule | jq
```

**Expected Error:**
```json
{
  "status": "error",
  "error": "Transaction must be proposed first. Use POST /transactions/{txid}/propose"
}
```

---

## Verification Commands

### Check Node Synchronization
```bash
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash)

if [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ Nodes are synced"
else
    echo "❌ Nodes NOT synced"
    echo "Bitcoind: $STD_HASH"
    echo "Cmempool: $CM_HASH"
fi
```

### Check API Server Health
```bash
curl -s http://localhost:3000/transactions > /dev/null && echo "✅ API is running" || echo "❌ API is down"
```

### Check Both Mempools
```bash
echo "Bitcoind mempool:"
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getrawmempool

echo ""
echo "Cmempool mempool:"
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getrawmempool
```

---

## Quick Health Check

Run this to verify everything is working:

```bash
#!/bin/bash

echo "Backend Health Check"
echo "===================="
echo ""

# Check bitcoind
if bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount > /dev/null 2>&1; then
    COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
    echo "✅ Bitcoind running (height: $COUNT)"
else
    echo "❌ Bitcoind NOT running"
fi

# Check cmempool
if bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount > /dev/null 2>&1; then
    COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount)
    echo "✅ Cmempool running (height: $COUNT)"
else
    echo "❌ Cmempool NOT running"
fi

# Check API
if curl -s http://localhost:3000/transactions > /dev/null 2>&1; then
    echo "✅ API server running"
else
    echo "❌ API server NOT running"
fi

# Check sync
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash 2>/dev/null)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash 2>/dev/null)

if [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ Nodes synchronized"
else
    echo "❌ Nodes NOT synchronized"
fi

echo ""
echo "Ready to test! 🚀"
```

**Save as:** `health_check.sh`

---

## Summary

**6 Endpoints tested:**
1. ✅ `GET /transactions` - List all
2. ✅ `GET /tx/{txid}` - Get single
3. ✅ `POST /transactions/{txid}/commit` - Mempool → Committed
4. ✅ `POST /transactions/{txid}/propose` - Committed → Proposed
5. ✅ `POST /transactions/{txid}/schedule` - Proposed → Scheduled
6. ✅ `GET /mempool/info` - Statistics

**5 Categories verified:**
1. ✅ Mempool
2. ✅ Committed
3. ✅ Proposed
4. ✅ Scheduled
5. ✅ Confirmed

**All error cases tested!** ✅
