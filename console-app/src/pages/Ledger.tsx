import { Typography } from '@mui/material'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 6.3/6.4 (payment
// ledgers and the two real aggregation bugs to avoid).
export function Ledger() {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        Payment ledger
      </Typography>
      <Typography color="text.secondary">
        Demo scaffold: KPI row, trend chart, and transaction grid are not
        implemented -- see ../Console.md section 6.3/6.4.
      </Typography>
    </>
  )
}
