# Commands for 3-Tier Transaction System

## Step 1: Update Your Code

```bash
# Replace old api.rs with new version
cd /workspace
cp api_v2.rs api.rs

# Restart your API server
# Press Ctrl+C to stop current server, then:
cargo run
```

## Step 2: Start Everything

```bash
# Start bitcoind
cd /mnt/c/Users/Jeffrin/Desktop/BriadPool/bitcoind_node
./start.sh

# Start cmempool
cd /mnt/c/Users/Jeffrin/Desktop/BriadPool/cmempoold_node
./start.sh

# Start API (in workspace directory)
cd /workspace
cargo run
```

## Step 3: Create a Test Transaction

```bash
# Create transaction (will go to Mempool stage)
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

echo "Created transaction: $TXID"

# Broadcast to bitcoind mempool
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW_TX"
```

## Step 4: Use the 3-Tier System

### View Dashboard Statistics

```bash
curl -s http://localhost:3000/dashboard/stats | jq
```

**Response:**
```json
{
  "mempool_count": 1,
  "proposed_count": 0,
  "scheduled_count": 0,
  "confirmed_count": 0,
  "total_mempool_fee": 0.00001,
  "total_proposed_fee": 0,
  "total_scheduled_fee": 0
}
```

### View Transactions by Stage

```bash
# View all Mempool transactions
curl -s http://localhost:3000/dashboard/mempool | jq

# View all Proposed transactions
curl -s http://localhost:3000/dashboard/proposed | jq

# View all Scheduled transactions
curl -s http://localhost:3000/dashboard/scheduled | jq
```

### Step A: Propose a Transaction (Mempool → Proposed)

```bash
# Propose with notes
curl -s -X POST http://localhost:3000/transactions/$TXID/propose \
  -H "Content-Type: application/json" \
  -d '{"notes": "High priority customer"}' | jq

# Propose without notes
curl -s -X POST http://localhost:3000/transactions/$TXID/propose \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Response:**
```json
{
  "status": "ok",
  "txid": "abc123...",
  "message": "Transaction proposed"
}
```

**Check it:**
```bash
curl -s http://localhost:3000/dashboard/stats | jq
# Now proposed_count = 1, mempool_count = 0
```

### Step B: Schedule a Transaction (Proposed → Scheduled)

```bash
# Schedule the transaction (commits to cmempool)
curl -s -X POST http://localhost:3000/transactions/$TXID/schedule | jq
```

**Response:**
```json
{
  "status": "ok",
  "txid": "abc123...",
  "message": "Transaction scheduled successfully"
}
```

**Check it:**
```bash
curl -s http://localhost:3000/dashboard/stats | jq
# Now scheduled_count = 1, proposed_count = 0

# Verify it's in cmempool
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getrawmempool
```

### Reject a Transaction (Remove from Proposed)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/reject | jq
```

### Unschedule a Transaction (Remove from Scheduled)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/unschedule | jq
```

## Step 5: Bulk Operations

### Propose Multiple Transactions

```bash
# Create 3 transactions
TX1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)
TX2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

# Broadcast all
for tx in $TX1 $TX2 $TX3; do
  RAW=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    -rpcwallet=jevinwallet gettransaction "$tx" | jq -r '.hex')
  bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
    sendrawtransaction "$RAW"
done

# Propose all at once
curl -s -X POST http://localhost:3000/transactions/bulk/propose \
  -H "Content-Type: application/json" \
  -d "{\"txids\": [\"$TX1\", \"$TX2\", \"$TX3\"]}" | jq
```

### Schedule Multiple Transactions

```bash
# Schedule all at once
curl -s -X POST http://localhost:3000/transactions/bulk/schedule \
  -H "Content-Type: application/json" \
  -d "{\"txids\": [\"$TX1\", \"$TX2\", \"$TX3\"]}" | jq
```

## Step 6: View Transaction Details with Metadata

```bash
curl -s http://localhost:3000/tx/$TXID | jq
```

**Response:**
```json
{
  "txid": "abc123...",
  "category": "Proposed",
  "fee": 0.00001,
  "fee_rate": 5.5,
  "confirmations": 0,
  "metadata": {
    "proposed_at": 1728567890,
    "scheduled_at": null,
    "notes": "High priority customer"
  },
  ...
}
```

## Step 7: Mine Block (Confirm Transactions)

```bash
# Mine a block
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1

# Sync block to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX"

# Check transaction is now Confirmed
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Confirmed"
```

## Quick Reference: All Endpoints

```bash
# Dashboard
GET  /dashboard/stats          # Statistics
GET  /dashboard/mempool        # Mempool stage transactions
GET  /dashboard/proposed       # Proposed stage transactions  
GET  /dashboard/scheduled      # Scheduled stage transactions

# Transaction Management
POST /transactions/{txid}/propose      # Mempool → Proposed
POST /transactions/{txid}/schedule     # Proposed → Scheduled
POST /transactions/{txid}/reject       # Remove from Proposed
POST /transactions/{txid}/unschedule   # Remove from Scheduled

# Bulk Operations
POST /transactions/bulk/propose        # Propose multiple
POST /transactions/bulk/schedule       # Schedule multiple

# Original Endpoints
GET  /transactions             # All transactions
GET  /tx/{txid}               # Single transaction
GET  /mempool/info            # Mempool statistics
```

## Complete Workflow Example

```bash
# 1. Create transaction
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW_TX"

echo "Transaction: $TXID"

# 2. Check it's in Mempool
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Mempool"

# 3. Propose it
curl -s -X POST http://localhost:3000/transactions/$TXID/propose \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved by manager"}' | jq

# 4. Check it's Proposed
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Proposed"

# 5. Schedule it
curl -s -X POST http://localhost:3000/transactions/$TXID/schedule | jq

# 6. Check it's Scheduled
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Scheduled"

# 7. View dashboard
curl -s http://localhost:3000/dashboard/stats | jq

# 8. Mine block to confirm
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX"

# 9. Check it's Confirmed
curl -s http://localhost:3000/tx/$TXID | jq '.category'
# Returns: "Confirmed"
```

## Troubleshooting

### If you get "Transaction must be proposed before scheduling"
```bash
# Propose it first
curl -s -X POST http://localhost:3000/transactions/$TXID/propose \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

### If you get "Nodes not synchronized"
```bash
# Check sync
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getbestblockhash
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 getbestblockhash

# If different, sync them (see DAILY_WORKFLOW.md)
```

### View all stages at once
```bash
echo "=== MEMPOOL ==="
curl -s http://localhost:3000/dashboard/mempool | jq '.[].txid'

echo "=== PROPOSED ==="
curl -s http://localhost:3000/dashboard/proposed | jq '.[].txid'

echo "=== SCHEDULED ==="
curl -s http://localhost:3000/dashboard/scheduled | jq '.[].txid'
```
