# Testing Guide - 5-Stage Transaction System

## Prerequisites

- [x] Bitcoin Core installed
- [x] Rust toolchain installed
- [x] jq installed (for JSON formatting)

---

## Setup

### 1. Start Both Nodes

**Bitcoind Node (Standard):**
```bash
# Terminal 1
cd bitcoind_node
./start.sh
sleep 10
```

**Cmempool Node (Committed Mempool):**
```bash
# Terminal 2
cd cmempoold_node
./start.sh
sleep 10
```

**Verify both nodes are running:**

> Replace `<RPCUSER>`, `<RPC_PASSWORD>`, `<CMEMPOOL_USER>`, `<CMEMPOOL_PASSWORD>` with values from your `bitcoin.conf` files.

```bash
# Bitcoind
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblockcount

# Cmempool
bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 getblockcount

# Both should return: 0 (fresh start)
```

---

### 2. Create Wallet and Generate Spendable Coins

**Create wallet:**
```bash
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  createwallet "<WALLET_NAME>"
```

> **Note:** If you need the wallet to auto-load on startup, use:
> ```bash
> bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
>   createwallet "<WALLET_NAME>" false false "" false false true
> ```

**Generate 101 blocks to get spendable coins:**
```bash
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> -generate 101
```

> **Why 101 blocks?** Coinbase transactions require 100 confirmations before they can be spent.

**Verify wallet has funds:**
```bash
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> getbalance

# Should show: 50.00000000 (or more)
```

---

### 3. Sync Blocks to Cmempool Node

**⚠️ CRITICAL:** Both nodes must have the same blockchain state!

**Sync all 101 blocks:**
```bash
for height in {1..101}; do
    HASH=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblockhash $height)
    HEX=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblock $HASH 0)
    bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 submitblock "$HEX" > /dev/null 2>&1
done

echo "✅ Sync complete!"
```

**Verify nodes are synced (check BOTH height and hash):**
```bash
# Check block heights
STD_COUNT=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblockcount)
CM_COUNT=$(bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 getblockcount)

echo "Bitcoind height:  $STD_COUNT"
echo "Cmempool height:  $CM_COUNT"

# Check block hashes
STD_HASH=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getbestblockhash)
CM_HASH=$(bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 getbestblockhash)

echo "Bitcoind hash:    $STD_HASH"
echo "Cmempool hash:    $CM_HASH"

if [ "$STD_COUNT" == "$CM_COUNT" ] && [ "$STD_HASH" == "$CM_HASH" ]; then
    echo "✅ SYNCED - Both nodes on same chain at height $STD_COUNT"
else
    echo "❌ NOT SYNCED - Run sync script above again"
fi
```

---

### 4. Start the Rust API Server

```bash
# Terminal 3
cd braidpoold
cargo run
```

**Expected output:**
```
Standard node block count: 101
Committed node block count: 101   ← MUST match Standard!
API running at http://127.0.0.1:3000
```

**✅ If both show 101:** Ready to test!  
**❌ If different:** Go back to Step 3 and sync blocks.

---

### 5. Start Dashboard (Optional)

```bash
# Terminal 4
cd dashboard
npm run dev -- --port 5173
```

**Dashboard will be available at:** `http://localhost:5173`

> **Important:** Dashboard runs on port 5173, API runs on port 3000. They are separate apps!

---

## Testing the 5 Categories

### Before Testing

**Clear both mempools to start fresh:**
```bash
# Stop nodes
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 stop
bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 stop
sleep 5

# Delete mempool data
rm -f bitcoind_node/regtest/mempool.dat
rm -f cmempoold_node/regtest/mempool.dat

# Restart nodes
cd bitcoind_node && ./start.sh
sleep 10
cd ../cmempoold_node && ./start.sh
sleep 10

# Verify both mempools are empty
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getrawmempool
bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 getrawmempool
# Both should show: []
```

---

### Create Transactions in All 5 Categories

**Set address:**
```bash
ADDRESS="bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy"
```

---

#### 1. Mempool

```bash
echo "1️⃣ Creating MEMPOOL transaction..."

TX1=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)

RAW1=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> gettransaction "$TX1" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW1" > /dev/null

sleep 1
echo "TXID: $TX1"
echo "Category: $(curl -s http://localhost:3000/tx/$TX1 | jq -r '.category')"
echo "✅ Check dashboard - transaction should appear in Mempool category"
echo ""
```

---

#### 2. Committed

```bash
echo "2️⃣ Creating COMMITTED transaction..."

TX2=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)

RAW2=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> gettransaction "$TX2" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW2" > /dev/null

sleep 1
curl -s -X POST http://localhost:3000/transactions/$TX2/commit | jq

sleep 1
echo "TXID: $TX2"
echo "Category: $(curl -s http://localhost:3000/tx/$TX2 | jq -r '.category')"
echo "✅ Check dashboard - transaction should appear in Committed category"
echo ""
```

---

#### 3. Proposed

```bash
echo "3️⃣ Creating PROPOSED transaction..."

TX3=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)

RAW3=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> gettransaction "$TX3" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW3" > /dev/null

sleep 1
curl -s -X POST http://localhost:3000/transactions/$TX3/commit | jq
sleep 1
curl -s -X POST http://localhost:3000/transactions/$TX3/propose \
  -H "Content-Type: application/json" -d '{}' | jq

sleep 1
echo "TXID: $TX3"
echo "Category: $(curl -s http://localhost:3000/tx/$TX3 | jq -r '.category')"
echo "✅ Check dashboard - transaction should appear in Proposed category"
echo ""
```

---

#### 4. Scheduled

```bash
echo "4️⃣ Creating SCHEDULED transaction..."

TX4=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)

RAW4=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> gettransaction "$TX4" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW4" > /dev/null

sleep 1
curl -s -X POST http://localhost:3000/transactions/$TX4/commit | jq
sleep 1
curl -s -X POST http://localhost:3000/transactions/$TX4/propose \
  -H "Content-Type: application/json" -d '{}' | jq
sleep 1
curl -s -X POST http://localhost:3000/transactions/$TX4/schedule | jq

sleep 1
echo "TXID: $TX4"
echo "Category: $(curl -s http://localhost:3000/tx/$TX4 | jq -r '.category')"
echo "✅ Check dashboard - transaction should appear in Scheduled category"
echo ""
```

---

#### 5. Confirmed

```bash
echo "5️⃣ Creating CONFIRMED transaction..."

TX5=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> sendtoaddress "$ADDRESS" 0.001)

RAW5=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> gettransaction "$TX5" | jq -r '.hex')

bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  sendrawtransaction "$RAW5" > /dev/null

sleep 1

# Mine a block to confirm transaction
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -generate 1 > /dev/null

# Sync the new block to cmempool
HEIGHT=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=<CMEMPOOL_USER> -rpcpassword=<CMEMPOOL_PASSWORD> -rpcport=19443 \
  submitblock "$HEX" > /dev/null

sleep 2
echo "TXID: $TX5"
echo "Category: $(curl -s http://localhost:3000/tx/$TX5 | jq -r '.category')"
echo "Confirmations: $(curl -s http://localhost:3000/tx/$TX5 | jq -r '.confirmations')"
echo "✅ Check dashboard - transaction should appear in Confirmed category"
echo ""
```

---

### Summary

**View all transactions:**
```bash
echo "All Transactions:"
echo "1. Mempool:    $TX1"
echo "2. Committed:  $TX2"
echo "3. Proposed:   $TX3"
echo "4. Scheduled:  $TX4"
echo "5. Confirmed:  $TX5"
echo ""

# Category counts
echo "Count by Category:"
curl -s http://localhost:3000/transactions | \
  jq 'group_by(.category) | map({category: .[0].category, count: length})'

echo ""

# Transaction details
echo "Transaction Details:"
curl -s http://localhost:3000/transactions | \
  jq '.[] | {txid, category, fee, fee_rate, size, inputs, outputs}'
```

**Expected output:**
```json
[
  {"category": "Mempool", "count": 1},
  {"category": "Committed", "count": 1},
  {"category": "Proposed", "count": 1},
  {"category": "Scheduled", "count": 1},
  {"category": "Confirmed", "count": 1}
]
```

---

## API Endpoints

- `GET /transactions` - List all transactions
- `GET /tx/{txid}` - Get transaction details
- `POST /transactions/{txid}/commit` - Move transaction to Committed (sends to cmempool)
- `POST /transactions/{txid}/propose` - Move transaction to Proposed
- `POST /transactions/{txid}/schedule` - Move transaction to Scheduled
- `GET /mempool/info` - Get mempool statistics

---

## Configuration

### RPC Credentials

Defined in `bitcoin.conf` files:

**bitcoind_node/bitcoin.conf:**
```conf
rpcuser=<RPCUSER>
rpcpassword=<RPC_PASSWORD>
rpcport=18332
```

**cmempoold_node/bitcoin.conf:**
```conf
rpcuser=<CMEMPOOL_USER>
rpcpassword=<CMEMPOOL_PASSWORD>
rpcport=19443
```

### Ports

- **Bitcoind RPC:** 18332
- **Bitcoind P2P:** 18444
- **Cmempool RPC:** 19443
- **Cmempool P2P:** 19444
- **API Server:** 3000
- **Dashboard:** 5173 (if using Vite)

---

## Dashboard Setup

**Start dashboard on separate port:**
```bash
cd dashboard
npm run dev -- --port 5173
```

**Access dashboard at:** `http://localhost:5173`

**Configure API URL in `.env.development`:**
```
VITE_USE_BRAIDPOOL_API=true
VITE_BRAIDPOOL_API_URL=http://localhost:3000
VITE_ESPLORA_API_URL=http://localhost:3000
```

> **Important:** Use `http://` not `https://`

---

## Troubleshooting

### Issue: "Wallet not found"
**Solution:** Load wallet or use `createwallet` with `load_on_startup=true`
```bash
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  loadwallet "<WALLET_NAME>"
```

### Issue: "Insufficient funds"
**Solution:** Generate more blocks
```bash
bitcoin-cli -regtest -rpcuser=<RPCUSER> -rpcpassword=<RPC_PASSWORD> -rpcport=18332 \
  -rpcwallet=<WALLET_NAME> -generate 101
```

### Issue: Error -25 "Missing inputs"
**Solution:** Nodes not synced. Both block count AND block hash must match!
```bash
# Check sync (see Step 3 above)
```

### Issue: "Connection refused"
**Solution:** Node not running or not ready yet
```bash
# Wait 10 seconds after starting
sleep 10
# Then retry
```

### Issue: Dashboard shows "Failed to load transactions"
**Solution:** Check:
1. API is running on port 3000
2. Dashboard is on different port (5173)
3. `.env.development` has correct API URL
4. No CORS errors in browser console (F12)

---

## Expected Test Results

After running all 5 transaction tests:

```json
[
  {"category": "Mempool", "count": 1},
  {"category": "Committed", "count": 1},
  {"category": "Proposed", "count": 1},
  {"category": "Scheduled", "count": 1},
  {"category": "Confirmed", "count": 1}
]
```

**All transactions should also appear in the dashboard at `http://localhost:5173`**

---

## Notes

- Test address used: `bcrt1qa2sr0ehdyp48a5t74uxaexpd90em43vqxt4djy`
- Wallet name is configurable (replace `<WALLET_NAME>`)
- RPC credentials from `bitcoin.conf` files
- All testing on regtest (private test network)
