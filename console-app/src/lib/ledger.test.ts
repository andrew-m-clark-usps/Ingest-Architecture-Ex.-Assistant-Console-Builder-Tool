import { describe, expect, it } from 'vitest'
import { aggregateLedger, type LedgerTransaction } from './ledger'

const base: Omit<LedgerTransaction, 'id' | 'transactionId' | 'accountNumber' | 'postedDate' | 'amount' | 'balanceAfter' | 'status'> = {
  crid: 'CRID-1',
  transactionType: 'Postage',
  channel: 'Meter',
  productType: 'First-Class Mail',
  statementId: 'STMT-1',
}

function tx(overrides: Partial<LedgerTransaction> & Pick<LedgerTransaction, 'id' | 'transactionId' | 'accountNumber' | 'postedDate' | 'amount' | 'balanceAfter' | 'status'>): LedgerTransaction {
  return { ...base, ...overrides }
}

describe('aggregateLedger', () => {
  it('excludes Pending and Rejected rows from debits/credits/net/closing balance', () => {
    const result = aggregateLedger([
      tx({ id: '1', transactionId: 'T1', accountNumber: 'A', postedDate: '2026-08-01', amount: 100, balanceAfter: 100, status: 'Posted' }),
      tx({ id: '2', transactionId: 'T2', accountNumber: 'A', postedDate: '2026-08-02', amount: -1000, balanceAfter: -900, status: 'Pending' }),
      tx({ id: '3', transactionId: 'T3', accountNumber: 'A', postedDate: '2026-08-03', amount: -500, balanceAfter: -400, status: 'Rejected' }),
    ])
    expect(result.totalDebits).toBe(0)
    expect(result.totalCredits).toBe(100)
    expect(result.closingBalance).toBe(100)
    expect(result.pendingCount).toBe(1)
    expect(result.rejectedCount).toBe(1)
  })

  it('regression: closing balance is the SUM of per-account closing balances, not the value on the latest row', () => {
    const result = aggregateLedger([
      tx({ id: '1', transactionId: 'T1', accountNumber: 'A', postedDate: '2026-08-01', amount: 100, balanceAfter: 100, status: 'Posted' }),
      tx({ id: '2', transactionId: 'T2', accountNumber: 'B', postedDate: '2026-08-05', amount: 50, balanceAfter: 50, status: 'Posted' }),
    ])
    // A naive "last row overall" bug would report 50 (account B's row is
    // latest by date). The correct answer sums both accounts' own
    // closing balances: 100 + 50.
    expect(result.closingBalance).toBe(150)
  })

  it('regression: balance-over-time is the total position per date (carried forward across accounts), not the raw balanceAfter column', () => {
    const result = aggregateLedger([
      tx({ id: '1', transactionId: 'T1', accountNumber: 'A', postedDate: '2026-08-01', amount: 100, balanceAfter: 100, status: 'Posted' }),
      tx({ id: '2', transactionId: 'T2', accountNumber: 'B', postedDate: '2026-08-02', amount: 200, balanceAfter: 200, status: 'Posted' }),
      tx({ id: '3', transactionId: 'T3', accountNumber: 'A', postedDate: '2026-08-03', amount: -20, balanceAfter: 80, status: 'Posted' }),
    ])
    // Naive raw-column plotting would saw-tooth: 100, 200, 80 (and zero
    // for account B on 08-01/08-03). The total-position series must
    // instead carry each account's last-known balance forward and sum:
    // 08-01: A=100 (B not yet active) => 100
    // 08-02: A=100, B=200 => 300
    // 08-03: A=80,  B=200 => 280
    expect(result.balanceOverTime).toEqual([
      { date: '2026-08-01', total: 100 },
      { date: '2026-08-02', total: 300 },
      { date: '2026-08-03', total: 280 },
    ])
  })

  it('computes per-account debit/credit/net summaries', () => {
    const result = aggregateLedger([
      tx({ id: '1', transactionId: 'T1', accountNumber: 'A', postedDate: '2026-08-01', amount: 500, balanceAfter: 500, status: 'Posted' }),
      tx({ id: '2', transactionId: 'T2', accountNumber: 'A', postedDate: '2026-08-02', amount: -120, balanceAfter: 380, status: 'Posted' }),
    ])
    expect(result.perAccount).toEqual([{ accountNumber: 'A', debits: 120, credits: 500, net: 380, closingBalance: 380 }])
  })
})
