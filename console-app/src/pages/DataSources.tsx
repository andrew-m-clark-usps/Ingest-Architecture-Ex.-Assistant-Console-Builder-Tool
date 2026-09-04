import { useState } from 'react'
import { Alert, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'

// See ../../Console.md section 4 item 8 (data sources, the ingest log).
// A minimal dependency-free CSV parser -- no papaparse, so this stays
// zero-runtime-dependency-risk for a demo scaffold. Every row's outcome is
// shown, not just a success count.

interface IngestedRow {
  line: number
  accepted: boolean
  reason?: string
  values: string[]
}

function parseCsv(text: string): IngestedRow[] {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const headerCount = lines[0].split(',').length
  return lines.slice(1).map((line, i) => {
    const values = line.split(',')
    if (values.length !== headerCount) {
      return { line: i + 2, accepted: false, reason: `expected ${headerCount} columns, found ${values.length}`, values }
    }
    return { line: i + 2, accepted: true, values }
  })
}

export function DataSources() {
  const [rows, setRows] = useState<IngestedRow[] | undefined>(undefined)
  const [fileName, setFileName] = useState<string | undefined>(undefined)

  async function handleFile(file: File): Promise<void> {
    const text = await file.text()
    setFileName(file.name)
    setRows(parseCsv(text))
  }

  const accepted = rows?.filter((r) => r.accepted).length ?? 0
  const rejected = rows?.filter((r) => !r.accepted).length ?? 0

  return (
    <Stack spacing={3}>
      <Typography variant="h4" gutterBottom>
        Data sources
      </Typography>
      <Typography color="text.secondary">
        Files are read entirely in this tab (the File API) -- nothing is uploaded
        anywhere. This demo ingest only validates column count per row; it does not
        feed the other pages in this build.
      </Typography>

      <Paper
        sx={{ p: 4, border: '2px dashed', borderColor: 'divider', textAlign: 'center' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) void handleFile(file)
        }}
      >
        <Typography gutterBottom>Drag a CSV file here, or:</Typography>
        <Button component="label">
          Choose file
          <input
            hidden
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
        </Button>
      </Paper>

      {rows && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Ingest log -- {fileName}
          </Typography>
          <Alert severity={rejected === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {rows.length} row(s) read, {accepted} accepted, {rejected} rejected.
          </Alert>
          {rejected > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows
                  .filter((r) => !r.accepted)
                  .map((r) => (
                    <TableRow key={r.line}>
                      <TableCell>{r.line}</TableCell>
                      <TableCell>{r.reason}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}
    </Stack>
  )
}
