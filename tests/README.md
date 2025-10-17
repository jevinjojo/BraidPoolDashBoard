# BraidPool API - Rust Integration Tests

This directory contains integration tests for the BraidPool API backend written in Rust.

## Test Files

### 1. `api_tests.rs` - API Endpoint Tests
Tests for all API endpoints and business logic:

- **Endpoint Tests**
  - `/transactions` - Get all transactions
  - `/tx/{txid}` - Get transaction details
  - `/mempool/info` - Get mempool information
  - `/transactions/{txid}/commit` - Commit transaction
  - `/transactions/{txid}/propose` - Propose transaction
  - `/transactions/{txid}/schedule` - Schedule transaction

- **State Transition Tests**
  - Valid transitions: Mempool → Committed → Proposed → Scheduled → Confirmed
  - Invalid transitions (skipping states)
  - Confirmation clears state

- **Category Detection Tests**
  - Priority order: Confirmed > Scheduled > Proposed > Committed > Mempool > Replaced
  - Edge cases and state combinations

- **Error Handling Tests**
  - Invalid txid format
  - Node synchronization errors
  - Missing inputs errors

### 2. `helper_functions_tests.rs` - Utility Function Tests
Tests for helper functions and utilities:

- **Conversion Functions**
  - Satoshis to BTC conversion
  - Precision and edge cases
  - Maximum values

- **Fee Calculations**
  - Fee rate calculation (fee_sats / vsize)
  - Zero vsize handling
  - High fee scenarios

- **Timestamp Functions**
  - Timestamp generation
  - Fallback priority (mempool_time > block_time > now)
  - Reasonable range validation

- **Hash Validation**
  - Valid 64-character hex format
  - Invalid format detection

- **State Transitions**
  - Valid progressions
  - Invalid skips
  - Terminal states

- **Mempool Aggregation**
  - Combining bitcoind and cmempool
  - Duplicate removal
  - Empty mempool handling

- **Fee Histogram**
  - Fee rate bucketing
  - Vsize accumulation
  - Sorted output

## Running Tests

### Run all tests
```bash
cargo test
```

### Run specific test file
```bash
cargo test --test api_tests
cargo test --test helper_functions_tests
```

### Run tests with output
```bash
cargo test -- --nocapture
```

### Run specific test
```bash
cargo test test_category_confirmed_takes_priority
```

### Run tests in parallel (default)
```bash
cargo test -- --test-threads=4
```

### Run tests sequentially
```bash
cargo test -- --test-threads=1
```

## Test Categories Covered

### ✅ API Endpoints
- Request/response validation
- Status code verification
- JSON serialization
- CORS headers

### ✅ Business Logic
- Transaction state machine
- Category detection algorithm
- State cleanup on confirmation
- Transaction tracking (seen/replaced)

### ✅ Data Transformations
- API to internal format conversion
- Fee calculations
- Timestamp handling
- Hash formatting

### ✅ Error Handling
- Invalid inputs
- Network errors
- Node sync issues
- Missing transactions

### ✅ State Management
- Committed, Proposed, Scheduled sets
- Seen transactions tracking
- State cleanup
- Concurrent access

## Test Structure

Each test file follows this structure:
```rust
#[cfg(test)]
mod test_module {
    use super::*;
    
    #[test]
    fn test_name() {
        // Arrange
        let input = ...;
        
        // Act
        let result = function(input);
        
        // Assert
        assert_eq!(result, expected);
    }
}
```

## Integration with Main Code

To run tests with actual API functions, update imports:

```rust
// At the top of test files
use braidpool_api::*;  // Import your API functions
```

Then run:
```bash
cargo test --lib
```

## Test Coverage

Run with coverage (requires `tarpaulin`):
```bash
cargo install cargo-tarpaulin
cargo tarpaulin --out Html
```

## Expected Test Results

All tests should pass:
```
running 75 tests
test api_endpoint_tests::test_get_transactions_endpoint_exists ... ok
test category_detection_tests::test_category_confirmed_takes_priority ... ok
test conversion_tests::test_sats_to_btc_conversion ... ok
...

test result: ok. 75 passed; 0 failed; 0 ignored; 0 measured
```

## Key Test Scenarios

### 1. Transaction Lifecycle
```
Mempool -> Committed -> Proposed -> Scheduled -> Confirmed
```

### 2. Category Priority
```
Confirmed (highest)
  ↓
Scheduled
  ↓
Proposed
  ↓
Committed
  ↓
Mempool
  ↓
Replaced (lowest)
```

### 3. Fee Calculation
```
fee_rate = fee_sats / vsize
btc = sats / 100_000_000
```

### 4. Node Synchronization
```
bitcoind_height == cmempool_height  ✅ Synced
bitcoind_height != cmempool_height  ❌ Out of sync
```

## Troubleshooting

### Tests fail with "connection refused"
- Ensure Bitcoin nodes are running
- Check RPC credentials in test setup

### Tests timeout
- Increase timeout: `cargo test -- --test-timeout=60`
- Check network connectivity

### Mock data doesn't match
- Update test data to match actual API responses
- Verify struct serialization

## Adding New Tests

1. Create test in appropriate file (or new file)
2. Follow naming convention: `test_<feature>_<scenario>`
3. Add module documentation
4. Run `cargo test` to verify
5. Update this README with new test info

## CI/CD Integration

For GitHub Actions:
```yaml
- name: Run tests
  run: cargo test --verbose
```

For GitLab CI:
```yaml
test:
  script:
    - cargo test --verbose
```

## Notes

- Tests use mock Bitcoin RPC clients (placeholders)
- Some tests validate logic without external dependencies
- Integration tests require running Bitcoin nodes
- Unit tests can run without external services

## Future Enhancements

- [ ] Add mock Bitcoin RPC client for integration tests
- [ ] Add property-based testing with `proptest`
- [ ] Add benchmark tests with `criterion`
- [ ] Add fuzzing tests
- [ ] Increase coverage to 90%+
