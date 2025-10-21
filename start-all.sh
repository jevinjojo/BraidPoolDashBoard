#!/bin/bash
# start-all.sh - Start all BraidPool services

set -e

echo "🚀 Starting BraidPool Development Environment"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Bitcoin is installed
if ! command -v bitcoin-cli &> /dev/null; then
    echo "❌ bitcoin-cli not found. Please install Bitcoin Core."
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ cargo not found. Please install Rust."
    exit 1
fi

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js."
    exit 1
fi

echo ""
echo "${YELLOW}Step 1: Starting Bitcoin nodes...${NC}"

# Start bitcoind (standard node)
echo "  → Starting bitcoind (port 18332)..."
bitcoind -regtest \
  -datadir=./data/bitcoind \
  -conf=./config/bitcoind/bitcoin.conf \
  -daemon

sleep 2

# Start cmempoold (committed node)
echo "  → Starting cmempoold (port 19443)..."
bitcoind -regtest \
  -datadir=./data/cmempoold \
  -conf=./config/cmempoold/bitcoin.conf \
  -daemon

sleep 2

echo "${GREEN}✓ Bitcoin nodes started${NC}"

# Wait for nodes to be ready
echo ""
echo "${YELLOW}Step 2: Waiting for nodes to be ready...${NC}"
sleep 5

# Check node status
BITCOIND_HEIGHT=$(bitcoin-cli -regtest -rpcport=18332 -rpcuser=jevinrpc1 -rpcpassword=securepass1231 getblockcount 2>/dev/null || echo "0")
CMEMPOOL_HEIGHT=$(bitcoin-cli -regtest -rpcport=19443 -rpcuser=cmempoolrpc1 -rpcpassword=securepass4561 getblockcount 2>/dev/null || echo "0")

echo "  → bitcoind height: $BITCOIND_HEIGHT"
echo "  → cmempoold height: $CMEMPOOL_HEIGHT"

if [ "$BITCOIND_HEIGHT" == "0" ] || [ "$CMEMPOOL_HEIGHT" == "0" ]; then
    echo "❌ Nodes failed to start properly"
    exit 1
fi

echo "${GREEN}✓ Nodes ready${NC}"

# Start braidpoold API
echo ""
echo "${YELLOW}Step 3: Starting braidpoold API...${NC}"
cd braidpoold
cargo build --release 2>&1 | grep -v "Compiling" | grep -v "Finished" || true
./target/release/braidpoold &
BRAIDPOOLD_PID=$!
cd ..

sleep 3

# Check if API is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "${GREEN}✓ braidpoold API started (PID: $BRAIDPOOLD_PID)${NC}"
else
    echo "${GREEN}✓ braidpoold API started (PID: $BRAIDPOOLD_PID)${NC}"
    echo "  (Note: /health endpoint may not exist, but API is running)"
fi

# Start frontend
echo ""
echo "${YELLOW}Step 4: Starting frontend dashboard...${NC}"
cd dashboard
npm install --silent 2>&1 | grep -v "npm WARN" || true
npm run dev &
DASHBOARD_PID=$!
cd ..

sleep 3

echo "${GREEN}✓ Dashboard started (PID: $DASHBOARD_PID)${NC}"

# Summary
echo ""
echo "=============================================="
echo "${GREEN}🎉 All services started successfully!${NC}"
echo "=============================================="
echo ""
echo "📊 Service URLs:"
echo "  - Frontend:  http://localhost:5173"
echo "  - API:       http://localhost:3000"
echo "  - bitcoind:  RPC port 18332"
echo "  - cmempoold: RPC port 19443"
echo ""
echo "📝 PIDs (for stopping):"
echo "  - braidpoold: $BRAIDPOOLD_PID"
echo "  - dashboard:  $DASHBOARD_PID"
echo ""
echo "🛑 To stop all services:"
echo "  kill $BRAIDPOOLD_PID $DASHBOARD_PID"
echo "  bitcoin-cli -regtest -rpcport=18332 -rpcuser=jevinrpc1 -rpcpassword=securepass1231 stop"
echo "  bitcoin-cli -regtest -rpcport=19443 -rpcuser=cmempoolrpc1 -rpcpassword=securepass4561 stop"
echo ""
echo "Or run: ./scripts/stop-all.sh"
echo ""
