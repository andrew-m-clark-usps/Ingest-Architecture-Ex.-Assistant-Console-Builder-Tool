import { createTheme } from '@mui/material/styles'

// DEMO/REFERENCE SCAFFOLD -- one createTheme call is the design system, per
// ../Console.md section 3. Dark only (section 1 hard constraint).
export const theme = createTheme({
  palette: {
    mode: 'dark',
  },
  typography: {
    fontSize: 14,
  },
  shape: {
    borderRadius: 6,
  },
})
