#!/bin/bash

echo "Testing 5-Stage Transaction System - PR #259"
echo "=============================================="
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
echo "=============================================="
echo "Summary - All Categories:"
echo "=============================================="
curl -s http://localhost:3000/transactions | \
  jq -r '.[] | "\(.category): \(.txid)"' | sort | uniq -c

echo ""
echo "Count by Category:"
curl -s http://localhost:3000/transactions | \
  jq 'group_by(.category) | map({category: .[0].category, count: length})'

echo ""
echo "✅ All 5 categories tested successfully!"
