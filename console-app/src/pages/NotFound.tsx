import { Typography } from '@mui/material'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 4: the catch-all is not
// optional, since nginx try_files hands every unmatched URL to index.html.
export function NotFound() {
  return <Typography variant="h4">Page not found</Typography>
}
