# First-Time Setup

> ⚠️ **Important:** The wallet "jevinwallet" doesn't exist by default. You must create it before testing.

## Quick Setup (3 Steps)

### 1. Start Both Nodes

```bash
# Terminal 1
cd bitcoind_node
./start.sh

# Terminal 2
cd cmempoold_node
./start.sh
```

### 2. Create Wallet and Get Spendable Coins

```bash
# Create wallet
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  createwallet "jevinwallet" false false "" false false true

# Generate 101 blocks (gives you 50 BTC to spend)
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101

# Sync blocks to cmempool node
for height in {1..101}; do
    HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
    HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
    bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX" > /dev/null 2>&1
done
```

### 3. Start API

```bash
# Terminal 3
cargo run
```

**Done!** Now go to README.md to test the 5 transaction categories.

---

## Next Time (After First Setup)

Just start the nodes and API:
```bash
cd bitcoind_node && ./start.sh
cd cmempoold_node && ./start.sh
cargo run
```

Your wallet and blocks persist automatically.
