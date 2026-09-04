import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#79d6ff',
    },
    secondary: {
      main: '#7df0b8',
    },
    background: {
      default: '#090b12',
      paper: '#141926',
    },
    text: {
      primary: '#edf4ff',
      secondary: '#8ea0c5',
    },
  },
  typography: {
    fontFamily: '"Trebuchet MS", Verdana, sans-serif',
    fontSize: 13,
    h4: {
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    },
    subtitle2: {
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontSize: '0.68rem',
    },
    body2: {
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          overflowX: 'clip',
          backgroundColor: '#090b12',
          backgroundImage:
            'radial-gradient(circle at top, rgba(121,214,255,0.16), transparent 32%), linear-gradient(180deg, #15192a 0%, #090b12 55%)',
        },
        body: {
          overflowX: 'clip',
          minWidth: 0,
          backgroundColor: '#090b12',
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(89,255,199,0.08), transparent 18%), repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 26px)',
        },
        '*': {
          boxSizing: 'border-box',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 14%, rgba(5,7,14,0.2) 100%)',
          border: '1px solid rgba(144, 182, 255, 0.18)',
          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
})
