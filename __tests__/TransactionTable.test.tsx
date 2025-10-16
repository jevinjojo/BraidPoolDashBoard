import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionTable from '../TransactionTable';
import { BraidPoolTransaction, TransactionCategory } from '../transaction';

// Mock the Card component
jest.mock('../common/Card', () => ({
  __esModule: true,
  default: ({ title, subtitle, children, accentColor }: any) => (
    <div data-testid="card">
      <div data-testid="card-title">{title}</div>
      <div data-testid="card-subtitle">{subtitle}</div>
      {children}
    </div>
  ),
}));

// Mock the colors module
jest.mock('../theme/colors', () => ({
  __esModule: true,
  default: {
    primary: '#1976d2',
    secondary: '#ff9800',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
    paper: '#1e1e1e',
    textPrimary: '#ffffff',
    textSecondary: '#b0b0b0',
    accent: '#2196f3',
    cardAccentPrimary: '#1976d2',
    grey: '#9e9e9e'
  }
}));

const mockTransactions: BraidPoolTransaction[] = [
  {
    txid: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
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
    timestamp: Date.now() / 1000 - 120,
    rbfSignaled: true
  },
  {
    txid: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
    hash: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
    category: TransactionCategory.CONFIRMED,
    size: 180,
    weight: 720,
    fee: 0.00005,
    feeRate: 25.3,
    inputs: 1,
    outputs: 2,
    confirmations: 6,
    work: 200,
    workUnit: 'TH',
    vin: [],
    vout: [],
    status: { confirmed: true, block_height: 100 },
    timestamp: Date.now() / 1000 - 3600,
    rbfSignaled: false
  }
];

describe('TransactionTable', () => {
  describe('Rendering', () => {
    it('renders the component with title and subtitle', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByTestId('card-title')).toHaveTextContent('Transaction Table');
      expect(screen.getByTestId('card-subtitle')).toHaveTextContent('2 transactions from Bitcoin node');
    });

    it('renders table headers correctly', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByText('Hash')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Size (vB)')).toBeInTheDocument();
      expect(screen.getByText('Fee (BTC)')).toBeInTheDocument();
      expect(screen.getByText('Fee Rate (sats/vB)')).toBeInTheDocument();
      expect(screen.getByText('In/Out')).toBeInTheDocument();
      expect(screen.getByText('Confirms')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
    });

    it('renders transaction rows with correct data', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      // Check if truncated hash is displayed
      expect(screen.getByText(/abc123de\.\.\.def456abc1/)).toBeInTheDocument();
      
      // Check if fee is displayed correctly (8 decimal places)
      expect(screen.getByText('0.00001000')).toBeInTheDocument();
      
      // Check if fee rate is displayed correctly (1 decimal place)
      expect(screen.getByText('10.5')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('displays loading spinner when loading is true', () => {
      render(<TransactionTable transactions={[]} loading={true} />);
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not display loading spinner when loading is false', () => {
      render(<TransactionTable transactions={mockTransactions} loading={false} />);
      
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when error prop is provided', () => {
      const errorMessage = 'Failed to fetch transactions';
      render(<TransactionTable transactions={[]} error={errorMessage} />);
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('does not display error when error prop is null', () => {
      render(<TransactionTable transactions={mockTransactions} error={null} />);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('displays "No transactions found" when transactions array is empty', () => {
      render(<TransactionTable transactions={[]} />);
      
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
    });
  });

  describe('Category Filtering', () => {
    it('displays category filter dropdown', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByLabelText('Category Filter')).toBeInTheDocument();
    });

    it('filters transactions by selected category', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      // Initially shows all transactions
      expect(screen.getByTestId('card-subtitle')).toHaveTextContent('2 transactions');
      
      // Open the filter dropdown
      const filterButton = screen.getByLabelText('Category Filter');
      fireEvent.mouseDown(filterButton);
      
      // Select MEMPOOL category
      const mempoolOption = screen.getByText('Mempool');
      fireEvent.click(mempoolOption);
      
      // Should now show only 1 transaction
      expect(screen.getByTestId('card-subtitle')).toHaveTextContent('1 transactions');
    });
  });

  describe('Transaction Formatting', () => {
    it('truncates hash correctly', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      // First 8 chars + '...' + last 8 chars
      expect(screen.getByText(/abc123de\.\.\.def456abc1/)).toBeInTheDocument();
    });

    it('formats fee to 8 decimal places', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByText('0.00001000')).toBeInTheDocument();
    });

    it('formats fee rate to 1 decimal place', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByText('10.5')).toBeInTheDocument();
      expect(screen.getByText('25.3')).toBeInTheDocument();
    });

    it('formats time correctly for recent transactions', () => {
      const recentTx: BraidPoolTransaction = {
        ...mockTransactions[0],
        timestamp: Date.now() / 1000 - 30 // 30 seconds ago
      };
      
      render(<TransactionTable transactions={[recentTx]} />);
      
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('formats time in minutes for transactions less than an hour old', () => {
      const recentTx: BraidPoolTransaction = {
        ...mockTransactions[0],
        timestamp: Date.now() / 1000 - 300 // 5 minutes ago
      };
      
      render(<TransactionTable transactions={[recentTx]} />);
      
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });
  });

  describe('Confirmation Display', () => {
    it('displays confirmation count for confirmed transactions', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('displays "Unconfirmed" for transactions without confirmations', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByText('Unconfirmed')).toBeInTheDocument();
    });
  });

  describe('Auto Refresh', () => {
    it('displays auto-refresh message when enabled', () => {
      render(<TransactionTable transactions={mockTransactions} autoRefresh={true} refreshInterval={30000} />);
      
      expect(screen.getByText('Auto-refresh every 30s')).toBeInTheDocument();
    });

    it('does not display auto-refresh message when disabled', () => {
      render(<TransactionTable transactions={mockTransactions} autoRefresh={false} />);
      
      expect(screen.queryByText(/Auto-refresh/)).not.toBeInTheDocument();
    });
  });

  describe('Transaction Count Display', () => {
    it('shows correct transaction count', () => {
      render(<TransactionTable transactions={mockTransactions} />);
      
      expect(screen.getByText('Showing 2 of 2 transactions')).toBeInTheDocument();
    });

    it('shows filtered count when filter is applied', () => {
      const { container } = render(<TransactionTable transactions={mockTransactions} />);
      
      // Open filter
      const filterButton = screen.getByLabelText('Category Filter');
      fireEvent.mouseDown(filterButton);
      
      // Select MEMPOOL
      const mempoolOption = screen.getByText('Mempool');
      fireEvent.click(mempoolOption);
      
      // Check count
      expect(screen.getByText('Showing 1 of 2 transactions')).toBeInTheDocument();
    });
  });
});
