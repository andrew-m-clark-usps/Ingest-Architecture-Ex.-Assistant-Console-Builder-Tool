import { useState } from 'react'
import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { addLocation, requestAccess, type AccessRequest, type Location } from '../lib/bcgAccess'

// See ../../Console.md section 5 (Business Customer Gateway) and section
// 6.5 (the access model). This models the location/CRID/access pieces --
// not the full service menus and Manage Account UI, which are tracked in
// ROADMAP.md.
export function Gateway() {
  const [locations, setLocations] = useState<Location[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [address, setAddress] = useState('')

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Gateway
      </Typography>
      <Alert severity="info">A model of the Business Customer Gateway location and access model -- no real sign-in.</Alert>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Locations
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Button
            onClick={() => {
              if (!address.trim()) return
              setLocations((prev) => [...prev, addLocation(prev, { address })])
              setAddress('')
            }}
          >
            Add location (new CRID)
          </Button>
        </Stack>
        {locations.length === 0 ? (
          <Typography color="text.secondary">No locations added yet. Adding one without a supplied CRID always assigns a new one.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Location</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>CRID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.id}</TableCell>
                  <TableCell>{l.address}</TableCell>
                  <TableCell>{l.crid}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Service access requests
        </Typography>
        <Button
          disabled={locations.length === 0}
          onClick={() =>
            setRequests((prev) => [...prev, requestAccess(prev, { userId: `user-${prev.length + 1}`, service: 'EPS', locationId: locations[0].id })])
          }
        >
          Request EPS access at {locations[0]?.id ?? '(add a location first)'}
        </Button>
        {requests.length > 0 && (
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.service}</TableCell>
                  <TableCell>{r.locationId}</TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>{r.status} {r.status === 'Pending' && '(awaiting administration -- correct, not a bug)'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Stack>
  )
}
