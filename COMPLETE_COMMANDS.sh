#!/bin/bash

# ============================================================================
# COMPLETE 4-STAGE TRANSACTION SYSTEM
# Mempool → Committed → Proposed → Scheduled → Confirmed
# ============================================================================

echo "================================================"
echo "🚀 4-STAGE TRANSACTION SYSTEM"
echo "================================================"
echo ""

# ============================================================================
# CREATE 4 TRANSACTIONS - ONE IN EACH STAGE
# ============================================================================

echo "Creating 4 transactions (one for each stage)..."
echo ""

# ===== TRANSACTION 1: MEMPOOL =====
echo "1️⃣  Creating MEMPOOL transaction..."
TX1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX1" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW1" > /dev/null

echo "   TX1: $TX1"
sleep 1
CATEGORY1=$(curl -s http://localhost:3000/tx/$TX1 | jq -r '.category')
echo "   Category: $CATEGORY1"
echo ""

# ===== TRANSACTION 2: COMMITTED =====
echo "2️⃣  Creating COMMITTED transaction..."
TX2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX2" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW2" > /dev/null

# Commit it
curl -s -X POST http://localhost:3000/transactions/$TX2/commit > /dev/null

echo "   TX2: $TX2"
sleep 1
CATEGORY2=$(curl -s http://localhost:3000/tx/$TX2 | jq -r '.category')
echo "   Category: $CATEGORY2"
echo ""

# ===== TRANSACTION 3: PROPOSED =====
echo "3️⃣  Creating PROPOSED transaction..."
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX3" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW3" > /dev/null

# Commit and Propose it
curl -s -X POST http://localhost:3000/transactions/$TX3/commit > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' > /dev/null

echo "   TX3: $TX3"
sleep 1
CATEGORY3=$(curl -s http://localhost:3000/tx/$TX3 | jq -r '.category')
echo "   Category: $CATEGORY3"
echo ""

# ===== TRANSACTION 4: SCHEDULED =====
echo "4️⃣  Creating SCHEDULED transaction..."
TX4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX4" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW4" > /dev/null

# Commit, Propose, and Schedule it
curl -s -X POST http://localhost:3000/transactions/$TX4/commit > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/propose \
  -H "Content-Type: application/json" -d '{}' > /dev/null
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule > /dev/null

echo "   TX4: $TX4"
sleep 1
CATEGORY4=$(curl -s http://localhost:3000/tx/$TX4 | jq -r '.category')
echo "   Category: $CATEGORY4"
echo ""

# ============================================================================
# DISPLAY DASHBOARD
# ============================================================================
echo "================================================"
echo "📊 DASHBOARD - All Categories"
echo "================================================"
echo ""

curl -s http://localhost:3000/transactions | jq '.[] | {txid: .txid[0:16], category, fee}'

echo ""
echo "================================================"
echo "📈 COUNT BY CATEGORY"
echo "================================================"
echo ""

curl -s http://localhost:3000/transactions | jq 'group_by(.category) | map({category: .[0].category, count: length})'

echo ""
echo "================================================"
echo "✅ COMPLETE!"
echo "================================================"
echo ""
echo "You now have transactions in all 4 stages:"
echo "  1. Mempool"
echo "  2. Committed"
echo "  3. Proposed"
echo "  4. Scheduled"
echo ""
echo "View all: curl -s http://localhost:3000/transactions | jq"
echo "================================================"
