import { useMemo, useState } from 'react'
import { Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { PARTY_TYPES, REFERENCE_URLS, RETURN_CODES } from '../lib/referenceData'

// See ../../Console.md section 8 (the verified USPS reference URL
// directory) and section 6.6 (party types). This ships a representative
// data-driven subset -- see referenceData.ts for the full list format and
// ROADMAP.md for widening it to all 69 verified URLs.
export function Reference() {
  const [query, setQuery] = useState('')
  const filteredUrls = useMemo(
    () => REFERENCE_URLS.filter((u) => `${u.label} ${u.group} ${u.purpose}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  )

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Reference
      </Typography>
      <Typography color="text.secondary">
        No USPS API is called from this browser-only console -- every table below is
        bundled static data, verified against the source documents it models.
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Verified link directory
        </Typography>
        <TextField size="small" label="Search" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ mb: 2 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Purpose</TableCell>
                <TableCell>Access</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUrls.map((u) => (
                <TableRow key={u.url}>
                  <TableCell>{u.group}</TableCell>
                  <TableCell>
                    <a href={u.url} target="_blank" rel="noreferrer">
                      {u.label}
                    </a>
                  </TableCell>
                  <TableCell>{u.purpose}</TableCell>
                  <TableCell>{u.access}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Change-of-address return codes
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {RETURN_CODES.map((r) => (
                <TableRow key={r.code}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.label}</TableCell>
                  <TableCell>{r.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Tracking usage party types
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Party type</TableCell>
                <TableCell>Billable</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PARTY_TYPES.map((p) => (
                <TableRow key={p.type}>
                  <TableCell>{p.type}</TableCell>
                  <TableCell>{p.billable ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  )
}
