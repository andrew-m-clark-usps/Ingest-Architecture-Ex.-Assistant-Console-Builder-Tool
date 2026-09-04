import { useMemo, useState } from 'react'
import { Alert, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { computeDailyAccrual, computeInvoice, meterUsageEvents } from '../lib/usageMetering'
import { SAMPLE_IP_AGREEMENTS, SAMPLE_USAGE_EVENTS } from '../lib/sampleData'

// See ../../Console.md section 4.3 and 6.6. The account-entry walkthrough
// (Customer Registration -> Steps 1-3, no password field, ever) is a
// separate, larger workbench tracked in ROADMAP.md; this page focuses on
// the usage-metering dashboard, which is the piece with the two
// known-tricky metering rules (dedupe over full history, transaction-only
// daily accrual).

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function Usage() {
  const [loaded, setLoaded] = useState(false)
  const metered = useMemo(() => (loaded ? meterUsageEvents(SAMPLE_USAGE_EVENTS, SAMPLE_IP_AGREEMENTS) : []), [loaded])
  const invoices = useMemo(() => (loaded ? computeInvoice(metered, SAMPLE_IP_AGREEMENTS, '2026-08') : []), [loaded, metered])
  const daily = useMemo(() => (loaded ? computeDailyAccrual(metered, SAMPLE_IP_AGREEMENTS) : []), [loaded, metered])

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Usage &amp; reporting
      </Typography>
      <Alert severity="info">
        This is a model, not the real USPS Business Customer Gateway sign-up flow -- no
        password field exists anywhere in this product, and no USPS API is ever called.
      </Alert>

      {!loaded ? (
        <Alert severity="info" action={<Button onClick={() => setLoaded(true)}>Load sample data</Button>}>
          No usage events loaded yet.
        </Alert>
      ) : (
        <>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Daily accrued charge (transaction-model agreements only)
            </Typography>
            {daily.length === 0 ? (
              <Typography color="text.secondary">No transaction-model charges this period.</Typography>
            ) : (
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {daily.map((d) => (
                  <Chip key={d.date} label={`${d.date}: ${formatCurrency(d.charge)}`} />
                ))}
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Projected invoice -- August 2026
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell>Fee model</TableCell>
                    <TableCell align="right">Billable units</TableCell>
                    <TableCell align="right">Charge</TableCell>
                    <TableCell>Line item</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.agreementId}>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell>{inv.feeModel}</TableCell>
                      <TableCell align="right">{inv.billableUnits}</TableCell>
                      <TableCell align="right">{formatCurrency(inv.totalCharge)}</TableCell>
                      <TableCell>{inv.lineItem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Event log
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Channel</TableCell>
                    <TableCell>Tracking #</TableCell>
                    <TableCell>Billable</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>{e.channel}</TableCell>
                      <TableCell>{e.trackingNumber}</TableCell>
                      <TableCell>{e.billable ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Stack>
  )
}
