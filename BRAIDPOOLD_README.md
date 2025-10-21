# BraidPoolD - Transaction Orchestration API

## 🎯 Purpose

BraidPoolD is a REST API server that orchestrates transaction flow between:
- **Standard Bitcoin mempool** (bitcoind)
- **Committed mempool** (cmempoold)

## 🏗️ Architecture

```
braidpoold (Port 3000)
    ↓                    ↓
bitcoind (18332)    cmempoold (19443)
```

## 🚀 Quick Start

### Prerequisites

- Rust 1.70+ (`rustc --version`)
- Two running Bitcoin nodes (see `../config/` for configs)

### Run the API

```bash
# From braidpoold/ directory

# 1. Build and run
cargo run

# 2. API starts on http://127.0.0.1:3000
```

## 📡 API Endpoints

### POST /transactions/:txid/commit

Commits a transaction from standard mempool to committed mempool.

**Example:**
```bash
curl -X POST http://localhost:3000/transactions/abc123.../commit
```

**Success Response:**
```json
{
  "status": "success",
  "txid": "abc123...",
  "category": "committed"
}
```

**Error Response:**
```json
{
  "status": "error",
  "diagnostics": {
    "bitcoind_height": 263,
    "cmempool_height": 263,
    "error": "Transaction not found in mempool"
  }
}
```

### POST /transactions/:txid/schedule

Schedules a transaction for future commitment.

**Example:**
```bash
curl -X POST http://localhost:3000/transactions/abc123.../schedule
```

### POST /transactions/:txid/propose

Proposes a transaction to the network.

**Example:**
```bash
curl -X POST http://localhost:3000/transactions/abc123.../propose
```

### GET /transactions/recent

Fetches recent transactions from standard mempool.

**Example:**
```bash
curl http://localhost:3000/transactions/recent
```

**Response:**
```json
{
  "transactions": [
    {
      "txid": "abc123...",
      "size": 250,
      "fee": 0.00001,
      "category": "mempool"
    }
  ]
}
```

## 🔧 Configuration

### Bitcoin Node Connections

Edit `src/main.rs` to configure Bitcoin node connections:

```rust
let standard = Client::new(
    "http://127.0.0.1:18332",
    Auth::UserPass("jevinrpc1".to_string(), "securepass1231".to_string()),
)?;

let committed = Client::new(
    "http://127.0.0.1:19443",
    Auth::UserPass("cmempoolrpc1".to_string(), "securepass4561".to_string()),
)?;
```

### CORS

CORS is enabled for all origins (development mode). Restrict in production:

```rust
CorsLayer::new()
    .allow_origin("http://localhost:5173".parse::<HeaderValue>().unwrap())
    .allow_methods([Method::GET, Method::POST])
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_commit_transaction
```

### Test Files

- `tests/api_tests.rs` - API endpoint tests
- `tests/helper_functions_tests.rs` - Utility function tests

## 🐛 Debugging

### Enable Logging

```bash
# Set log level
RUST_LOG=debug cargo run

# Levels: error, warn, info, debug, trace
```

### Common Issues

**"Connection refused" errors:**
- Check Bitcoin nodes are running
- Verify ports (18332, 19443)
- Check RPC credentials

**"Non-final" transaction errors:**
- Nodes are out of sync (different block heights)
- Transaction has timelocks
- Mine a block to advance the chain

**CORS errors in browser:**
- Check CORS configuration in `main.rs`
- Verify frontend URL is allowed

## 📁 Project Structure

```
braidpoold/
├── src/
│   ├── main.rs          # API server entry point
│   └── api.rs           # Route handlers
├── tests/
│   ├── api_tests.rs
│   └── helper_functions_tests.rs
├── Cargo.toml           # Dependencies
└── README.md            # This file
```

## 🔗 Dependencies

- `axum` - Web framework
- `tokio` - Async runtime
- `bitcoincore-rpc` - Bitcoin RPC client
- `serde` - Serialization
- `tower-http` - CORS middleware

## 🚀 Deployment

### Production Build

```bash
cargo build --release
./target/release/braidpoold
```

### Environment Variables (Recommended for Production)

```bash
# Set via environment
export BITCOIND_URL="http://127.0.0.1:18332"
export BITCOIND_USER="user"
export BITCOIND_PASS="pass"

# Then modify main.rs to read from env vars
```

## 📚 Resources

- [Axum Documentation](https://docs.rs/axum)
- [Bitcoin RPC Documentation](https://developer.bitcoin.org/reference/rpc/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
