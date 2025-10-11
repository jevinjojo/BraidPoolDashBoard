# ⚠️ FIRST TIME SETUP - READ THIS FIRST!

## Why This Matters

When you clone this repository, you get **ZERO blockchain data** and **ZERO wallets**.

The wallet name "jevinwallet" used in all the test commands **DOES NOT EXIST YET**.

**If you skip this setup, you'll see errors like:**
```
error code: -18
error message: Wallet file verification failed. Failed to load database path '/path/to/regtest/wallets/jevinwallet'. Path does not exist.
```

---

## Complete First-Time Setup (5 minutes)

### Step 1: Start Both Bitcoin Nodes

**Terminal 1 - Start Bitcoind:**
```bash
cd bitcoind_node
./start.sh
```

Wait 3 seconds, then...

**Terminal 2 - Start Cmempoold:**
```bash
cd cmempoold_node
./start.sh
```

Wait 5 seconds for both to fully start.

**Verify both are running:**
```bash
# Check bitcoind
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount
# Should return: 0

# Check cmempool
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount
# Should return: 0
```

✅ If both return `0`, nodes are running!

---

### Step 2: Create Wallet and Generate Coins

> **This is the MOST IMPORTANT step!** Without this, nothing will work.

```bash
# 1. Create the wallet named "jevinwallet"
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  createwallet "jevinwallet" false false "" false false true

# Expected output:
# {
#   "name": "jevinwallet",
#   "warning": ""
# }
```

**Why this wallet name?** All test commands use `-rpcwallet=jevinwallet`. If you use a different name, you'll need to update every command!

```bash
# 2. Generate 101 blocks to get spendable Bitcoin
# (Coinbase transactions need 100 confirmations before you can spend them)
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet -generate 101

# This creates 101 blocks, each with a 50 BTC coinbase reward
# After 100 confirmations, you'll have 50 BTC to spend!
```

**Wait for it to finish (takes ~5 seconds)**

```bash
# 3. Verify you have coins
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet getbalance

# Expected output: 50.00000000
```

✅ If you see `50.00000000`, you're good!

---

### Step 3: Sync Blocks to Cmempool Node

**Why?** Both nodes need the same blockchain state, or transactions will fail with "missing inputs" error.

```bash
# Sync all 101 blocks from bitcoind to cmempool
echo "Syncing 101 blocks to cmempool node..."

for height in {1..101}; do
    BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
    BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
    bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX" > /dev/null 2>&1
    
    # Show progress every 25 blocks
    if [ $((height % 25)) -eq 0 ]; then
        echo "  ✓ Synced $height/101 blocks..."
    fi
done

echo "✅ Block sync complete!"
```

**Wait for it to finish (takes ~10 seconds)**

```bash
# Verify both nodes are synced
echo "Bitcoind:  $(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount) blocks"
echo "Cmempool:  $(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount) blocks"

# Both should show: 101
```

**Check block hashes match:**
```bash
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash)

if [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ SYNCED! Both nodes on same chain"
else
    echo "❌ NOT SYNCED! Hashes differ"
fi
```

✅ You should see "SYNCED!"

---

### Step 4: Start API Server

**Terminal 3 - Start Rust API:**
```bash
cd /path/to/project/root  # Where main.rs is located
cargo run
```

**Expected output:**
```
Standard node block count: 101
Committed node block count: 101
API running at http://127.0.0.1:3000
```

✅ API is ready!

---

### Step 5: Test Everything Works

**Quick smoke test:**
```bash
# Create a test transaction
TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

# Get raw transaction
RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX" | jq -r '.hex')

# Broadcast it
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW"

# Check via API
curl -s http://localhost:3000/tx/$TX | jq '{txid, category, fee, size}'
```

**Expected output:**
```json
{
  "txid": "abc123...",
  "category": "Mempool",
  "fee": 0.00000141,
  "size": 141
}
```

✅ **SUCCESS!** Everything is working!

---

## Summary - You're Done! ✅

You've now:
1. ✅ Started both Bitcoin nodes
2. ✅ Created wallet "jevinwallet"
3. ✅ Generated 101 blocks with 50 BTC
4. ✅ Synced both nodes to same chain
5. ✅ Started API server
6. ✅ Tested transaction creation

**Next Steps:**
- Go to **README.md** for quick tests
- Go to **TESTING_GUIDE.md** for complete testing workflow

---

## What Happens If I Restart?

**Good news:** You only need to do this setup ONCE!

**Next time you start:**
1. Start both nodes: `./start.sh` in each directory
2. Start API: `cargo run`
3. **That's it!** Your wallet and blockchain data persist.

**The blockchain data is saved in:**
- `bitcoind_node/regtest/` (blocks, chainstate, wallets)
- `cmempoold_node/regtest/` (blocks, chainstate)

**If you want to completely reset** (start fresh):
```bash
# Stop nodes
bitcoin-cli -regtest -rpcport=18332 stop
bitcoin-cli -regtest -rpcport=19443 stop

# Delete data (wait 10 seconds after stopping)
rm -rf bitcoind_node/regtest
rm -rf cmempoold_node/regtest

# Then repeat this entire setup guide
```

---

## Common Errors During Setup

### Error: "Connection refused"
**Cause:** Node not running  
**Fix:** Start the node with `./start.sh`

### Error: "Wallet not found"
**Cause:** Skipped Step 2  
**Fix:** Go back and create the wallet

### Error: "Insufficient funds"
**Cause:** No coins yet  
**Fix:** Generate 101 blocks (Step 2)

### Error: "Missing inputs" (error code -25)
**Cause:** Nodes not synced  
**Fix:** Run block sync script (Step 3)

### Error: "Address does not refer to key"
**Cause:** Using wrong wallet  
**Fix:** Always use `-rpcwallet=jevinwallet`

---

**🎉 Setup complete! Now go test all 5 transaction categories!**
