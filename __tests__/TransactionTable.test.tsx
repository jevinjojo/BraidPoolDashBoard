import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionTable from '../TransactionTable';
import { BraidPoolTransaction, TransactionCategory } from '../transaction';

// Mock the Card component
vi.mock('@/components/common/Card', () => ({
    default: ({ title, subtitle, children, accentColor }: any) => (
        <div data-testid="card">
            <div data-testid="card-title">{title}</div>
            <div data-testid="card-subtitle">{subtitle}</div>
            <div>{children}</div>
        </div>
    ),
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

describe('TransactionTable - Tailwind Tests', () => {
    describe('Basic Rendering', () => {
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
            
            // Check for loading spinner div with animate-spin class
            const { container } = render(<TransactionTable transactions={[]} loading={true} />);
            const spinner = container.querySelector('.animate-spin');
            expect(spinner).toBeInTheDocument();
        });

        it('does not display loading spinner when loading is false', () => {
            const { container } = render(<TransactionTable transactions={mockTransactions} loading={false} />);
            
            const spinner = container.querySelector('.animate-spin');
            expect(spinner).not.toBeInTheDocument();
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
            
            expect(screen.queryByText(/Failed to/)).not.toBeInTheDocument();
        });

        it('displays error with red styling', () => {
            const { container } = render(<TransactionTable transactions={[]} error="Error message" />);
            const errorDiv = container.querySelector('.bg-red-500\\/10');
            expect(errorDiv).toBeInTheDocument();
        });
    });

    describe('Empty State', () => {
        it('displays "No transactions found" when transactions array is empty', () => {
            render(<TransactionTable transactions={[]} />);
            
            expect(screen.getByText('No transactions found')).toBeInTheDocument();
        });
    });

    describe('Category Filtering', () => {
        it('displays category filter button', () => {
            render(<TransactionTable transactions={mockTransactions} />);
            
            expect(screen.getByText(/Category Filter/)).toBeInTheDocument();
        });

        it('opens dropdown when filter button is clicked', () => {
            render(<TransactionTable transactions={mockTransactions} />);
            
            const filterButton = screen.getByText(/Select categories/);
            fireEvent.click(filterButton);
            
            // Check if dropdown menu appears with categories
            expect(screen.getByText('Mempool')).toBeInTheDocument();
            expect(screen.getByText('Committed')).toBeInTheDocument();
        });

        it('filters transactions by selected category', () => {
            render(<TransactionTable transactions={mockTransactions} />);
            
            // Initially shows all transactions
            expect(screen.getByTestId('card-subtitle')).toHaveTextContent('2 transactions');
            
            // Open the filter dropdown
            const filterButton = screen.getByText(/Select categories/);
            fireEvent.click(filterButton);
            
            // Select MEMPOOL category (find checkbox by its parent structure)
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[0]); // Click first category (MEMPOOL)
            
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

        it('styles confirmed transactions with green', () => {
            const { container } = render(<TransactionTable transactions={mockTransactions} />);
            const confirmedBadge = screen.getByText('6').closest('span');
            expect(confirmedBadge?.className).toContain('border-green-500');
        });

        it('styles unconfirmed transactions with yellow', () => {
            const unconfirmedTx = [{
                ...mockTransactions[0],
                confirmations: 2
            }];
            const { container } = render(<TransactionTable transactions={unconfirmedTx} />);
            const badge = screen.getByText('2').closest('span');
            expect(badge?.className).toContain('border-yellow-500');
        });
    });

    describe('Auto Refresh Display', () => {
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
            render(<TransactionTable transactions={mockTransactions} />);
            
            // Open filter
            const filterButton = screen.getByText(/Select categories/);
            fireEvent.click(filterButton);
            
            // Select first category
            const checkboxes = screen.getAllByRole('checkbox');
            fireEvent.click(checkboxes[0]);
            
            // Check count
            expect(screen.getByText('Showing 1 of 2 transactions')).toBeInTheDocument();
        });
    });

    describe('Tailwind Styling', () => {
        it('renders table with dark theme', () => {
            const { container } = render(<TransactionTable transactions={mockTransactions} />);
            const table = container.querySelector('table');
            expect(table).toBeInTheDocument();
        });

        it('renders category badges with correct Tailwind classes', () => {
            const { container } = render(<TransactionTable transactions={mockTransactions} />);
            
            const mempoolBadge = screen.getByText('Mempool');
            expect(mempoolBadge.className).toContain('bg-blue-500/20');
            expect(mempoolBadge.className).toContain('text-blue-400');
        });

        it('renders rows with hover effect classes', () => {
            const { container } = render(<TransactionTable transactions={mockTransactions} />);
            const rows = container.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                expect(row.className).toContain('hover:bg-white/5');
            });
        });
    });

    describe('Input/Output Display', () => {
        it('displays input and output counts correctly', () => {
            render(<TransactionTable transactions={mockTransactions} />);
            
            // Check for "2" inputs
            const cells = screen.getAllByText('2');
            expect(cells.length).toBeGreaterThan(0);
            
            // Check for "3" outputs
            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('colors inputs and outputs differently', () => {
            const { container } = render(<TransactionTable transactions={mockTransactions} />);
            
            // Find cells with input/output data
            const inputSpan = container.querySelector('.text-blue-400');
            const outputSpan = container.querySelector('.text-green-400');
            
            expect(inputSpan).toBeInTheDocument();
            expect(outputSpan).toBeInTheDocument();
        });
    });
});
