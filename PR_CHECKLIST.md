# Pull Request Checklist

## ✅ Files to Include in PR

### Core Application Files
```
✅ main.rs                         # API entry point
✅ api.rs                          # Transaction management logic
```

### Bitcoin Node Configuration
```
✅ bitcoind_node/bitcoin.conf      # Standard node configuration  
✅ bitcoind_node/start.sh          # Start script for bitcoind
✅ cmempoold_node/bitcoin.conf     # Committed mempool configuration
✅ cmempoold_node/start.sh         # Start script for cmempoold
```

### Documentation
```
✅ README.md                       # Quick start guide (MUST INCLUDE!)
✅ TESTING_GUIDE.md                # Complete testing instructions
```

## ❌ Files to EXCLUDE from PR

### Temporary/Development Files
```
❌ api_v2.rs                       # Old version - DELETE
❌ START_AND_TEST.sh               # Dev script - DELETE
❌ COMPLETE_COMMANDS.sh            # Dev script - DELETE
```

### Optional Documentation (Too Much Detail)
```
❌ ARCHITECTURE.md                 # Too detailed
❌ DAILY_WORKFLOW.md               # Too detailed
❌ DEEP_DIVE_EXPLANATION.md        # Too detailed
❌ ULTRA_DEEP_DIVE.md              # Too detailed
❌ THREE_TIER_DESIGN.md            # Old design doc
❌ FOUR_STAGES.md                  # Redundant with README
❌ SIMPLE_COMMANDS.md              # Redundant with TESTING_GUIDE
❌ COMMANDS.md                     # Redundant with TESTING_GUIDE
❌ SYSTEM_ARCHITECTURE.md          # Redundant with README
❌ PR_CHECKLIST.md                 # This file (only for you)
```

### Build Artifacts & Data
```
❌ target/                         # Rust build directory
❌ bitcoind_node/regtest/          # Node data (git ignored)
❌ cmempoold_node/regtest/         # Node data (git ignored)
❌ *.log                           # Log files
❌ .git/                           # Git metadata (automatic)
```

---

## Git Commands to Use

### 1. Clean Up Unnecessary Files First
```bash
cd /workspace

# Delete old/temporary files
rm -f api_v2.rs
rm -f START_AND_TEST.sh
rm -f COMPLETE_COMMANDS.sh
rm -f ARCHITECTURE.md
rm -f DAILY_WORKFLOW.md
rm -f DEEP_DIVE_EXPLANATION.md
rm -f ULTRA_DEEP_DIVE.md
rm -f THREE_TIER_DESIGN.md
rm -f FOUR_STAGES.md
rm -f SIMPLE_COMMANDS.md
rm -f COMMANDS.md
rm -f SYSTEM_ARCHITECTURE.md

echo "✅ Cleanup complete!"
```

### 2. Check What Will Be Committed
```bash
git status
```

**You should see ONLY these files:**
- `main.rs`
- `api.rs`
- `README.md`
- `TESTING_GUIDE.md`
- `bitcoind_node/bitcoin.conf`
- `bitcoind_node/start.sh`
- `cmempoold_node/bitcoin.conf`
- `cmempoold_node/start.sh`

### 3. Add Files to Git
```bash
# Add specific files (RECOMMENDED)
git add main.rs api.rs
git add README.md TESTING_GUIDE.md
git add bitcoind_node/bitcoin.conf bitcoind_node/start.sh
git add cmempoold_node/bitcoin.conf cmempoold_node/start.sh

# Check what's staged
git status
```

### 4. Commit Changes
```bash
git commit -m "Add 5-stage transaction management system

Features:
- Implement Mempool → Committed → Proposed → Scheduled → Confirmed workflow
- Add REST API endpoints for transaction state management
- Calculate transaction metrics (vsize, fee, fee rate, inputs, outputs)
- Configure bitcoind and cmempool nodes with RPC settings
- Add priority-based categorization logic
- Include comprehensive testing guide with all credentials

Technical details:
- API runs on port 3000 (Rust/Axum)
- Bitcoind on port 18332 (RPC)
- Cmempool on port 19443 (RPC)
- In-memory state management with Mutex
- CORS enabled for dashboard integration

Testing:
- See README.md for quick start
- See TESTING_GUIDE.md for complete testing instructions
- All credentials and wallet names included for easy testing"
```

### 5. Push to Remote
```bash
# Push to your branch
git push origin <your-branch-name>

# Example:
# git push origin cursor/commit-raw-bitcoin-transaction-and-debug-82b4
```

---

## Message to Mentor

**Subject:** PR Ready - 5-Stage Transaction Management System

**Body:**

Hi [Mentor Name],

I've completed the 5-stage transaction management system and pushed it to branch `[BRANCH_NAME]`.

**What's Included:**
- ✅ Core Rust application (`main.rs`, `api.rs`)
- ✅ Bitcoin node configurations (bitcoind + cmempool)
- ✅ README.md with quick start instructions
- ✅ TESTING_GUIDE.md with complete testing steps

**Quick Test (Takes 2 minutes):**

1. **Start nodes:**
   ```bash
   cd bitcoind_node && ./start.sh
   cd cmempoold_node && ./start.sh
   ```

2. **Start API:**
   ```bash
   cargo run
   ```

3. **Test all 5 categories** - Just copy-paste the test block from README.md

**Key Features:**
- 5 transaction categories (Mempool → Committed → Proposed → Scheduled → Confirmed)
- REST API endpoints for moving transactions between stages
- Transaction metrics calculation (size vB, fee BTC, fee rate sats/vB, in/out counts)
- Priority-based categorization logic
- API on port 3000, connects to bitcoind (18332) and cmempool (19443)

**All Testing Info Included:**
- RPC credentials (jevinrpc / cmempoolrpc)
- Wallet name (jevinwallet)
- All curl commands with examples
- Expected outputs
- Troubleshooting guide

Everything needed to test is in **README.md** and **TESTING_GUIDE.md**.

Ready for review!

Thanks,
[Your Name]

---

## Final Checklist Before Pushing

- [ ] Deleted all temporary files (`api_v2.rs`, `*.sh` dev scripts, extra docs)
- [ ] Only 8 files being committed (2 .rs, 2 .md, 4 node config files)
- [ ] Ran `git status` to verify clean state
- [ ] Tested locally that README.md instructions work
- [ ] Commit message includes features, technical details, and testing info
- [ ] Pushed to correct branch
- [ ] Ready to send message to mentor

---

**✅ You're ready to push!**

The mentor will have everything they need:
1. Quick start in README.md (copy-paste commands)
2. Complete guide in TESTING_GUIDE.md
3. All credentials and configuration included
4. Clear expected outputs
5. Troubleshooting section

**Total files: 8 files (perfect PR size!)**
