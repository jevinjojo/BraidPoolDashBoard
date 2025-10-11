# Three-Tier Transaction Management System Design

## Overview

Your new system will have **3 stages** for transactions:

```
┌─────────────┐
│   MEMPOOL   │  ← All new transactions arrive here
└──────┬──────┘
       │ User action: "Propose this transaction"
       ▼
┌─────────────┐
│  PROPOSED   │  ← Reviewed/selected for processing
└──────┬──────┘
       │ User action: "Schedule this transaction"
       ▼
┌─────────────┐
│  SCHEDULED  │  ← Committed to cmempool, ready to mine
└──────┬──────┘
       │ Mine block
       ▼
┌─────────────┐
│  CONFIRMED  │  ← In blockchain
└─────────────┘
```

## Workflow

### Stage 1: MEMPOOL
**What**: All transactions in bitcoind's mempool
**Who manages**: Automatically - when transactions are created
**Where stored**: Bitcoind mempool only

### Stage 2: PROPOSED
**What**: Transactions you've reviewed and marked as "good"
**Who manages**: You decide via API
**Where stored**: In-memory state (or database)
**Purpose**: Review queue before committing

### Stage 3: SCHEDULED
**What**: Transactions committed to cmempool, ready for next block
**Who manages**: You decide via API
**Where stored**: Cmempool mempool
**Purpose**: Final queue for mining

### Stage 4: CONFIRMED
**What**: Transactions mined into blockchain
**Who manages**: Automatic when block is mined
**Where stored**: Blockchain

## State Storage

We'll use a simple in-memory store (can be upgraded to database later):

```rust
// Transaction state
enum TransactionStage {
    Mempool,
    Proposed,
    Scheduled,
    Confirmed,
    Replaced,
}

// State store
struct StateStore {
    proposed: HashSet<Txid>,    // Txids marked as proposed
    scheduled: HashSet<Txid>,   // Txids scheduled (in cmempool)
    metadata: HashMap<Txid, TransactionMetadata>,
}

struct TransactionMetadata {
    proposed_at: Option<u64>,
    proposed_by: Option<String>,
    scheduled_at: Option<u64>,
    notes: Option<String>,
}
```

## API Endpoints

### Dashboard Endpoints

```
GET /dashboard/stats
  Returns: { mempool_count, proposed_count, scheduled_count, confirmed_count }

GET /dashboard/mempool
  Returns: [transactions in mempool stage]

GET /dashboard/proposed
  Returns: [transactions in proposed stage]

GET /dashboard/scheduled
  Returns: [transactions in scheduled stage]
```

### Transaction Management Endpoints

```
POST /transactions/{txid}/propose
  Action: Move transaction from Mempool → Proposed
  Body: { "notes": "optional reason" }

POST /transactions/{txid}/schedule
  Action: Move transaction from Proposed → Scheduled (commits to cmempool)
  
POST /transactions/{txid}/reject
  Action: Remove from Proposed (back to Mempool)

POST /transactions/{txid}/unschedule
  Action: Remove from Scheduled (remove from cmempool)
```

### Batch Operations

```
POST /transactions/bulk/propose
  Body: { "txids": ["abc...", "def..."] }
  Action: Propose multiple transactions at once

POST /transactions/bulk/schedule
  Body: { "txids": ["abc...", "def..."] }
  Action: Schedule multiple transactions at once
```

## Database Schema (Optional - for persistence)

If you want to persist state across restarts:

```sql
CREATE TABLE transaction_states (
  txid TEXT PRIMARY KEY,
  stage TEXT NOT NULL,  -- 'proposed' or 'scheduled'
  proposed_at INTEGER,
  scheduled_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_stage ON transaction_states(stage);
```

## Implementation Plan

### Phase 1: Basic State Management ✅
- Add in-memory state store
- Track proposed/scheduled transactions
- Update category detection logic

### Phase 2: API Endpoints ✅
- Implement propose/schedule/reject endpoints
- Add bulk operations
- Add validation and error handling

### Phase 3: Dashboard API ✅
- Implement dashboard statistics endpoint
- Add filtered transaction lists
- Include metadata in responses

### Phase 4: (Optional) Persistence
- Add SQLite database
- Migrate state store to DB
- Add state recovery on startup
