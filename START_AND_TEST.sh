#!/bin/bash

# ============================================
# COMPLETE STARTUP AND TEST SCRIPT
# For 4-Stage System: Mempool → Proposed → Scheduled → Confirmed
# ============================================

echo "================================================"
echo "🚀 Starting BriadPool 4-Stage Transaction System"
echo "================================================"
echo ""

# ============================================
# STEP 1: START BITCOIN NODES
# ============================================
echo "Step 1: Starting Bitcoin nodes..."
cd /mnt/c/Users/Jeffrin/Desktop/BriadPool/bitcoind_node
./start.sh
sleep 3

cd /mnt/c/Users/Jeffrin/Desktop/BriadPool/cmempoold_node
./start.sh
sleep 5

echo "✅ Bitcoin nodes started"
echo ""

# ============================================
# STEP 2: START API SERVER
# ============================================
echo "Step 2: Starting API server..."
cd /workspace

# Kill any existing cargo run
pkill -f "cargo run" 2>/dev/null || true
sleep 2

# Start API in background
cargo run > /tmp/briadpool_api.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"
sleep 10

# Check if API is running
if curl -s http://localhost:3000/transactions > /dev/null 2>&1; then
    echo "✅ API server started successfully"
else
    echo "❌ API server failed to start. Check logs:"
    tail -20 /tmp/briadpool_api.log
    exit 1
fi
echo ""

# ============================================
# STEP 3: VERIFY NODES ARE SYNCED
# ============================================
echo "Step 3: Verifying nodes are synchronized..."
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash)

echo "Bitcoind:  $STD_HASH"
echo "Cmempool:  $CM_HASH"

if [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ Nodes are synced!"
else
    echo "⚠️  Nodes not synced - syncing now..."
    CM_COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount)
    STD_COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
    
    for height in $(seq $((CM_COUNT + 1)) $STD_COUNT); do
        BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
        BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
        bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX" > /dev/null 2>&1
    done
    echo "✅ Nodes synced!"
fi
echo ""

# ============================================
# STEP 4: TEST 4-STAGE WORKFLOW
# ============================================
echo "================================================"
echo "🧪 Testing 4-Stage Transaction Workflow"
echo "================================================"
echo ""

# Create transaction
echo "Creating transaction..."
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.002)

echo "Transaction ID: $TXID"
echo ""

# Get raw tx and broadcast
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    sendrawtransaction "$RAW_TX" > /dev/null

# ============================================
# STAGE 1: MEMPOOL
# ============================================
echo "📦 STAGE 1: MEMPOOL"
sleep 2
CATEGORY=$(curl -s "http://localhost:3000/tx/$TXID" | jq -r '.category')
echo "   Category: $CATEGORY"

if [ "$CATEGORY" != "Mempool" ]; then
    echo "   ❌ Expected 'Mempool' but got '$CATEGORY'"
    exit 1
fi
echo "   ✅ Transaction in Mempool stage"
echo ""

# ============================================
# STAGE 2: PROPOSED
# ============================================
echo "📋 STAGE 2: PROPOSED"
echo "   Proposing transaction..."
PROPOSE_RESULT=$(curl -s -X POST "http://localhost:3000/transactions/$TXID/propose" \
    -H "Content-Type: application/json" \
    -d '{}')

echo "   Response: $PROPOSE_RESULT"

if echo "$PROPOSE_RESULT" | jq -e '.status == "ok"' > /dev/null; then
    echo "   ✅ Proposal successful"
else
    echo "   ❌ Proposal failed"
    echo "   Full response: $PROPOSE_RESULT"
    exit 1
fi

sleep 2
CATEGORY=$(curl -s "http://localhost:3000/tx/$TXID" | jq -r '.category')
echo "   Category: $CATEGORY"

if [ "$CATEGORY" != "Proposed" ]; then
    echo "   ❌ Expected 'Proposed' but got '$CATEGORY'"
    exit 1
fi
echo "   ✅ Transaction in Proposed stage"
echo ""

# ============================================
# STAGE 3: SCHEDULED
# ============================================
echo "📅 STAGE 3: SCHEDULED"
echo "   Scheduling transaction..."
SCHEDULE_RESULT=$(curl -s -X POST "http://localhost:3000/transactions/$TXID/schedule")

echo "   Response: $SCHEDULE_RESULT"

if echo "$SCHEDULE_RESULT" | jq -e '.status == "ok"' > /dev/null; then
    echo "   ✅ Scheduling successful"
else
    echo "   ❌ Scheduling failed"
    echo "   Full response: $SCHEDULE_RESULT"
    exit 1
fi

sleep 2
CATEGORY=$(curl -s "http://localhost:3000/tx/$TXID" | jq -r '.category')
echo "   Category: $CATEGORY"

if [ "$CATEGORY" != "Scheduled" ]; then
    echo "   ❌ Expected 'Scheduled' but got '$CATEGORY'"
    exit 1
fi
echo "   ✅ Transaction in Scheduled stage"

# Verify in cmempool
echo "   Verifying in cmempool..."
CMEMPOOL=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getrawmempool)
if echo "$CMEMPOOL" | grep -q "$TXID"; then
    echo "   ✅ Transaction found in cmempool"
else
    echo "   ⚠️  Transaction not in cmempool"
fi
echo ""

# ============================================
# STAGE 4: CONFIRMED
# ============================================
echo "⛏️  STAGE 4: CONFIRMED"
echo "   Mining block..."
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1 > /dev/null

# Sync block to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX" > /dev/null

sleep 2
CATEGORY=$(curl -s "http://localhost:3000/tx/$TXID" | jq -r '.category')
echo "   Category: $CATEGORY"

if [ "$CATEGORY" != "Confirmed" ]; then
    echo "   ❌ Expected 'Confirmed' but got '$CATEGORY'"
    exit 1
fi
echo "   ✅ Transaction confirmed in blockchain"
echo ""

# ============================================
# SUMMARY
# ============================================
echo "================================================"
echo "✅✅✅ ALL TESTS PASSED! ✅✅✅"
echo "================================================"
echo ""
echo "Transaction Journey:"
echo "  $TXID"
echo ""
echo "  Mempool → Proposed → Scheduled → Confirmed ✓"
echo ""
echo "View all transactions:"
echo "  curl -s http://localhost:3000/transactions | jq '.[] | {txid, category}'"
echo ""
echo "API is running at: http://localhost:3000"
echo "API PID: $API_PID"
echo "API logs: /tmp/briadpool_api.log"
echo ""
echo "To stop API: kill $API_PID"
echo "================================================"
