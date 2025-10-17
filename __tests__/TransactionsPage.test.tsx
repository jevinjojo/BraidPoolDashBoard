import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionsPage from '../TransactionsPage';
import { braidpoolApi } from '../braidpoolApi';
import { BraidPoolTransaction, TransactionCategory } from '../transaction';

// Mock dependencies
jest.mock('../braidpoolApi');
jest.mock('../TransactionTable', () => ({
  __esModule: true,
  default: ({ transactions, loading, error, autoRefresh, refreshInterval, maxHeight }: any) => (
    <div data-testid="transaction-table">
      <div data-testid="transactions-count">{transactions.length}</div>
      <div data-testid="loading-state">{loading ? 'loading' : 'loaded'}</div>
      <div data-testid="error-state">{error || 'no-error'}</div>
      <div data-testid="auto-refresh">{autoRefresh ? 'enabled' : 'disabled'}</div>
      <div data-testid="refresh-interval">{refreshInterval}</div>
      <div data-testid="max-height">{maxHeight}</div>
    </div>
  ),
}));

jest.mock('../common/TopStatsBar', () => ({
  __esModule: true,
  default: () => <div data-testid="top-stats-bar">Stats Bar</div>,
}));

jest.mock('../theme/colors', () => ({
  __esModule: true,
  default: {
    background: '#121212',
    textPrimary: '#ffffff',
    textSecondary: '#b0b0b0',
    primary: '#1976d2',
    info: '#2196f3',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    paper: '#1e1e1e',
  }
}));

const mockTransactions: BraidPoolTransaction[] = [
  {
    txid: 'mock-tx-1',
    hash: 'mock-tx-1',
    category: TransactionCategory.MEMPOOL,
    size: 250,
    weight: 1000,
    fee: 0.00001,
    feeRate: 10.5,
    inputs: 2,
    outputs: 3,
    confirmations: 0,
    work: 100,
    workUnit: 'TH',
    vin: [],
    vout: [],
    status: { confirmed: false },
    timestamp: Date.now() / 1000,
    rbfSignaled: true
  }
];

describe('TransactionsPage', () => {
  const mockFetchRecentTransactions = braidpoolApi.fetchRecentTransactions as jest.MockedFunction<typeof braidpoolApi.fetchRecentTransactions>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchRecentTransactions.mockResolvedValue(mockTransactions);
  });

  describe('Page Rendering', () => {
    it('renders the page with title and description', async () => {
      render(<TransactionsPage />);
      
      expect(screen.getByText('Transaction Management')).toBeInTheDocument();
      expect(screen.getByText('Monitor and analyze Bitcoin transactions across different categories and states')).toBeInTheDocument();
    });

    it('renders the TopStatsBar component', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('top-stats-bar')).toBeInTheDocument();
      });
    });

    it('renders transaction categories legend', async () => {
      render(<TransactionsPage />);
      
      expect(screen.getByText('Transaction Categories')).toBeInTheDocument();
      expect(screen.getByText('Mempool')).toBeInTheDocument();
      expect(screen.getByText('Committed')).toBeInTheDocument();
      expect(screen.getByText('Proposed')).toBeInTheDocument();
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Replaced')).toBeInTheDocument();
    });

    it('renders Live Transaction Feed section', async () => {
      render(<TransactionsPage />);
      
      expect(screen.getByText('Live Transaction Feed')).toBeInTheDocument();
      expect(screen.getByText('Real-time Bitcoin transactions from your node')).toBeInTheDocument();
    });

    it('renders TransactionTable component', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('transaction-table')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('fetches transactions on mount', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(mockFetchRecentTransactions).toHaveBeenCalledWith(50);
      });
    });

    it('displays fetched transactions', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('1');
      });
    });

    it('shows loading state initially', () => {
      render(<TransactionsPage />);
      
      expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');
    });

    it('shows loaded state after fetch completes', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent('loaded');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when fetch fails', async () => {
      const errorMessage = 'Network error';
      mockFetchRecentTransactions.mockRejectedValueOnce(new Error(errorMessage));
      
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toHaveTextContent('Failed to load transactions. Please try again.');
      });
    });

    it('logs error to console when fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockFetchRecentTransactions.mockRejectedValueOnce(new Error('API Error'));
      
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch transactions:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Auto Refresh Toggle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('displays auto refresh toggle switch', async () => {
      render(<TransactionsPage />);
      
      expect(screen.getByText('Auto Refresh')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('auto refresh is enabled by default', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-refresh')).toHaveTextContent('enabled');
      });
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('toggles auto refresh when switch is clicked', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-refresh')).toHaveTextContent('enabled');
      });
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-refresh')).toHaveTextContent('disabled');
      });
    });

    it('refreshes data at specified interval when auto refresh is enabled', async () => {
      render(<TransactionsPage />);
      
      // Initial fetch
      await waitFor(() => {
        expect(mockFetchRecentTransactions).toHaveBeenCalledTimes(1);
      });
      
      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(mockFetchRecentTransactions).toHaveBeenCalledTimes(2);
      });
      
      // Fast-forward another 30 seconds
      jest.advanceTimersByTime(30000);
      
      await waitFor(() => {
        expect(mockFetchRecentTransactions).toHaveBeenCalledTimes(3);
      });
    });

    it('stops refreshing when auto refresh is disabled', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(mockFetchRecentTransactions).toHaveBeenCalledTimes(1);
      });
      
      // Disable auto refresh
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      // Fast-forward time
      jest.advanceTimersByTime(60000);
      
      // Should not have called fetch again
      await waitFor(() => {
        expect(mockFetchRecentTransactions).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Props Passed to TransactionTable', () => {
    it('passes correct props to TransactionTable', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('max-height')).toHaveTextContent('700');
        expect(screen.getByTestId('refresh-interval')).toHaveTextContent('30000');
        expect(screen.getByTestId('auto-refresh')).toHaveTextContent('enabled');
      });
    });

    it('passes transactions data to TransactionTable', async () => {
      render(<TransactionsPage />);
      
      await waitFor(() => {
        expect(screen.getByTestId('transactions-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Category Descriptions', () => {
    it('displays tooltips with category descriptions', async () => {
      render(<TransactionsPage />);
      
      const mempoolCategory = screen.getByText('Transactions in bitcoind mempool only');
      expect(mempoolCategory).toBeInTheDocument();
      
      const committedCategory = screen.getByText('Transactions committed to cmempool node');
      expect(committedCategory).toBeInTheDocument();
      
      const proposedCategory = screen.getByText('Transactions proposed for next block');
      expect(proposedCategory).toBeInTheDocument();
    });
  });
});
