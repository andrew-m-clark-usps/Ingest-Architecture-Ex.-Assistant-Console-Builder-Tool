import { Link } from 'react-router-dom'
import { Alert, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material'

// See ../../Console.md section 4 item 1 (first-hour checklist) and
// section 1 (internal-use notice, not a login gate -- no backend, no auth).
const FIRST_HOUR_CHECKLIST = [
  { label: 'Read the Reference page for the verified link directory and return-code glossary', to: '/reference' },
  { label: 'Load sample data on the Payment ledger page to see the total-position trend', to: '/ledger' },
  { label: 'Try the Address validator with a multi-designator address (e.g. "456 Main St Bldg 14 Ste 2200")', to: '/validator' },
  { label: 'Review the Change-of-address workbench return-code audit rules', to: '/change-of-address' },
  { label: 'Add a location on the Gateway page and see the duplicate-CRID behavior', to: '/gateway' },
  { label: 'Load sample data on Usage & reporting to see the projected invoice', to: '/usage' },
]

const WORKFLOW_STEPS = [
  'Sign up at the Business Customer Gateway (modeled only -- no real credentials)',
  'Add a business location and receive a CRID',
  'Request access to a service at that location',
  'Load or upload address/usage/ledger data',
  'Standardize and validate addresses against Publication 28',
  'Review the payment ledger and usage-metering dashboard',
  'Audit change-of-address returns for issues',
  'Export a printable report',
]

export function Hub() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Hub
      </Typography>
      <Alert severity="info">Internal use only. This console has no backend and no authentication of its own.</Alert>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          First-hour checklist
        </Typography>
        <List dense>
          {FIRST_HOUR_CHECKLIST.map((item, i) => (
            <ListItem key={item.to} component={Link} to={item.to}>
              <ListItemText primary={`${i + 1}. ${item.label}`} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          End-to-end workflow
        </Typography>
        <List dense>
          {WORKFLOW_STEPS.map((step, i) => (
            <ListItem key={step}>
              <ListItemText primary={`${i + 1}. ${step}`} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Stack>
  )
}
