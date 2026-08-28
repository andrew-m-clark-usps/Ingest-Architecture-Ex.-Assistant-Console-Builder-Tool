import { Alert, Typography } from '@mui/material'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 6.9 (NCOALink licensing
// and the PAF).
export function PafLicensing() {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        PAF &amp; licensing
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Worksheet only -- not a filing, not the USPS form. See ../Console.md
        section 6.9.
      </Alert>
      <Typography color="text.secondary">
        Demo scaffold: licence classes, the form builder, and the printed
        obligations are not implemented yet.
      </Typography>
    </>
  )
}
