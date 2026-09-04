import { useState } from 'react'
import { Alert, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Typography } from '@mui/material'
import { PAF_LICENSE_CLASSES } from '../lib/referenceData'

// See ../../Console.md section 6.9 (NCOALink licensing and the PAF).
export function PafLicensing() {
  const [tab, setTab] = useState(0)

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        PAF &amp; licensing
      </Typography>
      <Alert severity="warning">Worksheet only -- not a filing, not the USPS form.</Alert>

      <Tabs value={tab} onChange={(_e, v: number) => setTab(v)}>
        <Tab label="Licence classes" />
        <Tab label="Form builder" />
        <Tab label="Printed obligations" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Class</TableCell>
                <TableCell>Agreement version</TableCell>
                <TableCell align="right">Annual fee</TableCell>
                <TableCell>PAF obligation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PAF_LICENSE_CLASSES.map((c) => (
                <TableRow key={c.licenseClass}>
                  <TableCell>{c.licenseClass}</TableCell>
                  <TableCell>{c.agreementVersion}</TableCell>
                  <TableCell align="right">{c.annualFee.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                  <TableCell>{c.pafObligation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography color="text.secondary">
            Three party blocks: List Owner and Licensee are always present. Exactly one of
            Broker/Agent OR List Administrator may also appear -- never both.
          </Typography>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography color="text.secondary">Select a licence class and complete the form builder to preview printed obligations.</Typography>
        </Paper>
      )}
    </Stack>
  )
}
