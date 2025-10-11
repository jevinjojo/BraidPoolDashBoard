# Daily Startup and Transaction Commit Workflow

## Every Time You Start Working (Morning Routine)

### Step 1: Start Both Bitcoin Nodes

```bash
# Start bitcoind (standard node)
cd /mnt/c/Users/Jeffrin/Desktop/BriadPool/bitcoind_node
./start.sh

# Wait a moment
sleep 3

# Start cmempool (committed mempool node)
cd /mnt/c/Users/Jeffrin/Desktop/BriadPool/cmempoold_node
./start.sh

# Wait for both to fully start
sleep 5
```

### Step 2: Start Your API Server

```bash
# Navigate to your API project directory
cd /mnt/c/Users/Jeffrin/Desktop/BriadPool

# Start your Rust API server (replace with your actual command)
cargo run
# OR if you have a binary:
# ./your_api_binary
```

### Step 3: Verify Nodes Are Synced

**THIS IS CRITICAL - ALWAYS DO THIS BEFORE COMMITTING TRANSACTIONS!**

```bash
# Check both nodes are running and at same height
STD_COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
CM_COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount)

echo "Bitcoind height: $STD_COUNT"
echo "Cmempool height: $CM_COUNT"

# Check they're on the SAME chain (same hash)
STD_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash)

echo "Bitcoind hash:  $STD_HASH"
echo "Cmempool hash:  $CM_HASH"

if [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ NODES ARE SYNCED - Ready to work!"
else
    echo "❌ NODES NOT SYNCED - Need to sync them first!"
    echo "Run the sync script below..."
fi
```

### Step 4: If Nodes Are Out of Sync (Only if Step 3 fails)

```bash
# If cmempool is behind, sync it manually
CM_COUNT=$(bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount)
STD_COUNT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)

if [ "$CM_COUNT" -lt "$STD_COUNT" ]; then
    echo "Syncing blocks from $((CM_COUNT + 1)) to $STD_COUNT..."
    
    for height in $(seq $((CM_COUNT + 1)) $STD_COUNT); do
        BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $height)
        BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
        bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX" > /dev/null 2>&1
        
        if [ $((height % 10)) -eq 0 ]; then
            echo "Synced block $height..."
        fi
    done
    
    echo "✅ Sync complete!"
fi
```

---

## Transaction Commit Workflow (After Everything Is Running and Synced)

### Complete Workflow: Create → Broadcast → Commit → Verify

```bash
# 1. CREATE a new transaction
echo "Step 1: Creating transaction..."
NEWTXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.002)

echo "✅ Created transaction: $NEWTXID"
echo ""

# 2. GET the raw transaction hex
echo "Step 2: Getting raw transaction..."
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    -rpcwallet=jevinwallet gettransaction "$NEWTXID" | jq -r '.hex')

echo "✅ Got raw transaction"
echo ""

# 3. BROADCAST to bitcoind mempool
echo "Step 3: Broadcasting to bitcoind mempool..."
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    sendrawtransaction "$RAW_TX"

echo "✅ Transaction in bitcoind mempool"
echo ""

# 4. VERIFY it's in bitcoind mempool
echo "Step 4: Verifying in bitcoind mempool..."
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getrawmempool | jq

# Check via API (should show as "Mempool" category)
echo "Category before commit:"
curl -s "http://127.0.0.1:3000/tx/$NEWTXID" | jq '{txid, category}'
echo ""

# 5. COMMIT to cmempool via API
echo "Step 5: Committing to cmempool..."
curl -s -X POST "http://127.0.0.1:3000/beads/commit/$NEWTXID" | jq
echo ""

# 6. VERIFY it's in cmempool
echo "Step 6: Verifying in cmempool..."
sleep 1
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getrawmempool | jq

# Check via API (should NOW show as "Committed" category)
echo "Category after commit:"
curl -s "http://127.0.0.1:3000/tx/$NEWTXID" | jq '{txid, category}'
echo ""

# 7. VIEW all transactions via API
echo "Step 7: All transactions in system:"
curl -s "http://127.0.0.1:3000/transactions" | jq '.[] | {txid, category}'

echo ""
echo "✅✅✅ WORKFLOW COMPLETE! ✅✅✅"
echo "Transaction $NEWTXID is now COMMITTED!"
```

---

## Quick Reference Commands

### Check Node Status
```bash
# Bitcoind
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getrawmempool

# Cmempool
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getblockcount
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getrawmempool
```

### Check API Endpoints
```bash
# All transactions
curl -s http://127.0.0.1:3000/transactions | jq

# Specific transaction
curl -s http://127.0.0.1:3000/tx/TXID_HERE | jq

# Mempool info
curl -s http://127.0.0.1:3000/mempool/info | jq

# Commit transaction
curl -s -X POST http://127.0.0.1:3000/beads/commit/TXID_HERE | jq
```

### Mine Blocks (to confirm transactions)
```bash
# Mine 1 block on bitcoind
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1

# Then sync that block to cmempool (get the new block and submit it)
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
BLOCK_HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
BLOCK_HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $BLOCK_HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$BLOCK_HEX"
```

### Stop Everything (End of Day)
```bash
# Stop API server (Ctrl+C in the terminal where it's running)

# Stop bitcoind
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 stop

# Stop cmempool
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 stop

# Wait for shutdown
sleep 5

echo "✅ All nodes stopped"
```

---

## Transaction Categories Explained

After following the workflow, transactions will show these categories:

- **"Mempool"**: Transaction is ONLY in bitcoind's mempool (port 18332)
- **"Committed"**: Transaction is in cmempool's mempool (port 19443) ← **This is your goal!**
- **"Confirmed"**: Transaction is in a block (confirmations > 0)
- **"Replaced"**: Transaction was replaced by another (RBF)
- **"Unknown"**: Transaction not found anywhere

---

## Troubleshooting

### Problem: Nodes won't sync
**Solution:** Make sure bitcoind has `blocksonly=1` in config. This is intentional - you need to manually submit blocks.

### Problem: Error -25 "Missing inputs" when committing
**Solution:** Nodes are out of sync. Run Step 3 and Step 4 above to verify and sync.

### Problem: Transaction shows "Mempool" not "Committed" after commit
**Solution:** The commit failed. Check the API response for error details. Most likely nodes are out of sync.

### Problem: Can't create transactions - insufficient funds
**Solution:** Mine some blocks to the wallet:
```bash
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    -rpcwallet=jevinwallet -generate 101
```

---

## Important Notes

1. **Always verify sync before committing** - Use Step 3 every time!
2. **Manual block sync required** - Because of `blocksonly=1`, blocks don't auto-propagate
3. **After mining blocks** - Remember to sync that new block to cmempool
4. **Category changes** - A transaction moves from "Mempool" → "Committed" → "Confirmed" as it progresses
