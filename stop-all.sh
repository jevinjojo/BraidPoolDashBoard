#!/bin/bash
# stop-all.sh - Stop all BraidPool services

echo "🛑 Stopping BraidPool services..."

# Stop Bitcoin nodes
echo "  → Stopping bitcoind..."
bitcoin-cli -regtest -rpcport=18332 -rpcuser=jevinrpc1 -rpcpassword=securepass1231 stop 2>/dev/null || echo "    (already stopped)"

echo "  → Stopping cmempoold..."
bitcoin-cli -regtest -rpcport=19443 -rpcuser=cmempoolrpc1 -rpcpassword=securepass4561 stop 2>/dev/null || echo "    (already stopped)"

# Stop braidpoold
echo "  → Stopping braidpoold..."
pkill -f "braidpoold" || echo "    (already stopped)"

# Stop dashboard
echo "  → Stopping dashboard..."
pkill -f "vite" || echo "    (already stopped)"

echo "✓ All services stopped"
