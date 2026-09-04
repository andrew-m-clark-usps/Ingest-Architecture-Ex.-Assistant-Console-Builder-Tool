import { useMemo, useState } from 'react'
import { Alert, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { aggregateLedger, type LedgerTransaction } from '../lib/ledger'
import { SAMPLE_LEDGER_TRANSACTIONS } from '../lib/sampleData'

// See ../../Console.md section 6.3/6.4 (payment ledgers). Balance-over-time
// is the total position per date (each account's last-known balance
// carried forward, summed across accounts), and closing balance is the sum
// of per-account closing balances -- not the raw balanceAfter column and
// not "whichever row is latest". Only Posted rows move money.

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function TrendChart({ points }: { points: { date: string; total: number }[] }) {
  if (points.length === 0) return null
  const width = 600
  const height = 160
  const max = Math.max(...points.map((p) => p.total), 0)
  const min = Math.min(...points.map((p) => p.total), 0)
  const range = max - min || 1
  const stepX = points.length > 1 ? width / (points.length - 1) : 0
  const path = points
    .map((p, i) => {
      const x = i * stepX
      const y = height - ((p.total - min) / range) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Balance over time (total position)">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  )
}

export function Ledger() {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([])
  const aggregate = useMemo(() => aggregateLedger(transactions), [transactions])
  const [filter, setFilter] = useState('')

  const filteredTransactions = transactions.filter(
    (t) => filter.trim().length === 0 || `${t.accountNumber} ${t.transactionType} ${t.productType}`.toLowerCase().includes(filter.toLowerCase()),
  )

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Payment ledger
      </Typography>

      {transactions.length === 0 ? (
        <Alert severity="info" action={<Button onClick={() => setTransactions(SAMPLE_LEDGER_TRANSACTIONS)}>Load sample data</Button>}>
          No transactions loaded yet.
        </Alert>
      ) : (
        <>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip label={`Closing balance: ${formatCurrency(aggregate.closingBalance)}`} color="primary" />
            <Chip label={`Debits: ${formatCurrency(aggregate.totalDebits)}`} />
            <Chip label={`Credits: ${formatCurrency(aggregate.totalCredits)}`} />
            <Chip label={`Net: ${formatCurrency(aggregate.net)}`} />
            <Chip label={`Pending: ${aggregate.pendingCount}`} color="warning" variant="outlined" />
            <Chip label={`Rejected: ${aggregate.rejectedCount}`} color="error" variant="outlined" />
          </Stack>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Balance over time (total position)
            </Typography>
            <TrendChart points={aggregate.balanceOverTime} />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Per-account summary
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell align="right">Debits</TableCell>
                    <TableCell align="right">Credits</TableCell>
                    <TableCell align="right">Net</TableCell>
                    <TableCell align="right">Closing balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aggregate.perAccount.map((row) => (
                    <TableRow key={row.accountNumber}>
                      <TableCell>{row.accountNumber}</TableCell>
                      <TableCell align="right">{formatCurrency(row.debits)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.credits)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.net)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.closingBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1">Transactions</Typography>
              <Stack direction="row" spacing={1}>
                <input aria-label="Filter transactions" placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} />
                <Button
                  size="small"
                  onClick={() =>
                    downloadCsv('ledger-transactions.csv', [
                      ['Transaction ID', 'Account', 'Date', 'Type', 'Amount', 'Balance After', 'Status'],
                      ...filteredTransactions.map((t) => [t.transactionId, t.accountNumber, t.postedDate, t.transactionType, String(t.amount), String(t.balanceAfter), t.status]),
                    ])
                  }
                >
                  Export CSV
                </Button>
              </Stack>
            </Stack>
            {filteredTransactions.length === 0 ? (
              <Alert severity="info">No transactions match this filter.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Transaction ID</TableCell>
                      <TableCell>Account</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Balance after</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.transactionId}</TableCell>
                        <TableCell>{t.accountNumber}</TableCell>
                        <TableCell>{t.postedDate}</TableCell>
                        <TableCell>{t.transactionType}</TableCell>
                        <TableCell align="right">{formatCurrency(t.amount)}</TableCell>
                        <TableCell align="right">{formatCurrency(t.balanceAfter)}</TableCell>
                        <TableCell>{t.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}
    </Stack>
  )
}
