import {
  TransactionCategory,
  TRANSACTION_CATEGORY_LABELS,
  TRANSACTION_CATEGORY_DESCRIPTIONS,
  BraidPoolTransaction,
  TransactionInput,
  TransactionOutput,
  TransactionStatus
} from '../transaction';

describe('Transaction Types', () => {
  describe('TransactionCategory Enum', () => {
    it('has correct enum values', () => {
      expect(TransactionCategory.MEMPOOL).toBe('mempool');
      expect(TransactionCategory.COMMITTED).toBe('committed');
      expect(TransactionCategory.PROPOSED).toBe('proposed');
      expect(TransactionCategory.SCHEDULED).toBe('scheduled');
      expect(TransactionCategory.CONFIRMED).toBe('confirmed');
      expect(TransactionCategory.REPLACED).toBe('replaced');
    });

    it('contains all expected categories', () => {
      const categories = Object.values(TransactionCategory);
      expect(categories).toHaveLength(6);
      expect(categories).toContain('mempool');
      expect(categories).toContain('committed');
      expect(categories).toContain('proposed');
      expect(categories).toContain('scheduled');
      expect(categories).toContain('confirmed');
      expect(categories).toContain('replaced');
    });
  });

  describe('TRANSACTION_CATEGORY_LABELS', () => {
    it('has labels for all categories', () => {
      expect(TRANSACTION_CATEGORY_LABELS[TransactionCategory.MEMPOOL]).toBe('Mempool');
      expect(TRANSACTION_CATEGORY_LABELS[TransactionCategory.COMMITTED]).toBe('Committed');
      expect(TRANSACTION_CATEGORY_LABELS[TransactionCategory.PROPOSED]).toBe('Proposed');
      expect(TRANSACTION_CATEGORY_LABELS[TransactionCategory.SCHEDULED]).toBe('Scheduled');
      expect(TRANSACTION_CATEGORY_LABELS[TransactionCategory.CONFIRMED]).toBe('Confirmed');
      expect(TRANSACTION_CATEGORY_LABELS[TransactionCategory.REPLACED]).toBe('Replaced');
    });

    it('has correct number of labels', () => {
      const labelCount = Object.keys(TRANSACTION_CATEGORY_LABELS).length;
      expect(labelCount).toBe(6);
    });

    it('all labels are capitalized strings', () => {
      Object.values(TRANSACTION_CATEGORY_LABELS).forEach(label => {
        expect(typeof label).toBe('string');
        expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
      });
    });
  });

  describe('TRANSACTION_CATEGORY_DESCRIPTIONS', () => {
    it('has descriptions for all categories', () => {
      expect(TRANSACTION_CATEGORY_DESCRIPTIONS[TransactionCategory.MEMPOOL])
        .toBe('Transactions in bitcoind mempool only');
      expect(TRANSACTION_CATEGORY_DESCRIPTIONS[TransactionCategory.COMMITTED])
        .toBe('Transactions committed to cmempool node');
      expect(TRANSACTION_CATEGORY_DESCRIPTIONS[TransactionCategory.PROPOSED])
        .toBe('Transactions proposed for next block');
      expect(TRANSACTION_CATEGORY_DESCRIPTIONS[TransactionCategory.SCHEDULED])
        .toBe('Transactions scheduled for mining');
      expect(TRANSACTION_CATEGORY_DESCRIPTIONS[TransactionCategory.CONFIRMED])
        .toBe('Transactions confirmed in a block');
      expect(TRANSACTION_CATEGORY_DESCRIPTIONS[TransactionCategory.REPLACED])
        .toBe('Transactions replaced by RBF');
    });

    it('has correct number of descriptions', () => {
      const descCount = Object.keys(TRANSACTION_CATEGORY_DESCRIPTIONS).length;
      expect(descCount).toBe(6);
    });

    it('all descriptions are non-empty strings', () => {
      Object.values(TRANSACTION_CATEGORY_DESCRIPTIONS).forEach(desc => {
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Type Interfaces', () => {
    it('TransactionInput has correct structure', () => {
      const input: TransactionInput = {
        txid: 'abc123',
        vout: 0,
        sequence: 4294967295,
        prevout: {
          value: 1000000
        }
      };

      expect(input.txid).toBe('abc123');
      expect(input.vout).toBe(0);
      expect(input.sequence).toBe(4294967295);
      expect(input.prevout?.value).toBe(1000000);
    });

    it('TransactionInput works without optional prevout', () => {
      const input: TransactionInput = {
        txid: 'abc123',
        vout: 0,
        sequence: 4294967295
      };

      expect(input.prevout).toBeUndefined();
    });

    it('TransactionOutput has correct structure', () => {
      const output: TransactionOutput = {
        value: 1000000,
        scriptpubkey_type: 'p2pkh',
        scriptpubkey_address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
      };

      expect(output.value).toBe(1000000);
      expect(output.scriptpubkey_type).toBe('p2pkh');
      expect(output.scriptpubkey_address).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    });

    it('TransactionOutput works without optional address', () => {
      const output: TransactionOutput = {
        value: 1000000,
        scriptpubkey_type: 'p2pkh'
      };

      expect(output.scriptpubkey_address).toBeUndefined();
    });

    it('TransactionStatus has correct structure', () => {
      const status: TransactionStatus = {
        confirmed: true,
        block_height: 700000,
        block_hash: 'abc123def456',
        block_time: 1634567890
      };

      expect(status.confirmed).toBe(true);
      expect(status.block_height).toBe(700000);
      expect(status.block_hash).toBe('abc123def456');
      expect(status.block_time).toBe(1634567890);
    });

    it('TransactionStatus works with minimal fields', () => {
      const status: TransactionStatus = {
        confirmed: false
      };

      expect(status.confirmed).toBe(false);
      expect(status.block_height).toBeUndefined();
    });

    it('BraidPoolTransaction has correct structure', () => {
      const transaction: BraidPoolTransaction = {
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
        vin: [],
        vout: [],
        status: { confirmed: false },
        timestamp: 1634567890,
        rbfSignaled: true
      };

      expect(transaction.txid).toBe('abc123');
      expect(transaction.category).toBe(TransactionCategory.MEMPOOL);
      expect(transaction.fee).toBe(0.00001);
      expect(transaction.feeRate).toBe(10.5);
      expect(transaction.rbfSignaled).toBe(true);
    });

    it('BraidPoolTransaction works with optional fields undefined', () => {
      const transaction: BraidPoolTransaction = {
        txid: 'abc123',
        hash: 'abc123hash',
        category: TransactionCategory.MEMPOOL,
        size: 250,
        weight: 1000,
        fee: 0.00001,
        feeRate: 10.5,
        inputs: 2,
        outputs: 3,
        vin: [],
        vout: [],
        status: { confirmed: false }
      };

      expect(transaction.confirmations).toBeUndefined();
      expect(transaction.work).toBeUndefined();
      expect(transaction.timestamp).toBeUndefined();
      expect(transaction.rbfSignaled).toBeUndefined();
    });
  });

  describe('Type Consistency', () => {
    it('ensures all categories have both labels and descriptions', () => {
      Object.values(TransactionCategory).forEach(category => {
        expect(TRANSACTION_CATEGORY_LABELS[category]).toBeDefined();
        expect(TRANSACTION_CATEGORY_DESCRIPTIONS[category]).toBeDefined();
      });
    });

    it('ensures labels and descriptions have same keys', () => {
      const labelKeys = Object.keys(TRANSACTION_CATEGORY_LABELS).sort();
      const descKeys = Object.keys(TRANSACTION_CATEGORY_DESCRIPTIONS).sort();
      expect(labelKeys).toEqual(descKeys);
    });
  });
});
