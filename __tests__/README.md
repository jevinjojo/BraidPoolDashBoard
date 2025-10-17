# Frontend Component Tests

This directory contains unit and integration tests for the frontend components.

## Test Files

### Component Tests
- **`TransactionTable.test.tsx`** - Tests for the TransactionTable component
  - Rendering with different states (loading, error, empty)
  - Category filtering functionality
  - Transaction data formatting
  - User interactions

- **`TransactionsPage.test.tsx`** - Tests for the TransactionsPage component
  - Page rendering and layout
  - Data fetching and error handling
  - Auto-refresh functionality
  - Integration with child components

### Utility Tests
- **`braidpoolApi.test.ts`** - Tests for the BraidPool API client
  - API request/response handling
  - Error handling and retries
  - Data transformation
  - Category normalization
  - Work value parsing

### Type Tests
- **`transaction.test.ts`** - Tests for transaction types and constants
  - Enum values
  - Type interfaces
  - Category labels and descriptions
  - Type consistency

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run specific test file
```bash
npm test TransactionTable.test.tsx
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="Category Filtering"
```

## Test Setup

The `setup.ts` file configures the testing environment:
- Imports Jest DOM matchers
- Mocks browser APIs (matchMedia, IntersectionObserver, ResizeObserver)
- Suppresses expected console warnings

## Writing New Tests

When adding new components or features, follow these patterns:

1. **Create test file** in `__tests__/` directory next to the component
2. **Mock dependencies** to isolate the unit under test
3. **Test behavior, not implementation** - focus on what users see and interact with
4. **Use descriptive test names** that explain what is being tested
5. **Group related tests** using `describe` blocks
6. **Cover edge cases** including error states and empty data

## Test Coverage

Aim for:
- ✅ **Statements**: 80%+
- ✅ **Branches**: 75%+
- ✅ **Functions**: 80%+
- ✅ **Lines**: 80%+

## Dependencies

Tests use:
- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **@testing-library/jest-dom** - Custom DOM matchers

## Common Issues

### Tests timing out
- Increase timeout: `jest.setTimeout(10000)`
- Use `waitFor` for async operations

### Mock not working
- Clear mocks in `beforeEach`: `jest.clearAllMocks()`
- Check mock path matches actual import

### Component not rendering
- Ensure all required props are provided
- Check for missing mock implementations
