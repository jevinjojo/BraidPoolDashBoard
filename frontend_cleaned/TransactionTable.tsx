import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import Card from '../common/Card';
import {
  TransactionCategory,
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_CATEGORY_DESCRIPTIONS,
  BraidPoolTransaction
} from '../../types/transaction';

let colors: any = {};
try {
  colors = require('../../theme/colors').default || {};
} catch (error) {
  console.warn('Could not load colors theme, using fallbacks');
}

interface TransactionTableProps {
  transactions: BraidPoolTransaction[];
  maxHeight?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  loading?: boolean;
  error?: string | null;
}

const DEFAULT_COLORS = {
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
};

const getSafeColor = (colorPath: string, fallback: string = '#ffffff'): string => {
  try {
    const paths = colorPath.split('.');
    let value = colors;

    for (const path of paths) {
      if (value && typeof value === 'object' && path in value) {
        value = value[path];
      } else {
        return fallback;
      }
    }

    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && value.main) return value.main;
    if (value && typeof value === 'object' && value[500]) return value[500];

    return fallback;
  } catch (error) {
    return fallback;
  }
};

const safeColors = {
  primary: getSafeColor('primary', DEFAULT_COLORS.primary),
  secondary: getSafeColor('secondary', DEFAULT_COLORS.secondary),
  success: getSafeColor('success', DEFAULT_COLORS.success),
  warning: getSafeColor('warning', DEFAULT_COLORS.warning),
  error: getSafeColor('error', DEFAULT_COLORS.error),
  info: getSafeColor('info', DEFAULT_COLORS.info),
  paper: getSafeColor('paper', DEFAULT_COLORS.paper),
  textPrimary: getSafeColor('textPrimary', DEFAULT_COLORS.textPrimary),
  textSecondary: getSafeColor('textSecondary', DEFAULT_COLORS.textSecondary),
  accent: getSafeColor('accent', DEFAULT_COLORS.accent),
  cardAccentPrimary: getSafeColor('cardAccentPrimary', DEFAULT_COLORS.cardAccentPrimary),
  grey: getSafeColor('grey', DEFAULT_COLORS.grey)
};

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  [TransactionCategory.MEMPOOL]: safeColors.info,
  [TransactionCategory.COMMITTED]: safeColors.primary,
  [TransactionCategory.PROPOSED]: safeColors.success,
  [TransactionCategory.SCHEDULED]: safeColors.warning,
  [TransactionCategory.CONFIRMED]: safeColors.success,
  [TransactionCategory.REPLACED]: safeColors.error,
};

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions = [],
  loading = false,
  error = null,
  maxHeight = 600,
  autoRefresh = false,
  refreshInterval = 30000,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory[]>([]);

  const truncateHash = (hash: string) => {
    if (!hash) return 'N/A';
    return hash.substring(0, 8) + '...' + hash.substring(hash.length - 8);
  };

  const formatFee = (fee: number) => {
    return fee.toFixed(8);
  };

  const formatFeeRate = (feeRate: number) => {
    return feeRate.toFixed(1);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        // Refresh handled by parent component
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const handleCategoryFilterChange = (event: SelectChangeEvent<TransactionCategory[]>) => {
    const value = event.target.value;
    setCategoryFilter(typeof value === 'string' ? value.split(',') as TransactionCategory[] : value);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (categoryFilter.length === 0) return true;
    if (!tx.category) return false;
    return categoryFilter.includes(tx.category as TransactionCategory);
  });

  return (
    <Card
      title="Transaction Table"
      subtitle={`${filteredTransactions.length} transactions from Bitcoin node`}
      accentColor={safeColors.cardAccentPrimary}
    >
      <Box sx={{ mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Category Filter</InputLabel>
          <Select
            multiple
            value={categoryFilter}
            onChange={handleCategoryFilterChange}
            input={<OutlinedInput label="Category Filter" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip
                    key={value}
                    label={TRANSACTION_CATEGORY_LABELS[value as TransactionCategory] || 'Unknown'}
                    size="small"
                    sx={{
                      backgroundColor: `${CATEGORY_COLORS[value as TransactionCategory] || safeColors.grey}20`,
                      color: CATEGORY_COLORS[value as TransactionCategory] || safeColors.grey,
                    }}
                  />
                ))}
              </Box>
            )}
          >
            {Object.values(TransactionCategory).map((category) => (
              <MenuItem key={category} value={category}>
                <Chip
                  label={TRANSACTION_CATEGORY_LABELS[category] || 'Unknown'}
                  size="small"
                  sx={{
                    backgroundColor: `${CATEGORY_COLORS[category] || safeColors.grey}20`,
                    color: CATEGORY_COLORS[category] || safeColors.grey,
                    mr: 1,
                  }}
                />
                <Tooltip title={TRANSACTION_CATEGORY_DESCRIPTIONS[category] || 'No description available'}>
                  <Typography variant="body2">{TRANSACTION_CATEGORY_LABELS[category] || 'Unknown'}</Typography>
                </Tooltip>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer
        sx={{
          maxHeight: maxHeight,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: safeColors.paper,
          },
          '&::-webkit-scrollbar-thumb': {
            background: safeColors.primary,
            borderRadius: '4px',
          },
        }}
      >
        <Table size="medium" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold', minWidth: 120 }}>
                Hash
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold', minWidth: 100 }}>
                Category
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold' }} align="right">
                Size (vB)
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold' }} align="right">
                Fee (BTC)
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold' }} align="right">
                Fee Rate (sats/vB)
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold' }} align="center">
                In/Out
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold' }} align="center">
                Confirms
              </TableCell>
              <TableCell sx={{ backgroundColor: safeColors.paper, color: safeColors.textPrimary, fontWeight: 'bold' }} align="right">
                Time
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={40} />
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: safeColors.textSecondary }}>
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction: BraidPoolTransaction) => (
                <TableRow
                  key={transaction.txid || `tx-${Math.random()}`}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    },
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <TableCell sx={{ color: safeColors.accent, fontFamily: 'monospace' }}>
                    {truncateHash(transaction.txid)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.category ? TRANSACTION_CATEGORY_LABELS[transaction.category] || 'Unknown' : 'Unknown'}
                      size="small"
                      sx={{
                        backgroundColor: transaction.category ?
                          `${CATEGORY_COLORS[transaction.category] || safeColors.grey}20` :
                          `${safeColors.grey}20`,
                        color: transaction.category ?
                          CATEGORY_COLORS[transaction.category] || safeColors.grey :
                          safeColors.grey,
                        fontWeight: 'bold',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: safeColors.textPrimary, fontFamily: 'monospace' }}>
                    {transaction.size ? transaction.size.toLocaleString() : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: safeColors.secondary, fontFamily: 'monospace' }}>
                    {transaction.fee ? formatFee(transaction.fee) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: safeColors.warning, fontFamily: 'monospace' }}>
                    {transaction.feeRate ? formatFeeRate(transaction.feeRate) : '-'}
                  </TableCell>
                  <TableCell align="center" sx={{ color: safeColors.textPrimary }}>
                    <Typography variant="body2" component="span" sx={{ color: safeColors.info }}>
                      {transaction.inputs || '?'}
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ color: safeColors.textSecondary, mx: 0.5 }}>
                      /
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ color: safeColors.success }}>
                      {transaction.outputs || '?'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" sx={{ color: safeColors.textPrimary }}>
                    {transaction.confirmations ? (
                      <Chip
                        label={transaction.confirmations}
                        size="small"
                        color={transaction.confirmations >= 6 ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="body2" sx={{ color: safeColors.textSecondary }}>
                        Unconfirmed
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ color: safeColors.textSecondary }}>
                    {formatTime(transaction.timestamp)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!loading && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" sx={{ color: safeColors.textSecondary }}>
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </Typography>
          <Typography variant="body2" sx={{ color: safeColors.textSecondary }}>
            {autoRefresh && `Auto-refresh every ${refreshInterval / 1000}s`}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default TransactionTable;
