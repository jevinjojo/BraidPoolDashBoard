#!/bin/bash

echo "Backend Health Check - PR #259"
echo "=============================="
echo ""

# Check bitcoind
if bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount > /dev/null 2>&1; then
    COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
    echo "✅ Bitcoind running (height: $COUNT)"
else
    echo "❌ Bitcoind NOT running"
    exit 1
fi

# Check cmempool
if bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount > /dev/null 2>&1; then
    COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount)
    echo "✅ Cmempool running (height: $COUNT)"
else
    echo "❌ Cmempool NOT running"
    exit 1
fi

# Check API
if curl -s http://localhost:3000/transactions > /dev/null 2>&1; then
    TX_COUNT=$(curl -s http://localhost:3000/transactions | jq 'length')
    echo "✅ API server running ($TX_COUNT transactions)"
else
    echo "❌ API server NOT running"
    exit 1
fi

# Check sync (both height AND hash)
STD_COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount 2>/dev/null)
CM_COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount 2>/dev/null)
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash 2>/dev/null)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash 2>/dev/null)

# Check both height and hash
if [ "$STD_COUNT" == "$CM_COUNT" ] && [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ Nodes synchronized"
    echo "   Height: $STD_COUNT"
    echo "   Hash:   $STD_HASH"
else
    echo "❌ Nodes NOT synchronized"
    echo ""
    echo "   Bitcoind:"
    echo "     Height: $STD_COUNT"
    echo "     Hash:   $STD_HASH"
    echo ""
    echo "   Cmempool:"
    echo "     Height: $CM_COUNT"
    echo "     Hash:   $CM_HASH"
    echo ""
    if [ "$STD_COUNT" != "$CM_COUNT" ]; then
        echo "⚠️  Block heights differ! ($STD_COUNT vs $CM_COUNT)"
    fi
    if [ "$STD_HASH" != "$CM_HASH" ]; then
        echo "⚠️  Block hashes differ! Different chains!"
    fi
    echo ""
    echo "🔧 Fix: Run the sync script in FIRST_TIME_SETUP.md (step 2)"
    exit 1
fi

# Check wallet
if bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
   -rpcwallet=jevinwallet getbalance > /dev/null 2>&1; then
    BALANCE=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
      -rpcwallet=jevinwallet getbalance)
    echo "✅ Wallet loaded (balance: $BALANCE BTC)"
else
    echo "❌ Wallet 'jevinwallet' NOT found"
    exit 1
fi

echo ""
echo "=============================="
echo "✅ All systems ready to test!"
echo "=============================="
echo ""
echo "Run: ./test_backend.sh"
