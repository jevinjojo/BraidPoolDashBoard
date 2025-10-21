# BraidPool Integration Guide - Option 1: Separate Services

## 📋 Overview

This guide walks through integrating the Rust backend API (braidpoold) and updated frontend (dashboard) into the main Braidpool repository using a separate service architecture.

## 🏗️ Architecture

```
braidpool/
├── dashboard/          # Frontend React app
├── braidpoold/         # Backend Rust API (NEW)
├── config/             # Node configurations (NEW)
├── scripts/            # Helper scripts (NEW)
└── docs/               # Documentation (NEW)
```

## 📦 What Each Service Does

### 1. **dashboard/** (Frontend)
- **Technology**: React + TypeScript + Tailwind CSS + Vite
- **Port**: 5173 (development)
- **Purpose**: User interface for viewing and managing transactions
- **Updated Components**:
  - `TransactionsPage.tsx` - Migrated to Tailwind
  - `TransactionTable.tsx` - Migrated to Tailwind
  - `Card.tsx` - NEW reusable component
  - `TopStatsBar.tsx` - NEW stats dashboard
  - `transactionHelpers.ts` - NEW utility functions

### 2. **braidpoold/** (Backend API)
- **Technology**: Rust + Axum
- **Port**: 3000
- **Purpose**: REST API that orchestrates Bitcoin nodes
- **Endpoints**:
  - `POST /transactions/:txid/commit` - Commit transaction to mempool
  - `POST /transactions/:txid/schedule` - Schedule transaction
  - `POST /transactions/:txid/propose` - Propose transaction
  - `GET /transactions/recent` - Get recent transactions

### 3. **Bitcoin Nodes** (Infrastructure)
- **bitcoind** (Standard Mempool)
  - Port: 18332 (RPC), 18444 (P2P)
  - Purpose: Standard Bitcoin mempool operations
  
- **cmempoold** (Committed Mempool)
  - Port: 19443 (RPC), 19444 (P2P)
  - Purpose: Committed transactions only

## 🔄 Data Flow

```
User Browser
    ↓ HTTP (localhost:5173)
React Dashboard (Vite Dev Server)
    ↓ REST API (localhost:3000)
braidpoold (Rust/Axum)
    ↓                           ↓
bitcoind (18332)          cmempoold (19443)
```

## 🚀 Implementation Steps

### Step 1: Create braidpoold/ Directory

```bash
# In braidpool repo root
mkdir -p braidpoold/src braidpoold/tests
```

### Step 2: Copy Rust Backend Files

```bash
# Copy your Rust source files
cp /your/backend/main.rs braidpoold/src/
cp /your/backend/api.rs braidpoold/src/
cp /your/backend/Cargo.toml braidpoold/

# Copy tests
cp /your/backend/tests/*.rs braidpoold/tests/
```

### Step 3: Create Configuration Directory

```bash
# Create config structure
mkdir -p config/bitcoind config/cmempoold

# Move node configs
mv bitcoind_node/bitcoin.conf config/bitcoind/
mv cmempoold_node/bitcoin.conf config/cmempoold/
```

### Step 4: Create Helper Scripts

Create `scripts/start-all.sh` to start everything with one command.

### Step 5: Update Documentation

Create/update:
- `README.md` - Main readme with setup instructions
- `docs/ARCHITECTURE.md` - System architecture
- `docs/API.md` - API documentation
- `docs/DEVELOPMENT.md` - Development guide

## 🧪 Testing

### Test Each Service Independently

```bash
# 1. Test Rust API
cd braidpoold && cargo test

# 2. Test Frontend
cd dashboard && npm test

# 3. Test Integration (manual)
# - Start Bitcoin nodes
# - Start braidpoold
# - Start dashboard
# - Test transaction flow
```

## 📝 Development Workflow

### Starting Development Environment

```bash
# Terminal 1: Start Bitcoin nodes
./scripts/start-bitcoind.sh

# Terminal 2: Start committed mempool node  
./scripts/start-cmempoold.sh

# Terminal 3: Start Rust API
cd braidpoold && cargo run

# Terminal 4: Start Frontend
cd dashboard && npm run dev
```

### Making Changes

**Frontend changes:**
1. Edit files in `dashboard/src/`
2. Vite hot-reloads automatically
3. Run tests: `cd dashboard && npm test`

**Backend changes:**
1. Edit files in `braidpoold/src/`
2. Restart with `cargo run`
3. Run tests: `cargo test`

## 🐛 Troubleshooting

### Frontend can't connect to API
- Check braidpoold is running on port 3000
- Check CORS is enabled in `braidpoold/src/main.rs`
- Check `dashboard/src/utils/braidpoolApi.ts` has correct URL

### API can't connect to Bitcoin nodes
- Check bitcoind is running on port 18332
- Check cmempoold is running on port 19443
- Check credentials in node configs match API

### Transactions not committing
- Check both nodes are synced (same block height)
- Check transaction is valid (not coinbase, proper locktime)
- Check node logs for errors

## 📚 File Reference

### Key Files

| File | Purpose |
|------|---------|
| `braidpoold/src/main.rs` | API server entry point |
| `braidpoold/src/api.rs` | Route handlers |
| `dashboard/src/utils/braidpoolApi.ts` | API client |
| `config/bitcoind/bitcoin.conf` | Standard node config |
| `config/cmempoold/bitcoin.conf` | Committed node config |

## 🔐 Security Notes

- RPC credentials are in config files (DO NOT commit to public repo)
- Use environment variables for production
- CORS is set to `Any` for development (restrict in production)

## 🎯 Next Steps

After integration:
1. ✅ Test all endpoints
2. ✅ Update CI/CD pipeline
3. ✅ Add environment variable support
4. ✅ Consider Docker setup for easier deployment
5. ✅ Add monitoring/logging
