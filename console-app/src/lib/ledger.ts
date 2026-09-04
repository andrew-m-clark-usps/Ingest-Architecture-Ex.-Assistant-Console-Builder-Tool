// See ../../Console.md section 6.3/6.4. Domain core built and unit-tested
// before any page wiring, per the brief's own advice -- the two real
// aggregation bugs the original build shipped were both invisible to unit
// tests that only checked totals; they only showed up once someone looked
// at the rendered chart.

export type TransactionStatus = 'Posted' | 'Pending' | 'Reversed' | 'Rejected'

export interface LedgerTransaction {
  id: string
  transactionId: string
  accountNumber: string
  crid: string
  mid?: string
  permitNumber?: string
  postedDate: string // ISO yyyy-mm-dd
  transactionType: string
  channel: string
  productType: string
  amount: number // signed: debit negative, credit positive
  balanceAfter: number
  status: TransactionStatus
  statementId: string
}

export interface BalancePoint {
  date: string
  total: number
}

export interface AccountSummary {
  accountNumber: string
  debits: number
  credits: number
  net: number
  closingBalance: number
}

export interface LedgerAggregate {
  balanceOverTime: BalancePoint[]
  totalDebits: number
  totalCredits: number
  net: number
  closingBalance: number
  perAccount: AccountSummary[]
  pendingCount: number
  rejectedCount: number
}

// Only Posted (settled) rows move money -- Pending and Rejected rows are
// still ingested/counted/displayed elsewhere, but excluded here from
// debits, credits, net, the trend, and the closing balance.
export function aggregateLedger(transactions: LedgerTransaction[]): LedgerAggregate {
  const posted = transactions.filter((t) => t.status === 'Posted')

  const byAccount = new Map<string, LedgerTransaction[]>()
  for (const t of posted) {
    const list = byAccount.get(t.accountNumber) ?? []
    list.push(t)
    byAccount.set(t.accountNumber, list)
  }
  for (const list of byAccount.values()) {
    list.sort((a, b) => a.postedDate.localeCompare(b.postedDate))
  }

  const perAccount: AccountSummary[] = []
  let totalDebits = 0
  let totalCredits = 0
  let closingBalance = 0

  for (const [accountNumber, list] of byAccount) {
    let debits = 0
    let credits = 0
    for (const t of list) {
      if (t.amount < 0) debits += -t.amount
      else credits += t.amount
    }
    const last = list[list.length - 1]
    perAccount.push({ accountNumber, debits, credits, net: credits - debits, closingBalance: last.balanceAfter })
    totalDebits += debits
    totalCredits += credits
    // Closing balance is the SUM of per-account closing balances -- not
    // the value on whichever row happens to be latest across accounts.
    closingBalance += last.balanceAfter
  }

  // Balance-over-time is the TOTAL POSITION per date: each account's
  // last-known balance carried forward, summed across every account.
  // Plotting the raw balanceAfter column directly would saw-tooth
  // between accounts and drop to zero on days with no posted activity
  // for a given account.
  const allDates = [...new Set(posted.map((t) => t.postedDate))].sort()
  const runningBalances = new Map<string, number>()
  const balanceOverTime: BalancePoint[] = allDates.map((date) => {
    for (const [accountNumber, list] of byAccount) {
      const todays = list.filter((t) => t.postedDate === date)
      if (todays.length > 0) runningBalances.set(accountNumber, todays[todays.length - 1].balanceAfter)
    }
    let total = 0
    for (const accountNumber of byAccount.keys()) total += runningBalances.get(accountNumber) ?? 0
    return { date, total }
  })

  return {
    balanceOverTime,
    totalDebits,
    totalCredits,
    net: totalCredits - totalDebits,
    closingBalance,
    perAccount: perAccount.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
    pendingCount: transactions.filter((t) => t.status === 'Pending').length,
    rejectedCount: transactions.filter((t) => t.status === 'Rejected').length,
  }
}
