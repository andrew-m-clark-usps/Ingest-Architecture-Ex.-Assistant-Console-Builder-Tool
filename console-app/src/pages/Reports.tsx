import { useMemo, useState } from 'react'
import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import { aggregateLedger } from '../lib/ledger'
import { SAMPLE_LEDGER_TRANSACTIONS } from '../lib/sampleData'

// See ../../Console.md section 4 item 7 (reports). A printable summary --
// use the browser's own print dialog; @media print here hides the nav
// shell so only the report content is sent to the printer.
export function Reports() {
  const [loaded, setLoaded] = useState(false)
  const aggregate = useMemo(() => aggregateLedger(loaded ? SAMPLE_LEDGER_TRANSACTIONS : []), [loaded])

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom sx={{ '@media print': { display: 'none' } }}>
        Reports
      </Typography>

      {!loaded ? (
        <Alert severity="info" action={<Button onClick={() => setLoaded(true)}>Load sample data</Button>} sx={{ '@media print': { display: 'none' } }}>
          No data loaded yet.
        </Alert>
      ) : (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h5" gutterBottom>
            Payment ledger summary
          </Typography>
          <Typography>Total debits: {aggregate.totalDebits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Typography>
          <Typography>Total credits: {aggregate.totalCredits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Typography>
          <Typography>Net: {aggregate.net.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Typography>
          <Typography>Closing balance: {aggregate.closingBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Typography>
          <Button onClick={() => window.print()} sx={{ mt: 2, '@media print': { display: 'none' } }}>
            Print
          </Button>
        </Paper>
      )}
    </Stack>
  )
}
