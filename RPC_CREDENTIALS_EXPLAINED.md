# RPC Credentials - Where Do They Come From?

## 🔑 The Answer: You Set Them in bitcoin.conf Files!

The RPC usernames and passwords are **NOT auto-generated** by Bitcoin Core. **You manually configure them** in the `bitcoin.conf` file for each node.

---

## 📍 Where Are They Defined?

### Bitcoind Node Credentials

**File:** `bitcoind_node/bitcoin.conf`

```conf
regtest=1
server=1
rpcuser=jevinrpc           ← YOU SET THIS
rpcpassword=securepass123  ← YOU SET THIS
rpcport=18332

[regtest]
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
```

**These credentials are:**
- **rpcuser:** `jevinrpc` (can be anything you want)
- **rpcpassword:** `securepass123` (can be anything you want)
- **rpcport:** `18332` (default regtest RPC port)

---

### Cmempool Node Credentials

**File:** `cmempoold_node/bitcoin.conf`

```conf
regtest=1
server=1
rpcuser=cmempoolrpc        ← YOU SET THIS
rpcpassword=securepass456  ← YOU SET THIS
rpcport=19443

[regtest]
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
```

**These credentials are:**
- **rpcuser:** `cmempoolrpc` (can be anything you want)
- **rpcpassword:** `securepass456` (can be anything you want)
- **rpcport:** `19443` (custom port to avoid conflict with bitcoind)

---

## 🔄 How It Works

### Step 1: You Create the Config File

When you create `bitcoind_node/bitcoin.conf`, you write:

```conf
rpcuser=jevinrpc
rpcpassword=securepass123
```

### Step 2: Bitcoin Node Reads the Config

When you start the node with:
```bash
bitcoind -datadir=$(pwd) -conf=$(pwd)/bitcoin.conf
```

Bitcoin Core reads `bitcoin.conf` and sets up RPC authentication using those credentials.

### Step 3: You Use Those Credentials to Connect

When you want to call the RPC API, you must provide the **same credentials**:

```bash
bitcoin-cli -regtest \
  -rpcuser=jevinrpc \           ← Must match bitcoin.conf
  -rpcpassword=securepass123 \  ← Must match bitcoin.conf
  -rpcport=18332 \
  getblockcount
```

---

## 💡 Important Points

### 1. You Choose the Credentials

**You can use ANY username and password you want!**

Examples:
```conf
# Option 1
rpcuser=alice
rpcpassword=mypassword123

# Option 2
rpcuser=admin
rpcpassword=supersecret

# Option 3 (our choice)
rpcuser=jevinrpc
rpcpassword=securepass123
```

### 2. They Must Match Everywhere

**Rule:** Whatever you put in `bitcoin.conf`, you must use in:
- `bitcoin-cli` commands
- Your Rust API (`main.rs`)
- Your test scripts

### 3. Each Node Has Its Own Credentials

**Bitcoind node:**
```conf
rpcuser=jevinrpc
rpcpassword=securepass123
rpcport=18332
```

**Cmempool node:**
```conf
rpcuser=cmempoolrpc
rpcpassword=securepass456
rpcport=19443
```

**Why different?**
- Makes it clear which node you're talking to
- Better security (if one is compromised, the other is safe)
- Easier to audit logs

---

## 🔧 How We Use Them

### In bitcoin-cli Commands

**For bitcoind:**
```bash
bitcoin-cli -regtest \
  -rpcuser=jevinrpc \
  -rpcpassword=securepass123 \
  -rpcport=18332 \
  getblockcount
```

**For cmempool:**
```bash
bitcoin-cli -regtest \
  -rpcuser=cmempoolrpc \
  -rpcpassword=securepass456 \
  -rpcport=19443 \
  getblockcount
```

### In Rust API (main.rs)

```rust
// Connect to bitcoind
let standard = Client::new(
    "http://127.0.0.1:18332",
    Auth::UserPass(
        "jevinrpc".to_string(),        // ← From bitcoind bitcoin.conf
        "securepass123".to_string()    // ← From bitcoind bitcoin.conf
    ),
)?;

// Connect to cmempool
let committed = Client::new(
    "http://127.0.0.1:19443",
    Auth::UserPass(
        "cmempoolrpc".to_string(),     // ← From cmempool bitcoin.conf
        "securepass456".to_string()    // ← From cmempool bitcoin.conf
    ),
)?;
```

### In Test Scripts

```bash
# Variables for easier maintenance
BITCOIND_USER="jevinrpc"
BITCOIND_PASS="securepass123"
BITCOIND_PORT="18332"

CMEMPOOL_USER="cmempoolrpc"
CMEMPOOL_PASS="securepass456"
CMEMPOOL_PORT="19443"

# Use them
bitcoin-cli -regtest \
  -rpcuser=$BITCOIND_USER \
  -rpcpassword=$BITCOIND_PASS \
  -rpcport=$BITCOIND_PORT \
  getblockcount
```

---

## 🔐 Security Notes

### For Development (Regtest)

✅ **Simple passwords are OK:**
```conf
rpcuser=jevinrpc
rpcpassword=securepass123
```

**Why?** Regtest is on your local machine only (127.0.0.1)

### For Production (Mainnet/Testnet)

❌ **NEVER use simple passwords!**

✅ **Use strong passwords:**
```conf
rpcuser=admin
rpcpassword=X9$kL2@mN#pQ7&vR8^tY1
```

✅ **Or use rpcauth (more secure):**
```conf
rpcauth=admin:7a3f2e1d9c8b4a5e$6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c
```

Generated with:
```bash
python3 share/rpcauth/rpcauth.py admin
```

---

## 📋 Summary Table

| Node | Config File | RPC User | RPC Password | RPC Port |
|------|-------------|----------|--------------|----------|
| **Bitcoind** | `bitcoind_node/bitcoin.conf` | `jevinrpc` | `securepass123` | `18332` |
| **Cmempool** | `cmempoold_node/bitcoin.conf` | `cmempoolrpc` | `securepass456` | `19443` |

---

## 🎯 Quick Reference

### Where credentials are DEFINED:
```
bitcoind_node/bitcoin.conf   (lines 3-4)
cmempoold_node/bitcoin.conf  (lines 3-4)
```

### Where credentials are USED:
```
✅ bitcoin-cli commands
✅ main.rs (Rust API)
✅ test_backend.sh
✅ health_check.sh
✅ TESTING_GUIDE.md
✅ BACKEND_TESTING.md
```

---

## ❓ FAQs

### Q: Can I change these credentials?

**A: YES!** Just update:
1. `bitcoind_node/bitcoin.conf`
2. `cmempoold_node/bitcoin.conf`
3. All commands/scripts that use them
4. `main.rs` (recompile)

### Q: What if I forget the password?

**A: No problem!** Just look at your `bitcoin.conf` file:
```bash
cat bitcoind_node/bitcoin.conf | grep rpcpassword
```

### Q: Can both nodes use the same credentials?

**A: YES, but not recommended.** Better to use different credentials for:
- Security
- Clarity
- Debugging

### Q: Are these stored in the blockchain?

**A: NO!** These are purely for RPC API access. They never touch the blockchain.

---

## 🔍 How to Verify Your Credentials

### Check what's in your config:
```bash
# Bitcoind
cat bitcoind_node/bitcoin.conf | grep -E "rpcuser|rpcpassword|rpcport"

# Cmempool
cat cmempoold_node/bitcoin.conf | grep -E "rpcuser|rpcpassword|rpcport"
```

### Test if they work:
```bash
# Test bitcoind credentials
bitcoin-cli -regtest \
  -rpcuser=jevinrpc \
  -rpcpassword=securepass123 \
  -rpcport=18332 \
  getblockcount

# Test cmempool credentials
bitcoin-cli -regtest \
  -rpcuser=cmempoolrpc \
  -rpcpassword=securepass456 \
  -rpcport=19443 \
  getblockcount
```

**If you get a block count → Credentials are correct! ✅**

**If you get "Authorization failed" → Credentials are wrong! ❌**

---

## 📝 For Your Mentor

When your mentor clones your repo, they will see:

```
bitcoind_node/bitcoin.conf:
  rpcuser=jevinrpc
  rpcpassword=securepass123

cmempoold_node/bitcoin.conf:
  rpcuser=cmempoolrpc
  rpcpassword=securepass456
```

They can use these credentials **as-is** or change them to their own.

If they change them, they must update:
- All `bitcoin-cli` commands
- `main.rs` and recompile
- Test scripts

---

**Bottom line:** RPC credentials are just configuration values YOU set in `bitcoin.conf`. That's it! 🎯
