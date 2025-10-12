import React, { useState, useEffect, useCallback } from 'react';
import { braidpoolApi } from '../../utils/braidpoolApi';
import { BraidPoolTransaction } from '../../types/transaction';
import { Box, Typography, Grid, Switch, FormControlLabel, Chip, Tooltip } from '@mui/material';
import TransactionTable from './TransactionTable';
import TopStatsBar from '../common/TopStatsBar';
import colors from '../../theme/colors';
import {
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_CATEGORY_DESCRIPTIONS,
  TransactionCategory,
} from '../../types/transaction';

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<BraidPoolTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval] = useState(30000);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await braidpoolApi.fetchRecentTransactions(50);
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchTransactions, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchTransactions, refreshInterval]);

  const handleAutoRefreshChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRefresh(event.target.checked);
  };

  return (
    <Box sx={{ p: 3, backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: colors.textPrimary, fontWeight: 'bold', mb: 2 }}>
          Transaction Management
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 3 }}>
          Monitor and analyze Bitcoin transactions across different categories and states
        </Typography>

        {/* Stats Bar */}
        <TopStatsBar />
      </Box>

      {/* Transaction Categories Legend */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 2, fontWeight: 'bold' }}>
          Transaction Categories
        </Typography>
        <Grid container spacing={2}>
          {Object.entries(TRANSACTION_CATEGORY_LABELS).map(([key, label]) => {
            const category = key as TransactionCategory;
            const getCategoryColor = (cat: TransactionCategory) => {
              switch (cat) {
                case TransactionCategory.MEMPOOL: return colors.info;
                case TransactionCategory.COMMITTED: return colors.primary;
                case TransactionCategory.PROPOSED: return colors.success;
                case TransactionCategory.SCHEDULED: return colors.warning;
                case TransactionCategory.CONFIRMED: return colors.success;
                case TransactionCategory.REPLACED: return colors.error;
                default: return colors.textSecondary;
              }
            };

            return (
              <Grid item xs={12} sm={6} md={4} lg={2} key={category}>
                <Tooltip title={TRANSACTION_CATEGORY_DESCRIPTIONS[category]} arrow>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      backgroundColor: colors.paper,
                      border: `1px solid ${getCategoryColor(category)}20`,
                      cursor: 'help',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: `${getCategoryColor(category)}10`,
                        borderColor: `${getCategoryColor(category)}40`,
                      },
                    }}
                  >
                    <Chip
                      label={label}
                      size="small"
                      sx={{
                        backgroundColor: `${getCategoryColor(category)}20`,
                        color: getCategoryColor(category),
                        fontWeight: 'bold',
                        mb: 1,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: colors.textSecondary,
                        fontSize: '0.75rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {TRANSACTION_CATEGORY_DESCRIPTIONS[category]}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Controls */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 'bold' }}>
            Live Transaction Feed
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Real-time Bitcoin transactions from your node
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: colors.primary,
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: colors.primary,
                },
              }}
            />
          }
          label={
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Auto Refresh
            </Typography>
          }
        />
      </Box>

      {/* Transaction Table */}
      <TransactionTable
        transactions={transactions}
        loading={loading}
        error={error}
        autoRefresh={autoRefresh}
        refreshInterval={refreshInterval}
        maxHeight={700}
      />
    </Box>
  );
};

export default TransactionsPage;
