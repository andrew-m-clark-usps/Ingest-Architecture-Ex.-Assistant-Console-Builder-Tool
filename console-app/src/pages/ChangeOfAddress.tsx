import { useMemo, useState } from 'react'
import { Alert, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { auditChangeOfAddressRecord } from '../lib/changeOfAddressAudit'
import { RETURN_CODES } from '../lib/referenceData'
import { SAMPLE_CHANGE_OF_ADDRESS_RECORDS } from '../lib/sampleData'

// See ../../Console.md section 6.2 (change-of-address return-code audit).
// An unrecognized return code still renders a row rather than throwing.

export function ChangeOfAddress() {
  const [loaded, setLoaded] = useState(false)
  const records = loaded ? SAMPLE_CHANGE_OF_ADDRESS_RECORDS : []
  const findingsByRecord = useMemo(
    () => new Map(records.map((r) => [r.id, auditChangeOfAddressRecord(r, RETURN_CODES)])),
    [records],
  )
  const matchedCount = records.filter((r) => RETURN_CODES.find((c) => c.code === r.returnCode)?.matched).length
  const issueCount = [...findingsByRecord.values()].reduce((sum, f) => sum + f.length, 0)

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Change-of-address workbench
      </Typography>

      {!loaded ? (
        <Alert severity="info" action={<Button onClick={() => setLoaded(true)}>Load sample data</Button>}>
          No change-of-address records loaded yet.
        </Alert>
      ) : (
        <>
          <Stack direction="row" spacing={2}>
            <Chip label={`${records.length} records`} />
            <Chip label={`${matchedCount} matched`} color="success" />
            <Chip label={`${issueCount} audit finding(s)`} color={issueCount > 0 ? 'warning' : 'default'} />
          </Stack>

          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Input address</TableCell>
                    <TableCell>New address</TableCell>
                    <TableCell>Return code</TableCell>
                    <TableCell>Findings</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((r) => {
                    const findings = findingsByRecord.get(r.id) ?? []
                    const def = RETURN_CODES.find((c) => c.code === r.returnCode)
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.firstName} {r.lastName}
                        </TableCell>
                        <TableCell>
                          {r.inputAddress}, {r.inputCity} {r.inputState} {r.inputZip}
                        </TableCell>
                        <TableCell>{r.newAddress ? `${r.newAddress}, ${r.newCity ?? ''} ${r.newState ?? ''}` : '--'}</TableCell>
                        <TableCell>{def ? `${def.code} -- ${def.label}` : `${r.returnCode} (unrecognized)`}</TableCell>
                        <TableCell>
                          {findings.length === 0 ? (
                            <Chip size="small" label="clean" color="success" />
                          ) : (
                            <Stack spacing={0.5}>
                              {findings.map((f) => (
                                <Chip key={f.code} size="small" color={f.severity === 'error' ? 'error' : 'warning'} label={f.message} />
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Stack>
  )
}
