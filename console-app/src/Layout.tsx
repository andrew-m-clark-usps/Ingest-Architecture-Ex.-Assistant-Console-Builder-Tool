import type { ReactNode } from 'react'
import { Box, Drawer, List, ListItemButton, ListItemText, Toolbar, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

// DEMO/REFERENCE SCAFFOLD -- ../Console.md section 4/7: a sidebar over the
// ten sections, mounted once. Not the full nav (no active-route highlight,
// no collapse behavior yet).
const DRAWER_WIDTH = 220

const SECTIONS = [
  { path: '/', label: 'Hub' },
  { path: '/gateway', label: 'Gateway' },
  { path: '/usage', label: 'Usage & reporting' },
  { path: '/ledger', label: 'Payment ledger' },
  { path: '/change-of-address', label: 'Change-of-address' },
  { path: '/validator', label: 'Address validator' },
  { path: '/reports', label: 'Reports' },
  { path: '/data-sources', label: 'Data sources' },
  { path: '/paf-licensing', label: 'PAF & licensing' },
  { path: '/reference', label: 'Reference' },
]

export function Layout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        <Toolbar>
          <Typography variant="subtitle1" noWrap>
            Addressing Console
          </Typography>
        </Toolbar>
        <List>
          {SECTIONS.map((s) => (
            <ListItemButton key={s.path} component={Link} to={s.path}>
              <ListItemText primary={s.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  )
}
