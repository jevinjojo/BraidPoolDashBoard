# BraidPool - Bitcoin Mining Pool Dashboard

## 🎯 Overview

BraidPool is a Bitcoin mining pool with a React dashboard and Rust backend API for managing transaction flow between standard and committed mempools.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ http://localhost:5173
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          React Dashboard (Vite)                              │
│  Components:                                                 │
│  - TransactionsPage (Tailwind CSS)                          │
│  - TransactionTable (Tailwind CSS)                          │
│  - TopStatsBar, Card (reusable components)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API
                      │ POST /transactions/:txid/commit
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          braidpoold (Rust/Axum API)                         │
│  Port: 3000                                                  │
│  - Transaction orchestration                                 │
│  - Mempool management                                        │
└─────────┬───────────────────────┬───────────────────────────┘
          │ RPC                   │ RPC
          ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐
│   bitcoind          │  │   cmempoold         │
│   (Standard)        │  │   (Committed)       │
│   Port: 18332       │◄─┤   Port: 19443       │
└─────────────────────┘  └─────────────────────┘
```

## 📁 Repository Structure

```
braidpool/
│
├── dashboard/                    # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Transactions/    # Transaction management UI
│   │   │   └── common/          # Reusable components
│   │   └── utils/
│   │       ├── braidpoolApi.ts  # API client
│   │       └── transactionHelpers.ts
│   ├── __tests__/               # Frontend tests
│   └── package.json
│
├── braidpoold/                   # Backend Rust API
│   ├── src/
│   │   ├── main.rs              # API server
│   │   └── api.rs               # Route handlers
│   ├── tests/                   # Integration tests
│   └── Cargo.toml
│
├── config/                       # Configuration files
│   ├── bitcoind/
│   │   └── bitcoin.conf
│   └── cmempoold/
│       └── bitcoin.conf
│
├── scripts/                      # Helper scripts
│   ├── start-all.sh             # Start all services
│   ├── stop-all.sh              # Stop all services
│   └── dev-setup.sh             # Initial setup
│
└── docs/                         # Documentation
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEVELOPMENT.md
```

## 🚀 Quick Start

### Prerequisites

- **Bitcoin Core** 25.0+ ([Download](https://bitcoin.org/en/download))
- **Rust** 1.70+ ([Install](https://rustup.rs/))
- **Node.js** 18+ ([Download](https://nodejs.org/))

### Installation

```bash
# 1. Clone repository
git clone https://github.com/braidpool/braidpool.git
cd braidpool

# 2. Run setup script
chmod +x scripts/*.sh
./scripts/dev-setup.sh
```

### Running the Application

**Option 1: Start Everything (Easy)**

```bash
./scripts/start-all.sh
```

This will start:
- ✅ bitcoind (port 18332)
- ✅ cmempoold (port 19443)
- ✅ braidpoold API (port 3000)
- ✅ Dashboard (port 5173)

Then open: http://localhost:5173

**Option 2: Start Services Manually**

```bash
# Terminal 1: Start Bitcoin nodes
bitcoind -regtest -datadir=./data/bitcoind -conf=./config/bitcoind/bitcoin.conf
bitcoind -regtest -datadir=./data/cmempoold -conf=./config/cmempoold/bitcoin.conf

# Terminal 2: Start API
cd braidpoold && cargo run

# Terminal 3: Start Frontend
cd dashboard && npm run dev
```

### Stopping Services

```bash
./scripts/stop-all.sh
```

## 🧪 Testing

### Frontend Tests

```bash
cd dashboard
npm test                # Run once
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Backend Tests

```bash
cd braidpoold
cargo test              # All tests
cargo test -- --nocapture  # With output
```

## 📡 API Endpoints

### POST /transactions/:txid/commit

Commit a transaction to the committed mempool.

```bash
curl -X POST http://localhost:3000/transactions/<txid>/commit
```

### GET /transactions/recent

Get recent transactions from mempool.

```bash
curl http://localhost:3000/transactions/recent
```

See full API documentation: [docs/API.md](docs/API.md)

## 🔧 Development

### Making Changes

**Frontend (React/Tailwind):**
1. Edit files in `dashboard/src/`
2. Changes hot-reload automatically
3. Test: `npm test`
4. Format: `npx prettier --write .`

**Backend (Rust):**
1. Edit files in `braidpoold/src/`
2. Restart: `cargo run`
3. Test: `cargo test`
4. Lint: `cargo clippy`

### Project Conventions

- **Frontend**: Use Tailwind CSS (no Material UI in new components)
- **Backend**: Use `axum` for routing, `bitcoincore-rpc` for Bitcoin
- **Tests**: Required for new features
- **Commits**: Use conventional commits (e.g., `feat:`, `fix:`, `docs:`)

## 🐛 Troubleshooting

### Frontend can't connect to API

```bash
# Check API is running
curl http://localhost:3000/transactions/recent

# Check CORS in braidpoold/src/main.rs
```

### Bitcoin nodes not syncing

```bash
# Check both node heights
bitcoin-cli -regtest -rpcport=18332 -rpcuser=jevinrpc1 -rpcpassword=securepass1231 getblockcount
bitcoin-cli -regtest -rpcport=19443 -rpcuser=cmempoolrpc1 -rpcpassword=securepass4561 getblockcount

# Restart committed node
bitcoin-cli -regtest -rpcport=19443 -rpcuser=cmempoolrpc1 -rpcpassword=securepass4561 stop
bitcoind -regtest -datadir=./data/cmempoold -conf=./config/cmempoold/bitcoin.conf
```

### "Non-final" transaction errors

```bash
# Mine a block to advance chain
bitcoin-cli -regtest -rpcport=18332 -rpcuser=jevinrpc1 -rpcpassword=securepass1231 -generate 1
```

See full troubleshooting guide: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Frontend Components](dashboard/README.md)
- [Backend API](braidpoold/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

[MIT License](LICENSE)

## 🔗 Resources

- [BraidPool Documentation](https://braidpool.com)
- [Bitcoin Core RPC](https://developer.bitcoin.org/reference/rpc/)
- [Axum Framework](https://docs.rs/axum)
- [React Documentation](https://react.dev)

## 💬 Support

- Issues: [GitHub Issues](https://github.com/braidpool/braidpool/issues)
- Discussions: [GitHub Discussions](https://github.com/braidpool/braidpool/discussions)

---

**Built with ❤️ by the BraidPool team**
