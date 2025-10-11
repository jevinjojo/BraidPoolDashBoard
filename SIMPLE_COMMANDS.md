# Simple Commands - Mempool, Proposed, Scheduled, Confirmed

## The 4 Stages

```
1. MEMPOOL    → Transaction just created
2. PROPOSED   → You marked it for review  
3. SCHEDULED  → Committed to cmempool
4. CONFIRMED  → Mined into blockchain
```

## Complete Workflow

### Step 1: Create Transaction (→ Mempool)

```bash
# Create transaction
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

# Broadcast it
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW_TX"

echo "Transaction: $TXID"
```

**Check it's Mempool:**
```bash
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Mempool"
```

### Step 2: Propose Transaction (Mempool → Proposed)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/propose \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Check it's Proposed:**
```bash
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Proposed"
```

### Step 3: Schedule Transaction (Proposed → Scheduled)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/schedule | jq
```

**Check it's Scheduled:**
```bash
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Scheduled"

# Also verify in cmempool
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getrawmempool
```

### Step 4: Mine Block (Scheduled → Confirmed)

```bash
# Mine block
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1

# Sync block to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX"
```

**Check it's Confirmed:**
```bash
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Confirmed"
```

## View All Transactions

```bash
# See all transactions with their categories
curl -s http://localhost:3000/transactions | jq '.[] | {txid, category, fee}'
```

## Quick Test

```bash
# One-liner to test entire flow
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001) && \
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex') && \
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 sendrawtransaction "$RAW_TX" && \
echo "1. Mempool: $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')" && \
curl -s -X POST http://localhost:3000/transactions/$TXID/propose -H "Content-Type: application/json" -d '{}' > /dev/null && \
echo "2. Proposed: $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')" && \
curl -s -X POST http://localhost:3000/transactions/$TXID/schedule > /dev/null && \
echo "3. Scheduled: $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')"
```

## API Endpoints

```bash
GET  /transactions              # List all
GET  /tx/{txid}                 # Get one transaction
POST /transactions/{txid}/propose   # Mempool → Proposed
POST /transactions/{txid}/schedule  # Proposed → Scheduled
POST /beads/commit/{txid}       # Direct commit (skips proposed)
```

## Notes

- **Old `/beads/commit/{txid}`** still works but skips the "Proposed" stage
- **Must propose before schedule** or you'll get an error
- **Scheduled** means it's in cmempool (same as old "Committed")
- Categories are automatically updated when transactions are mined
