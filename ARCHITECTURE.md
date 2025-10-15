# BriadPool System Architecture

## Overview

Your system implements a **two-tier mempool architecture** for Bitcoin transactions in regtest mode. It consists of three main components that work together to manage and categorize transactions.

---

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      YOUR APPLICATION                        │
│                  (Frontend/Client/User)                      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP REST API
                         │ (port 3000)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    API SERVER (Rust)                         │
│                    main.rs + api.rs                          │
│  - GET  /transactions      (list all)                       │
│  - GET  /tx/{txid}         (get one)                        │
│  - GET  /mempool/info      (stats)                          │
│  - POST /beads/commit/{txid} (commit to cmempool)           │
└───────────┬─────────────────────────┬───────────────────────┘
            │                         │
            │ Bitcoin RPC             │ Bitcoin RPC
            │ (port 18332)            │ (port 19443)
            ▼                         ▼
┌─────────────────────┐    ┌─────────────────────────────────┐
│  BITCOIND NODE      │◄──►│     CMEMPOOL NODE               │
│  (Standard Node)    │ P2P│  (Committed Mempool Node)       │
│                     │    │                                  │
│ - RPC: 18332        │    │ - RPC: 19443                     │
│ - P2P: 18444        │    │ - P2P: 19444                     │
│ - User: jevinrpc    │    │ - User: cmempoolrpc              │
│ - Wallet: jevinwallet│   │ - No wallet (mempool only)       │
│                     │    │                                  │
│ Config:             │    │ Config:                          │
│ - blocksonly=1      │    │ - No blocksonly                  │
│ - txindex=1         │    │ - connect=bitcoind               │
│ - Has mining wallet │    │ - Receives blocks from bitcoind  │
└─────────────────────┘    └─────────────────────────────────┘
```

---

## Component Details

### 1. BITCOIND NODE (Standard Bitcoin Node)

**Location:** `/mnt/c/Users/Jeffrin/Desktop/BriadPool/bitcoind_node`

**Purpose:** 
- Primary Bitcoin node for creating transactions
- Holds the mining wallet with funds
- First destination for new transactions
- Maintains the canonical blockchain

**Configuration (bitcoin.conf):**
```ini
regtest=1                    # Running in regression test mode
rpcport=18332               # RPC API port
port=18444                  # P2P network port
rpcuser=jevinrpc
rpcpassword=securepass123
blocksonly=1                # Only relay blocks, NOT transactions (important!)
txindex=1                   # Index all transactions for lookups
addnode=127.0.0.1:19444    # Connect to cmempool node
```

**Key Characteristics:**
- ✅ Has a wallet (`jevinwallet`) with funds
- ✅ Can create and sign new transactions
- ✅ Can mine blocks (`-generate` command)
- ✅ First stop for all new transactions
- ⚠️ `blocksonly=1` means it won't relay transactions via P2P
- ✅ Blocks ARE relayed to cmempool via P2P

**What It Does:**
1. Creates new transactions from wallet
2. Stores them in its mempool
3. Mines blocks to confirm transactions
4. Relays blocks (but NOT transactions) to cmempool

---

### 2. CMEMPOOL NODE (Committed Mempool Node)

**Location:** `/mnt/c/Users/Jeffrin/Desktop/BriadPool/cmempoold_node`

**Purpose:**
- Second-tier mempool for "committed" transactions
- Transactions here are considered "committed" by your application
- Represents transactions that have been explicitly selected/promoted

**Configuration (bitcoin.conf):**
```ini
regtest=1
rpcport=19443               # Different RPC port
port=19444                  # Different P2P port
rpcuser=cmempoolrpc
rpcpassword=securepass456
addnode=127.0.0.1:18444    # Connect to bitcoind
connect=127.0.0.1:18444    # ONLY connect to bitcoind (no other peers)
# NOTE: No blocksonly - can receive transactions
# NOTE: No wallet - only holds mempool
```

**Key Characteristics:**
- ❌ No wallet (cannot create transactions)
- ✅ Can receive transactions via API
- ✅ Receives blocks from bitcoind via P2P
- ✅ Maintains same blockchain as bitcoind
- ⚠️ Only gets blocks automatically, transactions must be manually submitted

**What It Does:**
1. Receives blocks from bitcoind (auto-syncs via P2P)
2. Receives transactions via your API's commit endpoint
3. Maintains a separate mempool of "committed" transactions
4. Shares the same blockchain/UTXO set as bitcoind

---

### 3. API SERVER (Rust/Axum)

**Location:** `/workspace/main.rs` + `/workspace/api.rs`

**Purpose:**
- Bridge between your application and the Bitcoin nodes
- Provides REST API for transaction management
- Categorizes transactions based on their location
- Handles the "commit" workflow

**Connections:**
```rust
// Connects to BOTH nodes
Standard Node:  http://127.0.0.1:18332 (jevinrpc / securepass123)
Committed Node: http://127.0.0.1:19443 (cmempoolrpc / securepass456)
```

**API Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/transactions` | GET | List ALL transactions from both mempools |
| `/tx/{txid}` | GET | Get details of a specific transaction |
| `/mempool/info` | GET | Get mempool statistics |
| `/beads/commit/{txid}` | POST | Commit a transaction from bitcoind to cmempool |

**Transaction Categories:**

The API categorizes every transaction based on where it exists:

```rust
fn detect_category(txid, in_std, in_cpool, confirmations) -> String {
    if confirmations > 0      → "Confirmed"   // In a block
    if in_cpool               → "Committed"   // In cmempool
    if in_std                 → "Mempool"     // In bitcoind only
    if was_seen_before        → "Replaced"    // RBF replaced
    else                      → "Unknown"
}
```

---

## Transaction Flow (Complete Lifecycle)

### Phase 1: Transaction Creation

```
┌─────────────┐
│   USER      │
│  (You/App)  │
└──────┬──────┘
       │ 1. Create transaction
       │    bitcoin-cli sendtoaddress ...
       ▼
┌─────────────────────┐
│  BITCOIND WALLET    │
│  (jevinwallet)      │
│  - Signs tx         │
│  - Broadcasts to    │
│    local mempool    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ BITCOIND MEMPOOL    │
│ [Mempool Category]  │◄─── Transaction is here, NOT in cmempool yet
└─────────────────────┘
       │
       │ ⚠️ STOPS HERE! blocksonly=1 prevents P2P relay
       │
       ▼
   (nowhere else)
```

**At this point:**
- ✅ Transaction exists in bitcoind's mempool
- ❌ Transaction is NOT in cmempool
- 🏷️ API shows category: **"Mempool"**

---

### Phase 2: Transaction Commit (The Key Step!)

```
┌─────────────┐
│   USER      │
│  (You/App)  │
└──────┬──────┘
       │ 2. Commit transaction
       │    POST /beads/commit/{txid}
       ▼
┌─────────────────────────────────────────┐
│           API SERVER                    │
│  commit_tx_to_cmempoold()               │
│                                         │
│  1. Fetch tx from bitcoind              │
│     ├─ Check UTXO validity              │
│     └─ Get raw transaction hex          │
│                                         │
│  2. Verify nodes are synced             │
│     ├─ Compare block heights            │
│     └─ Check UTXO set exists            │
│                                         │
│  3. Submit to cmempool                  │
│     └─ send_raw_transaction()           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│ CMEMPOOL MEMPOOL    │
│ [Committed Category]│◄─── Transaction is NOW here!
└─────────────────────┘
```

**At this point:**
- ✅ Transaction exists in bitcoind's mempool
- ✅ Transaction exists in cmempool's mempool  
- 🏷️ API shows category: **"Committed"**

---

### Phase 3: Transaction Confirmation

```
┌─────────────┐
│   USER      │
│  (You/App)  │
└──────┬──────┘
       │ 3. Mine block
       │    bitcoin-cli -generate 1
       ▼
┌─────────────────────┐
│   BITCOIND NODE     │
│  - Mines block      │
│  - Includes tx      │
│  - Removes from     │
│    mempool          │
└──────┬──────────────┘
       │
       │ Block relayed via P2P
       │ (blocksonly=1 allows block relay)
       ▼
┌─────────────────────┐
│   CMEMPOOL NODE     │
│  - Receives block   │
│  - Confirms tx      │
│  - Removes from     │
│    mempool          │
└─────────────────────┘
```

**At this point:**
- ✅ Transaction is in blockchain on BOTH nodes
- ❌ Transaction is NOT in any mempool (confirmed!)
- 🏷️ API shows category: **"Confirmed"**

---

## Data Flow Diagrams

### GET /transactions - How It Works

```
┌──────────────────────────────────────────────────┐
│ Client: GET http://localhost:3000/transactions   │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │   API SERVER        │
         └─────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│  BITCOIND    │      │  CMEMPOOL    │
│ getrawmempool│      │ getrawmempool│
└──────┬───────┘      └──────┬───────┘
       │                     │
       │ [tx1, tx2, tx3]     │ [tx2, tx4]
       │                     │
       └──────────┬──────────┘
                  │
                  ▼
         ┌────────────────┐
         │ UNION: Merge   │
         │ [tx1,tx2,tx3,  │
         │  tx4]          │
         └────────┬───────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │ For each txid:              │
    │  1. Check in bitcoind?      │
    │  2. Check in cmempool?      │
    │  3. Get confirmations       │
    │  4. Determine category      │
    │  5. Build ApiTransaction    │
    └─────────────┬───────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Response: [                             │
│   {txid: tx1, category: "Mempool"},     │
│   {txid: tx2, category: "Committed"},   │
│   {txid: tx3, category: "Mempool"},     │
│   {txid: tx4, category: "Committed"}    │
│ ]                                       │
└─────────────────────────────────────────┘
```

### POST /beads/commit/{txid} - The Commit Flow

```
┌───────────────────────────────────────────────────────┐
│ Client: POST http://localhost:3000/beads/commit/abc123│
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │   API SERVER        │
         │ commit_tx_to_       │
         │ cmempoold()         │
         └─────────┬───────────┘
                   │
        Step 1: Check if already committed
                   │
                   ▼
         ┌─────────────────────┐
         │   CMEMPOOL NODE     │
         │ get_mempool_entry?  │
         └─────────┬───────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    Already exists?         Not exists?
         │                   │
         ▼                   ▼
    Return OK           Continue...
    "already                   │
    committed"                 │
                          Step 2: Get tx from bitcoind
                               │
                               ▼
                     ┌─────────────────────┐
                     │   BITCOIND NODE     │
                     │ get_raw_transaction │
                     └─────────┬───────────┘
                               │
                     Raw TX hex + UTXO info
                               │
                          Step 3: Get blockchain heights
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Check sync:          │
                    │ - bitcoind height    │
                    │ - cmempool height    │
                    │ (for diagnostics)    │
                    └──────────┬───────────┘
                               │
                          Step 4: Submit to cmempool
                               │
                               ▼
                     ┌─────────────────────┐
                     │   CMEMPOOL NODE     │
                     │ send_raw_transaction│
                     └─────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              Success?                Error?
                    │                     │
                    ▼                     ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ Return:          │  │ Return:          │
         │ {                │  │ {                │
         │  status: "ok",   │  │  status: "error",│
         │  txid: ...,      │  │  diagnostics: {  │
         │  message:        │  │   error: ...,    │
         │  "committed"     │  │   hint: ...,     │
         │ }                │  │   heights: ...   │
         │                  │  │  }               │
         │ TX now in        │  │ }                │
         │ cmempool!        │  │                  │
         └──────────────────┘  └──────────────────┘
```

---

## Why This Architecture?

### Two-Tier Mempool Benefits

1. **Transaction Prioritization**
   - "Mempool" = Unvetted, newly arrived transactions
   - "Committed" = Reviewed, approved, prioritized transactions
   - Your application can treat them differently

2. **Workflow Control**
   - You explicitly control which transactions get "committed"
   - Prevents spam or unwanted transactions from being processed
   - Enables selective transaction handling

3. **Separation of Concerns**
   - `bitcoind`: Transaction creation and blockchain management
   - `cmempool`: Transaction commitment and prioritization
   - `API`: Business logic and categorization

4. **Mining Pool Use Case** (BriadPool = Braid Pool?)
   - Standard node receives all transactions
   - Committed node only has transactions selected for next block
   - Miners can focus on committed transactions

---

## Critical Synchronization Requirements

### Why Nodes MUST Be Synced

```
SCENARIO: Nodes out of sync

Bitcoind:  Block 623 (hash: ABC...)
           └─ UTXO: tx_input_123 exists ✅

Cmempool:  Block 620 (hash: XYZ...)
           └─ UTXO: tx_input_123 doesn't exist ❌

When you try to commit a transaction that spends tx_input_123:
❌ ERROR -25: Missing inputs
```

**The transaction references UTXOs from bitcoind's blockchain that don't exist in cmempool's blockchain.**

### How Sync Happens

1. **Blocks** (Automatic via P2P):
   ```
   Bitcoind mines block → P2P relay → Cmempool receives block
   ```
   ✅ This works even with `blocksonly=1`

2. **Transactions** (Manual via API):
   ```
   Transaction created → In bitcoind only → API commit → In cmempool
   ```
   ⚠️ This requires explicit API call due to `blocksonly=1`

---

## Configuration Deep Dive

### Why `blocksonly=1` on Bitcoind?

**Purpose:** Prevent automatic transaction relay to cmempool

**Effect:**
- ✅ Blocks ARE relayed via P2P
- ❌ Transactions are NOT relayed via P2P
- ✅ Forces explicit "commit" workflow
- ✅ Gives you control over which transactions reach cmempool

**Without `blocksonly=1`:**
- All transactions would automatically propagate to cmempool
- No distinction between "Mempool" and "Committed"
- Your two-tier architecture wouldn't work

### Why `connect=127.0.0.1:18444` on Cmempool?

**Purpose:** Only connect to bitcoind, no other peers

**Effect:**
- ✅ Guarantees same blockchain as bitcoind
- ✅ Prevents external transaction injection
- ✅ Controlled environment
- ✅ In regtest, ensures no split chains

---

## Transaction State Machine

```
┌─────────────┐
│   CREATED   │ ← bitcoin-cli sendtoaddress
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  MEMPOOL    │ ← In bitcoind mempool only
│ (Category)  │   API: category = "Mempool"
└──────┬──────┘
       │
       │ POST /beads/commit/{txid}
       ▼
┌─────────────┐
│ COMMITTED   │ ← In BOTH mempools
│ (Category)  │   API: category = "Committed"
└──────┬──────┘
       │
       │ bitcoin-cli -generate (mine block)
       ▼
┌─────────────┐
│ CONFIRMED   │ ← In blockchain, not in mempools
│ (Category)  │   API: category = "Confirmed"
└─────────────┘
       │
       │ (or if RBF replaced before mining)
       ▼
┌─────────────┐
│  REPLACED   │ ← Replaced by another tx
│ (Category)  │   API: category = "Replaced"
└─────────────┘
```

---

## Common Operations

### 1. Create a New Transaction
```bash
# Creates tx in bitcoind wallet → automatically enters bitcoind mempool
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 \
  -rpcport=18332 -rpcwallet=jevinwallet \
  sendtoaddress "address" 0.002
```
**Result:** Transaction in "Mempool" category

### 2. Commit a Transaction
```bash
# Moves tx from bitcoind mempool → cmempool mempool
curl -X POST http://localhost:3000/beads/commit/{txid}
```
**Result:** Transaction in "Committed" category

### 3. Confirm a Transaction
```bash
# Mine a block on bitcoind
bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 \
  -rpcport=18332 -generate 1

# Sync that block to cmempool (manual because of blocksonly=1)
HEIGHT=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockcount)
HASH=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblockhash $HEIGHT)
HEX=$(bitcoin-cli -regtest -rpcuser=jevinrpc -rpcpassword=securepass123 -rpcport=18332 getblock $HASH 0)
bitcoin-cli -regtest -rpcuser=cmempoolrpc -rpcpassword=securepass456 -rpcport=19443 submitblock "$HEX"
```
**Result:** Transaction in "Confirmed" category

---

## Summary

Your system is a **controlled two-tier mempool architecture** where:

1. **Bitcoind** is the source of truth for transactions and blockchain
2. **Cmempool** is a filtered view containing only "committed" transactions
3. **API** provides the business logic to categorize and move transactions between tiers
4. **Explicit commit workflow** gives you control over which transactions are prioritized

This architecture is ideal for:
- Mining pool management (selecting which transactions to mine)
- Transaction review workflows (approve before processing)
- Spam prevention (only commit legitimate transactions)
- Custom transaction prioritization algorithms
