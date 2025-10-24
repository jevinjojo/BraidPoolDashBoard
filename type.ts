import { BraidPoolTransaction } from '../../types/transaction';

export interface TransactionTableProps {
  transactions: BraidPoolTransaction[];
  maxHeight?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  loading?: boolean;
  error?: string | null;
}
