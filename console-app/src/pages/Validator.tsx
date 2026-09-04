import { useMemo, useState } from 'react'
import { Alert, Chip, Paper, Stack, TextField, Typography } from '@mui/material'
import { standardizeAddress } from '../lib/addressStandardizer'
import { STATES } from '../lib/referenceData'

// See ../../Console.md section 6.1 (Publication 28 address standardizer).
// Standardizes on every keystroke and lists which rules fired, with their
// severity and Publication 28 reference.

const severityColor = { error: 'error', warning: 'warning', info: 'info' } as const

export function Validator() {
  const [deliveryLine, setDeliveryLine] = useState('123 Key West Blvd Apt 4')
  const [city, setCity] = useState('Austin')
  const [state, setState] = useState('TX')
  const [zip5, setZip5] = useState('78701')
  const [zip4, setZip4] = useState('')

  const result = useMemo(() => standardizeAddress({ deliveryLine, city, state, zip5, zip4: zip4 || undefined }), [deliveryLine, city, state, zip5, zip4])

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Address validator
      </Typography>
      <Typography color="text.secondary">
        Publication 28 structural parsing -- a reference-quality model, not a
        production CASS-certified validator. States list is data-driven (see
        Appendix B of Publication 28).
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2} maxWidth={480}>
          <TextField label="Delivery line" value={deliveryLine} onChange={(e) => setDeliveryLine(e.target.value)} fullWidth />
          <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
          <TextField label="State" select value={state} onChange={(e) => setState(e.target.value)} SelectProps={{ native: true }} fullWidth>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} -- {s.name}
              </option>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField label="ZIP5" value={zip5} onChange={(e) => setZip5(e.target.value)} />
            <TextField label="ZIP+4" value={zip4} onChange={(e) => setZip4(e.target.value)} />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Standardized result
        </Typography>
        <Alert severity={result.pub28Compliant ? 'success' : 'error'} sx={{ mb: 2 }}>
          {result.pub28Compliant ? 'Publication 28 compliant' : 'Not Publication 28 compliant'}
        </Alert>
        <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          {result.formatted}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Rules fired
        </Typography>
        {result.issues.length === 0 ? (
          <Typography color="text.secondary">No issues.</Typography>
        ) : (
          <Stack spacing={1}>
            {result.issues.map((issue) => (
              <Stack key={issue.code} direction="row" spacing={1} alignItems="center">
                <Chip size="small" color={severityColor[issue.severity]} label={issue.severity} />
                <Typography variant="body2">
                  {issue.message} ({issue.reference})
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}
