# Pull Request Organization Guide

## 🤔 Is Frontend Separate?

**Question:** Is your frontend (React dashboard) in the **same repository** or a **different repository** from your backend (Rust API)?

### Scenario A: Same Repository (Monorepo)
```
BriadPool/
├── backend/                  # Rust API
│   ├── src/
│   │   ├── main.rs
│   │   └── api.rs
│   └── Cargo.toml
├── frontend/                 # React Dashboard
│   ├── src/
│   └── package.json
├── bitcoind_node/
└── cmempoold_node/
```

### Scenario B: Separate Repositories (Recommended for your case)
```
# Repository 1: braidpool-backend
BriadPool/
├── src/
│   ├── main.rs
│   └── api.rs
├── Cargo.toml
├── bitcoind_node/
├── cmempoold_node/
└── docs/

# Repository 2: braidpool-dashboard (separate repo)
braidpool-dashboard/
├── src/
│   ├── pages/
│   ├── utils/
│   └── types/
└── package.json
```

---

## 🎯 Recommended Approach

### If SAME REPO (Monorepo):
**Create 1 PR with everything:**
- Backend changes (Rust API)
- Frontend changes (React dashboard)
- Node configurations
- Documentation

### If SEPARATE REPOS (Most Common):
**Create 2 PRs in 2 different repositories:**

#### **PR #1: Backend Repository** (`braidpool-backend` or similar)
- Rust API code
- Node configurations
- Setup documentation

#### **PR #2: Frontend Repository** (`braidpool-dashboard` or similar)
- React dashboard code
- Frontend-specific docs

---

## 📦 What to Include in Backend PR

### Files to Include:

```
✅ Backend API (Rust)
├── src/
│   ├── main.rs
│   └── api.rs
└── Cargo.toml

✅ Node Configurations
├── bitcoind_node/
│   ├── bitcoin.conf
│   └── start.sh
└── cmempoold_node/
    ├── bitcoin.conf
    └── start.sh

✅ Documentation
├── README.md
├── FIRST_TIME_SETUP.md
├── TESTING_GUIDE.md
└── PROJECT_SETUP.md
```

### Files to EXCLUDE:

```
❌ Frontend code (if separate repo)
   - src/pages/
   - src/utils/braidpoolApi.ts (this is frontend file)
   - src/types/transaction.ts (frontend)
   - package.json (frontend)

❌ Temporary files
   - api_v2.rs
   - *.sh test scripts
   - Extra docs

❌ Build artifacts
   - target/
   - node_modules/
   - regtest/ data directories
```

---

## 📦 What to Include in Frontend PR (If Separate Repo)

### Files to Include:

```
✅ Frontend Code
├── src/
│   ├── pages/Transactions/
│   │   ├── index.ts
│   │   ├── TransactionsPage.tsx
│   │   └── TransactionTable.tsx
│   ├── utils/
│   │   └── braidpoolApi.ts
│   └── types/
│       └── transaction.ts
├── .env.development
└── package.json

✅ Frontend Documentation
└── FRONTEND_README.md (how to connect to API)
```

---

## 🚀 Step-by-Step: How to Raise the PR

### Step 1: Determine Your Repository Structure

**Check if frontend is in same repo:**
```bash
cd /workspace
ls -la

# Do you see both?
# - src/main.rs (backend)
# - src/pages/ or frontend/ (frontend)

# If YES → Same repo (1 PR)
# If NO → Separate repos (2 PRs)
```

---

## 📋 PR Checklist by Scenario

### Scenario A: Same Repository (1 PR)

**Branch name:**
```bash
git checkout -b feature/5-stage-transaction-system
```

**Files to include (10-15 files):**
```bash
# Backend
git add src/main.rs src/api.rs Cargo.toml

# Node configs
git add bitcoind_node/bitcoin.conf bitcoind_node/start.sh
git add cmempoold_node/bitcoin.conf cmempoold_node/start.sh

# Frontend
git add frontend/src/pages/Transactions/
git add frontend/src/utils/braidpoolApi.ts
git add frontend/src/types/transaction.ts
git add frontend/.env.development

# Docs
git add README.md FIRST_TIME_SETUP.md TESTING_GUIDE.md PROJECT_SETUP.md
```

**Commit message:**
```bash
git commit -m "Add 5-stage transaction management system

Backend:
- Implement Mempool → Committed → Proposed → Scheduled → Confirmed workflow
- Add REST API endpoints for transaction state management
- Calculate transaction metrics (vsize, fee, fee rate, inputs, outputs)

Frontend:
- Add transaction table with category filtering
- Display 5 transaction categories with auto-refresh
- Connect to BraidPool API

Infrastructure:
- Configure bitcoind and cmempool nodes
- Add comprehensive setup and testing documentation

Technical:
- API runs on port 3000 (Rust/Axum)
- Bitcoind on port 18332, Cmempool on port 19443
- Frontend connects via VITE_BRAIDPOOL_API_URL
- CORS enabled for dashboard integration"
```

---

### Scenario B: Separate Repositories (2 PRs)

#### **PR #1: Backend Repository**

**Repository:** `braidpool-backend` (or wherever main.rs lives)

**Branch name:**
```bash
git checkout -b feature/5-stage-transaction-api
```

**Files to include (9 files):**
```bash
# Backend
git add main.rs api.rs Cargo.toml

# Node configs
git add bitcoind_node/bitcoin.conf bitcoind_node/start.sh
git add cmempoold_node/bitcoin.conf cmempoold_node/start.sh

# Docs
git add README.md FIRST_TIME_SETUP.md TESTING_GUIDE.md PROJECT_SETUP.md
```

**Commit message:**
```bash
git commit -m "Add 5-stage transaction management API

Features:
- Implement Mempool → Committed → Proposed → Scheduled → Confirmed workflow
- Add REST API endpoints for transaction state management
- Calculate transaction metrics (vsize, fee, fee rate, inputs, outputs)
- Configure bitcoind and cmempool nodes

Technical:
- API runs on port 3000 (Rust/Axum)
- Bitcoind on port 18332 (RPC), Cmempool on port 19443 (RPC)
- In-memory state management with Mutex
- CORS enabled for dashboard integration

Endpoints:
- GET /transactions - List all transactions
- GET /tx/{txid} - Get transaction details
- POST /transactions/{txid}/commit - Move to Committed
- POST /transactions/{txid}/propose - Move to Proposed
- POST /transactions/{txid}/schedule - Move to Scheduled
- GET /mempool/info - Mempool statistics

Testing:
- See FIRST_TIME_SETUP.md for wallet creation
- See TESTING_GUIDE.md for complete testing instructions
- See PROJECT_SETUP.md for project structure"
```

**Push:**
```bash
git push origin feature/5-stage-transaction-api
```

---

#### **PR #2: Frontend Repository**

**Repository:** `braidpool-dashboard` (or wherever your React code is)

**Branch name:**
```bash
git checkout -b feature/5-stage-transaction-display
```

**Files to include (6 files):**
```bash
# Frontend components
git add src/pages/Transactions/index.ts
git add src/pages/Transactions/TransactionsPage.tsx
git add src/pages/Transactions/TransactionTable.tsx

# API integration
git add src/utils/braidpoolApi.ts

# Types
git add src/types/transaction.ts

# Config
git add .env.development
```

**Commit message:**
```bash
git commit -m "Add 5-stage transaction display

Features:
- Display transactions from BraidPool API
- Show 5 categories: Mempool, Committed, Proposed, Scheduled, Confirmed
- Category filtering with chips
- Auto-refresh every 30 seconds
- Transaction metrics table (size, fee, fee rate, inputs, outputs, time)

Technical:
- Connects to BraidPool API at http://localhost:3000
- Uses VITE_BRAIDPOOL_API_URL environment variable
- BraidPoolTransaction interface for type safety
- Retry logic with exponential backoff

Components:
- TransactionsPage: Main page with category legend
- TransactionTable: Table with filtering and auto-refresh
- BraidPoolApi: API client with error handling

Configuration:
- Set VITE_BRAIDPOOL_API_URL=http://localhost:3000 in .env"
```

**Push:**
```bash
git push origin feature/5-stage-transaction-display
```

---

## 📧 PR Description Templates

### Template for Backend PR:

```markdown
## Summary

This PR implements a 5-stage transaction management system for Bitcoin transactions:
Mempool → Committed → Proposed → Scheduled → Confirmed

## Changes

### Backend (Rust/Axum)
- ✅ Transaction state management API
- ✅ 6 REST endpoints for transaction operations
- ✅ Priority-based categorization logic
- ✅ Transaction metrics calculation

### Infrastructure
- ✅ Bitcoind node configuration (port 18332)
- ✅ Cmempool node configuration (port 19443)
- ✅ Node startup scripts

### Documentation
- ✅ FIRST_TIME_SETUP.md - Wallet creation and initial setup
- ✅ TESTING_GUIDE.md - Complete API testing instructions
- ✅ PROJECT_SETUP.md - Project structure with placeholders

## Testing

Follow the instructions in FIRST_TIME_SETUP.md:

1. Create wallet and generate coins
2. Start both nodes
3. Start API server
4. Test all 5 categories

All test commands and expected outputs are in TESTING_GUIDE.md.

## Related PRs

- Dashboard PR: [link to frontend PR if separate]
```

---

### Template for Frontend PR:

```markdown
## Summary

This PR adds the transaction management dashboard that displays 5 transaction categories from the BraidPool API.

## Changes

### Features
- ✅ Transaction table with 5 categories
- ✅ Category filtering
- ✅ Auto-refresh (30s interval)
- ✅ Transaction metrics display

### Components
- `TransactionsPage` - Main page with category legend
- `TransactionTable` - Table with filtering
- `braidpoolApi` - API client

### Configuration
- Uses `VITE_BRAIDPOOL_API_URL` to connect to backend
- Default: `http://localhost:3000`

## Testing

1. Start backend API (see backend repo)
2. Set environment variable:
   ```bash
   VITE_BRAIDPOOL_API_URL=http://localhost:3000
   ```
3. Run frontend:
   ```bash
   npm run dev
   ```
4. View transactions at http://localhost:5173/transactions

## Dependencies

- Backend API must be running at configured URL
- Backend PR: [link to backend PR if separate]
```

---

## 🎯 Summary: What to Do

### Step 1: Check Your Setup

```bash
# Are you in a monorepo or separate repos?
cd /workspace
ls -la

# If you see BOTH:
# - main.rs/api.rs (backend)
# - frontend/ or src/pages/ (frontend)
# → Same repo (1 PR)

# If you only see:
# - main.rs/api.rs (backend only)
# → Separate repos (2 PRs)
```

### Step 2: Choose Your Path

**Path A: Same Repo**
- Create 1 PR with all changes
- Include backend + frontend + docs

**Path B: Separate Repos**
- Create PR #1 in backend repo (9 files)
- Create PR #2 in frontend repo (6 files)

### Step 3: Follow the Checklist Above

Use the appropriate commit message and file list from above.

---

## ❓ Still Not Sure?

**Tell me:**
1. Where is your `main.rs` file? (full path)
2. Where is your `TransactionsPage.tsx` file? (full path)
3. Are they in the same git repository?

I'll give you the exact commands to run! 🚀
```

Done! 🎯
