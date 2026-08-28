import { Alert, Typography } from '@mui/material'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 4, section 1:
// internal-use notice, not a login gate (no backend, no auth).
export function Hub() {
  return (
    <>
      <Typography variant="h4" gutterBottom>
        Hub
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Internal use only. This console has no backend and no authentication
        of its own -- see ../Console.md section 4.
      </Alert>
      <Typography color="text.secondary">
        Demo scaffold: the first-hour checklist, the in-page setup guide, the
        link directory, and the end-to-end workflow tabs are not implemented
        yet.
      </Typography>
    </>
  )
}
