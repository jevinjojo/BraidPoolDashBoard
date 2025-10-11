# 4-Stage Transaction System - Commands

## The 4 Stages

```
STAGE 1: MEMPOOL     → Transaction created in bitcoind
STAGE 2: COMMITTED   → Sent to cmempool
STAGE 3: PROPOSED    → Marked for review/approval
STAGE 4: SCHEDULED   → Ready for mining
         ↓
         CONFIRMED   → Mined into blockchain
```

---

## Complete Workflow for ONE Transaction

### Create Transaction (→ MEMPOOL)

```bash
# Create transaction
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)

# Broadcast
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW_TX"

echo "TXID: $TXID"

# Check category
curl -s http://localhost:3000/tx/$TXID | jq '{txid: .txid, category: .category}'
```
**Output:** `{"txid": "abc...", "category": "Mempool"}`

---

### STAGE 1 → 2: Commit (MEMPOOL → COMMITTED)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/commit | jq

# Check category
curl -s http://localhost:3000/tx/$TXID | jq '{txid: .txid, category: .category}'
```
**Output:** `{"txid": "abc...", "category": "Committed"}`

---

### STAGE 2 → 3: Propose (COMMITTED → PROPOSED)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/propose \
  -H "Content-Type: application/json" \
  -d '{}' | jq

# Check category
curl -s http://localhost:3000/tx/$TXID | jq '{txid: .txid, category: .category}'
```
**Output:** `{"txid": "abc...", "category": "Proposed"}`

---

### STAGE 3 → 4: Schedule (PROPOSED → SCHEDULED)

```bash
curl -s -X POST http://localhost:3000/transactions/$TXID/schedule | jq

# Check category
curl -s http://localhost:3000/tx/$TXID | jq '{txid: .txid, category: .category}'
```
**Output:** `{"txid": "abc...", "category": "Scheduled"}`

---

### STAGE 4 → 5: Mine (SCHEDULED → CONFIRMED)

```bash
# Mine block
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -generate 1

# Sync to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX"

# Check category
curl -s http://localhost:3000/tx/$TXID | jq '{txid: .txid, category: .category}'
```
**Output:** `{"txid": "abc...", "category": "Confirmed"}`

---

## Create 4 Different Transactions (One in Each Stage)

```bash
# Transaction 1: Mempool
TX1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)
RAW1=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX1" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW1"
echo "TX1 (Mempool): $TX1"

# Transaction 2: Committed
TX2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)
RAW2=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX2" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW2"
curl -s -X POST http://localhost:3000/transactions/$TX2/commit | jq
echo "TX2 (Committed): $TX2"

# Transaction 3: Proposed
TX3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)
RAW3=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX3" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW3"
curl -s -X POST http://localhost:3000/transactions/$TX3/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX3/propose -H "Content-Type: application/json" -d '{}' | jq
echo "TX3 (Proposed): $TX3"

# Transaction 4: Scheduled
TX4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001)
RAW4=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  -rpcwallet=jevinwallet gettransaction "$TX4" | jq -r '.hex')
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 \
  sendrawtransaction "$RAW4"
curl -s -X POST http://localhost:3000/transactions/$TX4/commit | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/propose -H "Content-Type: application/json" -d '{}' | jq
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule | jq
echo "TX4 (Scheduled): $TX4"

# View all 4 categories
echo ""
echo "=== DASHBOARD VIEW ==="
curl -s http://localhost:3000/transactions | jq '.[] | {txid, category, fee}'
```

---

## View Dashboard by Category

```bash
# All transactions
curl -s http://localhost:3000/transactions | jq

# Count by category
curl -s http://localhost:3000/transactions | jq 'group_by(.category) | map({category: .[0].category, count: length})'

# Filter by Mempool
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Mempool")'

# Filter by Committed
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Committed")'

# Filter by Proposed
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Proposed")'

# Filter by Scheduled
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Scheduled")'

# Filter by Confirmed
curl -s http://localhost:3000/transactions | jq '.[] | select(.category == "Confirmed")'
```

---

## One-Liner: Complete Flow

```bash
TXID=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -rpcwallet=jevinwallet sendtoaddress "bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy" 0.001) && \
RAW_TX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 -rpcwallet=jevinwallet gettransaction "$TXID" | jq -r '.hex') && \
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 sendrawtransaction "$RAW_TX" && \
echo "1. $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')" && \
curl -s -X POST http://localhost:3000/transactions/$TXID/commit > /dev/null && \
echo "2. $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')" && \
curl -s -X POST http://localhost:3000/transactions/$TXID/propose -H "Content-Type: application/json" -d '{}' > /dev/null && \
echo "3. $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')" && \
curl -s -X POST http://localhost:3000/transactions/$TXID/schedule > /dev/null && \
echo "4. $(curl -s http://localhost:3000/tx/$TXID | jq -r '.category')"
```

---

## API Endpoints

```
GET  /transactions                      # List all transactions
GET  /tx/{txid}                         # Get single transaction

POST /transactions/{txid}/commit        # Mempool → Committed
POST /transactions/{txid}/propose       # Committed → Proposed  
POST /transactions/{txid}/schedule      # Proposed → Scheduled

POST /beads/commit/{txid}               # Legacy (same as /commit)
```

---

## Example Dashboard Output

```bash
curl -s http://localhost:3000/transactions | jq '.[] | {txid, category}'
```

```json
[
  {"txid": "abc123...", "category": "Mempool"},
  {"txid": "def456...", "category": "Committed"},
  {"txid": "ghi789...", "category": "Proposed"},
  {"txid": "jkl012...", "category": "Scheduled"},
  {"txid": "mno345...", "category": "Confirmed"}
]
```

Perfect for your dashboard! 🎉
