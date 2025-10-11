# Complete System Architecture
## How Bitcoind, BriadPool API, Cmempool, and Dashboard Connect

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR COMPUTER                            │
│                       (127.0.0.1 / localhost)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    DASHBOARD (Browser)                  │    │
│  │              http://localhost:3000 or 5173              │    │
│  │                                                          │    │
│  │  Shows:                                                  │    │
│  │  • Mempool transactions                                  │    │
│  │  • Committed transactions                                │    │
│  │  • Proposed transactions                                 │    │
│  │  • Scheduled transactions                                │    │
│  │  • Confirmed transactions                                │    │
│  └───────────────────────┬──────────────────────────────────┘    │
│                          │                                        │
│                          │ HTTP REST API calls                    │
│                          │ (GET /transactions, POST /commit, etc) │
│                          ▼                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              BRIADPOOL API SERVER (Rust)                │    │
│  │                   Port: 3000                            │    │
│  │                   /workspace/api.rs                     │    │
│  │                                                          │    │
│  │  Manages:                                                │    │
│  │  • Transaction state (Mempool/Committed/Proposed/       │    │
│  │    Scheduled)                                            │    │
│  │  • Business logic                                        │    │
│  │  • Connects to BOTH Bitcoin nodes                       │    │
│  │                                                          │    │
│  │  State Store:                                            │    │
│  │  ├─ committed: HashSet<Txid>                            │    │
│  │  ├─ proposed: HashSet<Txid>                             │    │
│  │  └─ scheduled: HashSet<Txid>                            │    │
│  └──────────────┬─────────────────────┬─────────────────────┘    │
│                 │                     │                           │
│                 │ RPC                 │ RPC                       │
│                 │ (JSON-RPC           │ (JSON-RPC                 │
│                 │  over HTTP)         │  over HTTP)               │
│                 │                     │                           │
│                 ▼                     ▼                           │
│  ┌─────────────────────┐   ┌─────────────────────────────┐      │
│  │  BITCOIND NODE      │   │    CMEMPOOL NODE            │      │
│  │  (Standard Node)    │   │  (Committed Mempool)        │      │
│  │                     │   │                              │      │
│  │  Port 18332 (RPC)  │   │  Port 19443 (RPC)           │      │
│  │  Port 18444 (P2P)  │◄─▶│  Port 19444 (P2P)           │      │
│  │                     │   │                              │      │
│  │  Location:          │   │  Location:                   │      │
│  │  bitcoind_node/     │   │  cmempoold_node/            │      │
│  │                     │   │                              │      │
│  │  Has:               │   │  Has:                        │      │
│  │  ✓ Wallet           │   │  ✗ No wallet                │      │
│  │  ✓ Can mine         │   │  ✗ Cannot mine              │      │
│  │  ✓ Creates tx       │   │  ✗ Cannot create tx         │      │
│  │  ✓ Mempool          │   │  ✓ Mempool                  │      │
│  │  ✓ Blockchain       │   │  ✓ Blockchain (synced)      │      │
│  └─────────────────────┘   └─────────────────────────────┘      │
│           │                           │                           │
│           │         P2P Network       │                           │
│           │    (Block propagation)    │                           │
│           └───────────────────────────┘                           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1️⃣ BITCOIND NODE (Primary Bitcoin Node)

**What it is:**
- A full Bitcoin Core node running in regtest mode
- The "source of truth" for your Bitcoin network

**Location:**
```
/mnt/c/Users/Jeffrin/Desktop/BriadPool/bitcoind_node/
├── bitcoin.conf    (configuration)
├── start.sh        (startup script)
└── regtest/        (blockchain data)
```

**Ports:**
- **18332** = RPC (Remote Procedure Call) - API commands
- **18444** = P2P (Peer-to-Peer) - Node communication

**What it does:**
1. ✅ **Creates transactions** (has wallet with funds)
2. ✅ **Mines blocks** (proof-of-work)
3. ✅ **Maintains blockchain** (stores all blocks)
4. ✅ **Has mempool** (pending transactions)
5. ✅ **Validates transactions** (checks signatures, UTXOs, etc.)
6. ✅ **Relays blocks** to cmempool via P2P

**Special setting:**
```ini
blocksonly=1
```
This means it ONLY relays BLOCKS via P2P, NOT transactions.
This is why you need the API to manually send transactions to cmempool.

---

### 2️⃣ CMEMPOOL NODE (Committed Mempool Node)

**What it is:**
- Another Bitcoin Core node, but without wallet
- Receives only "committed" transactions via API

**Location:**
```
/mnt/c/Users/Jeffrin/Desktop/BriadPool/cmempoold_node/
├── bitcoin.conf    (configuration)
├── start.sh        (startup script)
└── regtest/        (blockchain data)
```

**Ports:**
- **19443** = RPC (API commands)
- **19444** = P2P (Node communication)

**What it does:**
1. ✅ **Receives blocks** from bitcoind automatically (P2P)
2. ✅ **Maintains blockchain** (synced with bitcoind)
3. ✅ **Has separate mempool** (only committed transactions)
4. ❌ **No wallet** (cannot create transactions)
5. ❌ **Cannot mine** (no mining capability)

**Purpose:**
- Holds only transactions you've explicitly "committed"
- Separate mempool = priority queue for mining
- In production: miners would focus on this node

---

### 3️⃣ BRIADPOOL API SERVER (Rust Application)

**What it is:**
- Your custom Rust application using Axum web framework
- The "brain" that orchestrates everything

**Location:**
```
/workspace/
├── main.rs         (entry point)
├── api.rs          (all the logic)
└── Cargo.toml      (dependencies)
```

**Port:**
- **3000** = HTTP REST API

**What it does:**

#### A. Connects to BOTH nodes:
```rust
let bitcoind = connect_to_bitcoind();   // Port 18332
let cmempool = connect_to_cmempoold();  // Port 19443
```

#### B. Manages Transaction State:
```rust
STATE {
  committed: {tx1, tx2, tx3},    // In cmempool
  proposed: {tx2, tx3},           // Marked for review
  scheduled: {tx3}                // Ready to mine
}
```

#### C. Provides API Endpoints:

**For Dashboard:**
```
GET /transactions         → List all transactions
GET /tx/{txid}           → Get single transaction
GET /mempool/info        → Statistics
```

**For Transaction Management:**
```
POST /transactions/{txid}/commit    → Mempool → Committed
POST /transactions/{txid}/propose   → Committed → Proposed
POST /transactions/{txid}/schedule  → Proposed → Scheduled
```

#### D. Categorizes Transactions:
```rust
fn detect_category(txid, in_bitcoind, in_cmempool, confirmations) {
  if confirmations > 0       → "Confirmed"
  if in STATE.scheduled      → "Scheduled"
  if in STATE.proposed       → "Proposed"
  if in cmempool             → "Committed"
  if in bitcoind only        → "Mempool"
}
```

---

### 4️⃣ DASHBOARD (Web Frontend)

**What it is:**
- Web interface (HTML/JavaScript/React/Vue/etc.)
- Displays transaction data in nice UI

**Runs on:**
- Your browser (Chrome, Firefox, etc.)
- Typically served from localhost:5173 or similar

**What it does:**
1. **Calls API endpoints** to get data:
   ```javascript
   fetch('http://localhost:3000/transactions')
     .then(res => res.json())
     .then(data => displayTransactions(data))
   ```

2. **Displays categories:**
   - 📦 Mempool column
   - 📮 Committed column
   - 📋 Proposed column
   - 📅 Scheduled column
   - ✅ Confirmed column

3. **Allows actions:**
   - Click "Commit" button → calls `POST /transactions/{txid}/commit`
   - Click "Propose" button → calls `POST /transactions/{txid}/propose`
   - Click "Schedule" button → calls `POST /transactions/{txid}/schedule`

---

## How They Communicate

### Connection Map

```
Dashboard
   │
   │ HTTP (REST API)
   ▼
BriadPool API ─────RPC────▶ Bitcoind Node
   │                            │
   │                            │ P2P (blocks only)
   │                            ▼
   └──────RPC────▶ Cmempool Node
```

### Communication Protocols

#### 1. **Dashboard ↔ API** (HTTP REST)
```
Dashboard: GET http://localhost:3000/transactions
API: Returns JSON: [{txid: "abc", category: "Mempool"}, ...]
```

#### 2. **API ↔ Bitcoind** (Bitcoin RPC)
```
API: POST http://127.0.0.1:18332/
Body: {"method":"getrawmempool","params":[]}
Bitcoind: Returns: ["txid1", "txid2", ...]
```

#### 3. **API ↔ Cmempool** (Bitcoin RPC)
```
API: POST http://127.0.0.1:19443/
Body: {"method":"sendrawtransaction","params":["0200000..."]}
Cmempool: Returns: "txid123..."
```

#### 4. **Bitcoind ↔ Cmempool** (P2P Protocol)
```
Bitcoind mines block:
  │
  ├─ Creates block with transactions
  │
  └─ Sends "inv" message: "I have new block"
      │
      ▼
Cmempool receives:
  │
  ├─ Sends "getdata": "Send me that block"
  │
  └─ Receives block data
      │
      └─ Validates and adds to blockchain
```

---

## Complete Transaction Flow

Let's follow a transaction through the entire system:

### Step 1: Create Transaction

```
YOU run:
  bitcoin-cli sendtoaddress "address" 0.001

       ▼
   
BITCOIND:
  • Creates transaction from wallet
  • Signs with private key
  • Adds to local mempool
  • TX is now in bitcoind mempool

       ▼

DASHBOARD (if you refresh):
  • API calls /transactions
  • API queries bitcoind mempool
  • Finds transaction
  • Returns: category = "Mempool"
  • Shows in Mempool column
```

### Step 2: Commit Transaction

```
YOU click "Commit" button in Dashboard
  OR run: curl -X POST .../commit

       ▼

DASHBOARD:
  • Sends POST /transactions/{txid}/commit

       ▼

API SERVER:
  • Receives request
  • Connects to bitcoind
  • Gets transaction: get_raw_transaction(txid)
  • Connects to cmempool
  • Sends transaction: send_raw_transaction(tx)

       ▼

CMEMPOOL:
  • Receives transaction
  • Validates (checks signatures, UTXOs)
  • Adds to its mempool
  • Returns success

       ▼

API SERVER:
  • Updates STATE.committed.insert(txid)
  • Returns success to dashboard

       ▼

DASHBOARD:
  • Transaction moves to Committed column
```

### Step 3: Propose Transaction

```
YOU click "Propose" button

       ▼

DASHBOARD:
  • Sends POST /transactions/{txid}/propose

       ▼

API SERVER:
  • Checks if in committed state
  • Updates STATE.proposed.insert(txid)
  • Returns success

       ▼

DASHBOARD:
  • Transaction moves to Proposed column
```

### Step 4: Schedule Transaction

```
YOU click "Schedule" button

       ▼

DASHBOARD:
  • Sends POST /transactions/{txid}/schedule

       ▼

API SERVER:
  • Checks if in proposed state
  • Updates STATE.scheduled.insert(txid)
  • Returns success

       ▼

DASHBOARD:
  • Transaction moves to Scheduled column
```

### Step 5: Mine Block (Confirm)

```
YOU run:
  bitcoin-cli -generate 1

       ▼

BITCOIND:
  • Selects transactions from mempool
  • Creates new block
  • Mines block (finds valid nonce)
  • Adds block to blockchain
  • Removes tx from mempool

       ▼ (P2P Network)

CMEMPOOL:
  • Receives new block via P2P
  • Validates block
  • Adds to blockchain
  • Removes tx from mempool

       ▼

DASHBOARD (if you refresh):
  • API queries both nodes
  • Sees confirmations > 0
  • Returns: category = "Confirmed"
  • Shows in Confirmed column
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│ Step 1: CREATE TRANSACTION                           │
│                                                       │
│ You → bitcoind wallet → bitcoind mempool             │
│                                                       │
│ State: MEMPOOL                                        │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│ Step 2: COMMIT TRANSACTION                           │
│                                                       │
│ Dashboard → API → get tx from bitcoind               │
│                → send tx to cmempool                  │
│                → cmempool mempool                     │
│                                                       │
│ State: COMMITTED                                      │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│ Step 3: PROPOSE TRANSACTION                          │
│                                                       │
│ Dashboard → API → STATE.proposed.insert(txid)        │
│                                                       │
│ State: PROPOSED                                       │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│ Step 4: SCHEDULE TRANSACTION                         │
│                                                       │
│ Dashboard → API → STATE.scheduled.insert(txid)       │
│                                                       │
│ State: SCHEDULED                                      │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│ Step 5: MINE BLOCK (CONFIRM)                         │
│                                                       │
│ You → bitcoind mines → block created                 │
│     → P2P → cmempool receives block                  │
│     → both nodes: tx in blockchain                   │
│                                                       │
│ State: CONFIRMED                                      │
└──────────────────────────────────────────────────────┘
```

---

## Network Ports Summary

| Component | RPC Port | P2P Port | Protocol |
|-----------|----------|----------|----------|
| **Bitcoind** | 18332 | 18444 | Bitcoin RPC + P2P |
| **Cmempool** | 19443 | 19444 | Bitcoin RPC + P2P |
| **API Server** | 3000 | - | HTTP REST |
| **Dashboard** | (browser) | - | HTTP |

---

## File Structure

```
/mnt/c/Users/Jeffrin/Desktop/BriadPool/
├── bitcoind_node/
│   ├── bitcoin.conf      # Config: RPC credentials, ports
│   ├── start.sh          # Startup script
│   └── regtest/          # Blockchain data
│       ├── blocks/       # Block files
│       ├── chainstate/   # UTXO set
│       └── wallets/      # Wallet data
│
├── cmempoold_node/
│   ├── bitcoin.conf      # Config: RPC credentials, ports
│   ├── start.sh          # Startup script
│   └── regtest/          # Blockchain data (synced)
│       ├── blocks/       # Block files (same as bitcoind)
│       └── chainstate/   # UTXO set (same as bitcoind)
│
└── /workspace/
    ├── main.rs           # API entry point
    ├── api.rs            # All business logic
    └── Cargo.toml        # Rust dependencies
```

---

## Key Concepts

### 1. State Management

The API server maintains **in-memory state**:
```rust
STATE {
  committed: HashSet<Txid>,   // Which txs are in cmempool
  proposed: HashSet<Txid>,    // Which txs are proposed
  scheduled: HashSet<Txid>,   // Which txs are scheduled
}
```

This state is **NOT persisted to disk** - if you restart the API, it's lost.

### 2. Category Detection

When dashboard requests transaction data:
```rust
1. Check if confirmed (in blockchain) → "Confirmed"
2. Check if in STATE.scheduled → "Scheduled"
3. Check if in STATE.proposed → "Proposed"
4. Check if in cmempool → "Committed"
5. Check if in bitcoind → "Mempool"
```

### 3. Synchronization

**Critical requirement:** Both nodes must have same blockchain!

```
If blocks don't match:
  ├─ Bitcoind has UTXO abc:0
  ├─ Cmempool doesn't have UTXO abc:0
  └─ Transaction spending abc:0 → ERROR -25 "Missing inputs"
```

---

## Summary

**The 4 components work together like this:**

1. **Bitcoind** = Source of truth (creates transactions, mines blocks)
2. **Cmempool** = Secondary node (receives committed transactions)
3. **API** = Orchestrator (manages state, connects everything)
4. **Dashboard** = User interface (displays data, allows actions)

**Data flow:**
```
Transaction created in Bitcoind
    ↓
API commits to Cmempool
    ↓
Dashboard shows categories
    ↓
User moves through stages
    ↓
Block mined, appears confirmed everywhere
```

That's your complete system! 🎉
