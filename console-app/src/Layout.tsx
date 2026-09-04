import type { ReactNode } from 'react'
import {
  Box,
  Drawer,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import EqualizerRoundedIcon from '@mui/icons-material/EqualizerRounded'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import ViewCompactRoundedIcon from '@mui/icons-material/ViewCompactRounded'
import { Link, useLocation } from 'react-router-dom'

const DRAWER_WIDTH = 264

const SECTIONS = [
  { path: '/', label: 'Hub', code: 'HUB', meter: 88 },
  { path: '/gateway', label: 'Gateway', code: 'GWY', meter: 64 },
  { path: '/usage', label: 'Usage & reporting', code: 'USG', meter: 74 },
  { path: '/ledger', label: 'Payment ledger', code: 'LDG', meter: 59 },
  { path: '/change-of-address', label: 'Change-of-address', code: 'COA', meter: 68 },
  { path: '/validator', label: 'Address validator', code: 'VAL', meter: 92 },
  { path: '/reports', label: 'Reports', code: 'RPT', meter: 54 },
  { path: '/data-sources', label: 'Data sources', code: 'SRC', meter: 47 },
  { path: '/paf-licensing', label: 'PAF & licensing', code: 'PAF', meter: 61 },
  { path: '/reference', label: 'Reference', code: 'REF', meter: 36 },
]

const TRANSPORT_BUTTONS = [
  { label: 'Play', icon: <PlayArrowRoundedIcon fontSize="small" /> },
  { label: 'Mix', icon: <EqualizerRoundedIcon fontSize="small" /> },
  { label: 'EQ', icon: <GraphicEqRoundedIcon fontSize="small" /> },
  { label: 'Tune', icon: <TuneRoundedIcon fontSize="small" /> },
]

const SIGNAL_BARS = [66, 82, 48, 91, 59, 76]

function panelChrome(title: string, eyebrow: string) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          {eyebrow}
        </Typography>
        <Typography component="div" variant="h6" sx={{ fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.75}>
        {['-', '+', 'x'].map((token) => (
          <Box
            key={token}
            sx={{
              width: 18,
              height: 18,
              display: 'grid',
              placeItems: 'center',
              fontSize: '0.65rem',
              color: '#09101a',
              borderRadius: '4px',
              background: 'linear-gradient(180deg, #b8e4ff 0%, #79d6ff 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
            }}
          >
            {token}
          </Box>
        ))}
      </Stack>
    </Stack>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const active = SECTIONS.find((section) => section.path === location.pathname) ?? SECTIONS[0]

  return (
    <Box sx={{ minHeight: '100vh', px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 2 } }}>
      <Paper
        sx={{
          minHeight: 'calc(100vh - 16px)',
          overflow: 'hidden',
          borderRadius: 3,
          background: 'linear-gradient(180deg, rgba(18,23,38,0.96) 0%, rgba(10,13,22,0.98) 100%)',
        }}
      >
        <Toolbar
          sx={{
            minHeight: '64px !important',
            px: { xs: 1.5, md: 2.5 },
            borderBottom: '1px solid rgba(121,214,255,0.18)',
            background:
              'linear-gradient(180deg, rgba(175,208,255,0.28) 0%, rgba(58,78,112,0.72) 12%, rgba(18,23,38,0.98) 100%)',
            gap: 2,
          }}
        >
          <ViewCompactRoundedIcon sx={{ color: '#79d6ff' }} />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Addressing Console Transport
            </Typography>
            <Typography component="div" variant="h4" sx={{ fontSize: { xs: '0.95rem', md: '1.1rem' }, overflowWrap: 'anywhere' }}>
              {active.label}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {TRANSPORT_BUTTONS.map((button) => (
              <Paper
                key={button.label}
                sx={{
                  px: 1.25,
                  py: 0.75,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(12,17,28,0.9)',
                }}
              >
                {button.icon}
                <Typography variant="caption" sx={{ letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  {button.label}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Toolbar>

        <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 80px)' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: { xs: 0, md: DRAWER_WIDTH },
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            position: 'relative',
            bgcolor: 'transparent',
            color: 'text.primary',
            borderRight: '1px solid rgba(121,214,255,0.18)',
            backgroundImage:
              'linear-gradient(180deg, rgba(13,18,31,0.92) 0%, rgba(7,10,18,0.98) 100%), radial-gradient(circle at top left, rgba(121,214,255,0.18), transparent 22%)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Paper sx={{ p: 1.75, mb: 2.25, bgcolor: 'rgba(10,14,25,0.84)' }}>
            {panelChrome('Main deck', 'Window A')}
            <Typography variant="body2" color="text.secondary">
              Dense route browser with per-section level meters and transport controls.
            </Typography>
          </Paper>
          <List sx={{ p: 0, display: 'grid', gap: 1 }}>
            {SECTIONS.map((section) => {
              const selected = section.path === active.path
              return (
                <Paper key={section.path} sx={{ overflow: 'hidden', bgcolor: selected ? 'rgba(19,34,54,0.96)' : 'rgba(10,14,25,0.78)' }}>
                  <ListItemButton
                    component={Link}
                    to={section.path}
                    selected={selected}
                    sx={{
                      display: 'block',
                      px: 1.5,
                      py: 1.15,
                      '&.Mui-selected': {
                        bgcolor: 'rgba(121,214,255,0.12)',
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <ListItemText
                        primary={section.label}
                        secondary={section.code}
                        slotProps={{
                          primary: { sx: { fontSize: '0.86rem', fontWeight: 700, lineHeight: 1.2 } },
                          secondary: { sx: { fontSize: '0.68rem', letterSpacing: '0.22em', textTransform: 'uppercase' } },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: selected ? '#79d6ff' : '#7df0b8' }}>
                        {section.meter}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={section.meter}
                      sx={{
                        height: 7,
                        borderRadius: 999,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #79d6ff 0%, #7df0b8 100%)',
                        },
                      }}
                    />
                  </ListItemButton>
                </Paper>
              )
            })}
          </List>
        </Box>
      </Drawer>

          <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 1.25, md: 2 } }}>
            <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' }, mb: 1.25 }}>
              <Paper sx={{ p: 1.25, bgcolor: 'rgba(10,14,25,0.88)' }}>
                {panelChrome('Quick deck', 'Mobile route browser')}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                  {SECTIONS.map((section) => (
                    <ListItemButton
                      key={section.path}
                      component={Link}
                      to={section.path}
                      selected={section.path === active.path}
                      sx={{
                        border: '1px solid rgba(121,214,255,0.14)',
                        bgcolor: section.path === active.path ? 'rgba(121,214,255,0.12)' : 'rgba(255,255,255,0.02)',
                        minWidth: 0,
                      }}
                    >
                      <ListItemText
                        primary={section.code}
                        secondary={section.label}
                        slotProps={{
                          primary: { sx: { fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase' } },
                          secondary: { sx: { fontSize: '0.7rem', whiteSpace: 'normal' } },
                        }}
                      />
                    </ListItemButton>
                  ))}
                </Box>
              </Paper>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 280px' },
                alignItems: 'start',
              }}
            >
              <Paper sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0, bgcolor: 'rgba(13,18,31,0.82)' }}>
                {panelChrome(active.label, 'Focused module')}
                {children}
              </Paper>

              <Stack spacing={2} sx={{ display: { xs: 'none', xl: 'flex' } }}>
                <Paper sx={{ p: 1.5, bgcolor: 'rgba(10,14,25,0.88)' }}>
                  {panelChrome('Equalizer', 'Signal lanes')}
                  <Stack direction="row" spacing={0.8} alignItems="end" sx={{ minHeight: 128 }}>
                    {SIGNAL_BARS.map((value, index) => (
                      <Box key={index} sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            height: `${value}%`,
                            minHeight: 12,
                            borderRadius: 99,
                            background: 'linear-gradient(180deg, #7df0b8 0%, #79d6ff 60%, #4562ff 100%)',
                            boxShadow: '0 0 14px rgba(121,214,255,0.22)',
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Paper>

                <Paper sx={{ p: 1.5, bgcolor: 'rgba(10,14,25,0.88)' }}>
                  {panelChrome('Playlist', 'Section queue')}
                  <Stack spacing={1}>
                    {SECTIONS.slice(0, 5).map((section, index) => (
                      <Stack
                        key={section.path}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{
                          px: 1,
                          py: 0.85,
                          borderRadius: 1,
                          bgcolor: index === 0 ? 'rgba(121,214,255,0.12)' : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        <Typography variant="body2">{section.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {section.code}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
