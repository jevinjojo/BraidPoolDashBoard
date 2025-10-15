#!/bin/bash

echo "Node Synchronization Check"
echo "=========================="
echo ""

# Get heights
STD_COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount 2>/dev/null)
CM_COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount 2>/dev/null)

# Get hashes
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash 2>/dev/null)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash 2>/dev/null)

echo "Bitcoind:"
echo "  Height: $STD_COUNT"
echo "  Hash:   $STD_HASH"
echo ""
echo "Cmempool:"
echo "  Height: $CM_COUNT"
echo "  Hash:   $CM_HASH"
echo ""

# Check both
if [ "$STD_COUNT" == "$CM_COUNT" ] && [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ FULLY SYNCHRONIZED!"
    echo "   Both nodes on same chain at height $STD_COUNT"
    exit 0
else
    echo "❌ NOT SYNCHRONIZED!"
    echo ""
    
    if [ "$STD_COUNT" != "$CM_COUNT" ]; then
        echo "   ⚠️  Heights differ: $STD_COUNT vs $CM_COUNT"
    fi
    
    if [ "$STD_HASH" != "$CM_HASH" ]; then
        echo "   ⚠️  Hashes differ: DIFFERENT CHAINS!"
    fi
    
    echo ""
    echo "🔧 Run sync script to fix (see FIRST_TIME_SETUP.md step 2)"
    exit 1
fi
