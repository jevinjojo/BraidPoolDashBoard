import BraidPoolApi, { braidpoolApi, BraidPoolApiError } from '../braidpoolApi';
import { TransactionCategory } from '../transaction';

// Mock fetch globally
global.fetch = jest.fn();

describe('BraidPoolApi', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor and Configuration', () => {
    it('creates instance with default configuration', () => {
      const api = new BraidPoolApi();
      expect(api).toBeInstanceOf(BraidPoolApi);
    });

    it('creates instance with custom configuration', () => {
      const customConfig = {
        baseUrl: 'http://custom-api.com',
        timeout: 5000,
        retries: 5
      };
      const api = new BraidPoolApi(customConfig);
      expect(api).toBeInstanceOf(BraidPoolApi);
    });

    it('exports singleton instance', () => {
      expect(braidpoolApi).toBeInstanceOf(BraidPoolApi);
    });
  });

  describe('fetchRecentTransactions', () => {
    const mockApiTransactions = [
      {
        txid: 'tx1',
        hash: 'tx1-hash',
        category: 'mempool',
        size: 250,
        weight: 1000,
        fee: 0.00001,
        fee_rate: 10.5,
        inputs: 2,
        outputs: 3,
        confirmations: 0,
        work: 100,
        work_unit: 'TH',
        timestamp: 1234567890,
        rbf_signaled: true,
        status: { confirmed: false }
      },
      {
        txid: 'tx2',
        hash: 'tx2-hash',
        category: 'confirmed',
        size: 180,
        fee: 0.00005,
        fee_rate: 25.3,
        confirmations: 6,
        status: { confirmed: true, block_height: 100 }
      }
    ];

    it('fetches and transforms transactions successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiTransactions
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/transactions'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].txid).toBe('tx1');
      expect(result[0].category).toBe(TransactionCategory.MEMPOOL);
      expect(result[0].feeRate).toBe(10.5);
      expect(result[0].rbfSignaled).toBe(true);
    });

    it('limits results to specified limit', async () => {
      const manyTransactions = Array(50).fill(null).map((_, i) => ({
        txid: `tx${i}`,
        hash: `tx${i}-hash`,
        category: 'mempool',
        confirmations: 0
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => manyTransactions
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(10);

      expect(result).toHaveLength(10);
    });

    it('handles API errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error'
      } as Response);

      await expect(braidpoolApi.fetchRecentTransactions(10))
        .rejects
        .toThrow(BraidPoolApiError);
    });
  });

  describe('fetchMempoolInfo', () => {
    const mockMempoolInfo = {
      count: 1500,
      vsize: 2500000,
      total_fee: 0.5,
      fee_histogram: [[1, 100], [5, 200], [10, 300]] as Array<[number, number]>
    };

    it('fetches mempool info successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMempoolInfo
      } as Response);

      const result = await braidpoolApi.fetchMempoolInfo();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/mempool/info'),
        expect.any(Object)
      );

      expect(result).toEqual(mockMempoolInfo);
    });
  });

  describe('Error Handling', () => {
    it('throws BraidPoolApiError with status code on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Resource not found'
      } as Response);

      try {
        await braidpoolApi.fetchRecentTransactions(10);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(BraidPoolApiError);
        expect((error as BraidPoolApiError).statusCode).toBe(404);
        expect((error as BraidPoolApiError).message).toContain('404');
      }
    });

    it('throws timeout error when request takes too long', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementationOnce(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: async () => []
          } as Response), 20000);
        })
      );

      const promise = braidpoolApi.fetchRecentTransactions(10);
      
      jest.advanceTimersByTime(11000);

      await expect(promise).rejects.toThrow('Request timeout');
    });

    it('throws error on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(braidpoolApi.fetchRecentTransactions(10))
        .rejects
        .toThrow(BraidPoolApiError);
    });
  });

  describe('Retry Logic', () => {
    it('retries failed requests up to configured limit', async () => {
      jest.useFakeTimers();
      
      const api = new BraidPoolApi({ retries: 2 });
      
      // First two attempts fail
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        } as Response);

      const promise = api.fetchRecentTransactions(10);
      
      // Fast-forward through retry delays
      await jest.runAllTimersAsync();
      
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual([]);
    });

    it('throws error after all retries are exhausted', async () => {
      jest.useFakeTimers();
      
      const api = new BraidPoolApi({ retries: 2 });
      
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      const promise = api.fetchRecentTransactions(10);
      
      await jest.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Persistent error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Category Normalization', () => {
    const testCases = [
      { input: 'confirmed', expected: TransactionCategory.CONFIRMED },
      { input: 'CONFIRMED', expected: TransactionCategory.CONFIRMED },
      { input: 'confirming', expected: TransactionCategory.CONFIRMED },
      { input: 'scheduled', expected: TransactionCategory.SCHEDULED },
      { input: 'Schedule', expected: TransactionCategory.SCHEDULED },
      { input: 'proposed', expected: TransactionCategory.PROPOSED },
      { input: 'PROPOSE', expected: TransactionCategory.PROPOSED },
      { input: 'committed', expected: TransactionCategory.COMMITTED },
      { input: 'COMMIT', expected: TransactionCategory.COMMITTED },
      { input: 'mempool', expected: TransactionCategory.MEMPOOL },
      { input: 'replaced', expected: TransactionCategory.REPLACED },
      { input: 'unknown', expected: TransactionCategory.MEMPOOL },
      { input: '', expected: TransactionCategory.MEMPOOL },
      { input: undefined, expected: TransactionCategory.MEMPOOL }
    ];

    testCases.forEach(({ input, expected }) => {
      it(`normalizes "${input}" to ${expected}`, async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            txid: 'test',
            category: input,
            confirmations: 0
          }]
        } as Response);

        const result = await braidpoolApi.fetchRecentTransactions(1);
        expect(result[0].category).toBe(expected);
      });
    });
  });

  describe('Work Parsing', () => {
    it('parses numeric work values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          txid: 'test',
          work: 150,
          confirmations: 0
        }]
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(1);
      expect(result[0].work).toBe(150);
      expect(result[0].workUnit).toBe('TH');
    });

    it('parses string work values with units', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          txid: 'test1',
          work: '250 PH',
          confirmations: 0
        }]
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(1);
      expect(result[0].work).toBe(250);
      expect(result[0].workUnit).toBe('PH');
    });

    it('handles null/undefined work values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          txid: 'test',
          work: null,
          confirmations: 0
        }]
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(1);
      expect(result[0].work).toBe(0);
      expect(result[0].workUnit).toBe('TH');
    });
  });

  describe('Data Transformation', () => {
    it('transforms API transaction to BraidPoolTransaction format', async () => {
      const apiTx = {
        txid: 'abc123',
        hash: 'abc123hash',
        category: 'mempool',
        size: 250,
        weight: 1000,
        fee: 0.00001,
        fee_rate: 10.5,
        inputs: 2,
        outputs: 3,
        confirmations: 0,
        work: '100 TH',
        work_unit: 'TH',
        timestamp: 1234567890,
        rbf_signaled: true,
        status: { confirmed: false },
        vin: [{ txid: 'input1', vout: 0, sequence: 4294967295 }],
        vout: [{ value: 1000000, scriptpubkey_type: 'p2pkh' }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [apiTx]
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(1);

      expect(result[0]).toMatchObject({
        txid: 'abc123',
        hash: 'abc123hash',
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
        timestamp: 1234567890,
        rbfSignaled: true
      });

      expect(result[0].vin).toHaveLength(1);
      expect(result[0].vout).toHaveLength(1);
      expect(result[0].status.confirmed).toBe(false);
    });

    it('provides default values for missing fields', async () => {
      const minimalApiTx = {
        txid: 'minimal',
        confirmations: 0
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [minimalApiTx]
      } as Response);

      const result = await braidpoolApi.fetchRecentTransactions(1);

      expect(result[0]).toMatchObject({
        txid: 'minimal',
        hash: 'minimal',
        category: TransactionCategory.MEMPOOL,
        size: 0,
        weight: 0,
        fee: 0,
        feeRate: 0,
        inputs: 0,
        outputs: 0,
        confirmations: 0,
        work: 0,
        rbfSignaled: false
      });

      expect(result[0].timestamp).toBeDefined();
      expect(result[0].vin).toEqual([]);
      expect(result[0].vout).toEqual([]);
    });
  });
});
