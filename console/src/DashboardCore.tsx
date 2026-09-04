import React, { useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  ChevronRight,
  Disc3,
  LayoutDashboard,
  Layers,
  ListMusic,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react'

const shell = {
  bg: '#0d1017',
  panel: '#151a24',
  panelStrong: '#1b2230',
  panelSoft: '#111620',
  text: '#eff6ff',
  muted: '#9baccc',
  cyan: '#78d4ff',
  mint: '#79efb5',
  blue: '#526dff',
  border: 'rgba(129, 170, 255, 0.18)',
  glow: '0 12px 28px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const queue = [
  'Analytics Console',
  'Routing Queue',
  'Charge Peaks',
  'Evidence Browser',
  'Patch Stream',
]

const spectrum = [82, 58, 91, 66, 48, 88, 60, 74]
const controlIcons = [
  { name: 'volume', Icon: Volume2, color: shell.cyan },
  { name: 'radio', Icon: Radio, color: shell.mint },
  { name: 'disc', Icon: Disc3, color: shell.cyan },
  { name: 'sliders', Icon: SlidersHorizontal, color: shell.mint },
]

const analyticsStats = [
  { id: 'compute', label: 'Compute Allocation', value: '94.2%', rate: '+2.1%', desc: 'Current active vCPU cluster utility.' },
  { id: 'network', label: 'Network Throughput', value: '4.8 GB/s', rate: 'Optimal', desc: 'Ingress routing capacity threshold.' },
  { id: 'database', label: 'Database Mutation Frequency', value: '14,204/s', rate: '+12.4%', desc: 'Strict read/write operation tracking.' },
]

const eventEntries = [
  { id: 'evt-201', time: '11:42:18', severity: 'sync', title: 'Replication queue normalized', detail: 'North cluster reconciled 42 pending route updates.' },
  { id: 'evt-202', time: '11:39:04', severity: 'warn', title: 'Ledger drift detected', detail: 'One pending transaction remains outside the settled balance set.' },
  { id: 'evt-203', time: '11:33:51', severity: 'info', title: 'Gateway probe passed', detail: 'All CRID add-location checks returned healthy response shapes.' },
]

const severityColors: Record<string, string> = {
  sync: shell.mint,
  warn: '#ffd36e',
  info: shell.cyan,
}

export const DashboardCore: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'logs'>('analytics')
  const [viewportWidth, setViewportWidth] = useState<number>(() => window.innerWidth)

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isMobile = viewportWidth < 900
  const isCompact = viewportWidth < 1280
  const shellColumns = isMobile ? '1fr' : isCompact ? '280px minmax(0, 1fr)' : '280px minmax(0, 1fr) 260px'
  const metricColumns = isMobile ? '1fr' : viewportWidth < 1180 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))'
  const showAnalytics = activeTab === 'analytics'

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(120,212,255,0.14), transparent 18%), linear-gradient(180deg, #192131 0%, #0d1017 62%)',
        color: shell.text,
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        padding: '12px',
      }}
    >
      <div
        style={{
          minHeight: 'calc(100vh - 24px)',
          display: 'grid',
          gridTemplateColumns: shellColumns,
          gap: '12px',
          padding: '12px',
          borderRadius: '18px',
          background: 'linear-gradient(180deg, rgba(25,33,49,0.94) 0%, rgba(10,13,20,0.98) 100%)',
          border: `1px solid ${shell.border}`,
          boxShadow: shell.glow,
        }}
      >
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
            order: 1,
          }}
        >
          <section
            style={{
              borderRadius: '14px',
              padding: '14px',
              background: 'linear-gradient(180deg, rgba(181,216,255,0.22) 0%, rgba(27,34,48,0.95) 18%, rgba(18,22,31,0.98) 100%)',
              border: `1px solid ${shell.border}`,
              boxShadow: shell.glow,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'linear-gradient(180deg, #7fd6ff 0%, #516cff 100%)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Layers size={16} color="#07111f" />
                </div>
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.24em', color: shell.muted }}>Navigator deck</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Helixamp Console
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['-', '+', 'x'].map((token) => (
                  <div
                    key={token}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '10px',
                      color: '#09101a',
                      background: 'linear-gradient(180deg, #c7ecff 0%, #79d6ff 100%)',
                    }}
                  >
                    {token}
                  </div>
                ))}
              </div>
            </div>
            <nav style={{ display: 'grid', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              aria-current={activeTab === 'analytics' ? 'page' : undefined}
              data-testid="nav-analytics"
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${shell.border}`,
                background: activeTab === 'analytics' ? 'rgba(120,212,255,0.14)' : 'rgba(255,255,255,0.03)',
                color: shell.text,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                <LayoutDashboard size={14} /> Analytics Console
              </span>
              <ChevronRight size={12} color={shell.cyan} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              aria-current={activeTab === 'logs' ? 'page' : undefined}
              data-testid="nav-logs"
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${shell.border}`,
                background: activeTab === 'logs' ? 'rgba(121,239,181,0.14)' : 'rgba(255,255,255,0.03)',
                color: shell.text,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700 }}>
                <ListMusic size={14} /> Event Browser
              </span>
              <ChevronRight size={12} color={shell.mint} />
            </button>
          </nav>
          </section>

          <section
            style={{
              borderRadius: '14px',
              padding: '14px',
              background: shell.panelSoft,
              border: `1px solid ${shell.border}`,
              boxShadow: shell.glow,
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: shell.muted, marginBottom: '10px' }}>Section queue</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {queue.map((item, index) => (
                <div
                  key={item}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: index === 0 ? 'rgba(120,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${shell.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px' }}>{item}</span>
                  <span style={{ fontSize: '10px', letterSpacing: '0.18em', color: shell.muted }}>
                    0{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px', order: 2 }}>
          <header
            style={{
              minHeight: '62px',
              borderRadius: '14px',
              padding: '14px 16px',
              background: 'linear-gradient(180deg, rgba(183,215,255,0.24) 0%, rgba(24,31,43,0.96) 22%, rgba(14,18,27,0.98) 100%)',
              border: `1px solid ${shell.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: shell.glow,
            }}
          >
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: shell.muted, minWidth: 0, flexWrap: 'wrap' }}>
            <span>Environments</span>
            <ChevronRight size={12} />
            <span style={{ color: shell.text, fontWeight: 700 }}>Production Cloud Cluster</span>
          </nav>
          <button
            type="button"
            data-testid="global-sync-btn"
            style={{
              padding: '10px 14px',
              background: 'linear-gradient(180deg, #80dcff 0%, #4f6cff 100%)',
              color: '#07111f',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              borderRadius: '10px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Activity size={14} color="#072126" />
            Force Global Synchronize
          </button>
          </header>

          <section
            style={{
              borderRadius: '14px',
              padding: '16px',
              background: shell.panel,
              border: `1px solid ${shell.border}`,
              boxShadow: shell.glow,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: shell.muted }}>
                  Main Browser
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {showAnalytics ? 'Analytics Console' : 'Event Browser'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {controlIcons.map(({ name, Icon, color }) => (
                  <div
                    key={name}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      display: 'grid',
                      placeItems: 'center',
                      border: `1px solid ${shell.border}`,
                      background: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Icon size={16} color={color} />
                  </div>
                ))}
              </div>
            </div>

            {showAnalytics ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: metricColumns, gap: '14px', marginBottom: '16px' }}>
                  {analyticsStats.map((stat) => (
                    <div
                      key={stat.id}
                      data-testid={`metric-card-${stat.id}`}
                      style={{
                        background: 'linear-gradient(180deg, rgba(189,221,255,0.14) 0%, rgba(21,27,39,0.96) 18%, rgba(12,16,24,0.98) 100%)',
                        border: `1px solid ${shell.border}`,
                        padding: '14px',
                        borderRadius: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: shell.muted }}>{stat.label}</span>
                        <span
                          data-testid={`metric-rate-${stat.id}`}
                          style={{
                            fontSize: '10px',
                            padding: '4px 6px',
                            borderRadius: '999px',
                            border: `1px solid ${stat.rate.startsWith('+') ? 'rgba(121,239,181,0.3)' : shell.border}`,
                            color: stat.rate.startsWith('+') ? shell.mint : shell.cyan,
                            background: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          {stat.rate}
                        </span>
                      </div>
                      <h3
                        data-testid={`metric-value-${stat.id}`}
                        style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '0.03em', color: shell.text, margin: '10px 0 6px' }}
                      >
                        {stat.value}
                      </h3>
                      <p style={{ fontSize: '12px', color: shell.muted, lineHeight: 1.5, margin: 0 }}>{stat.desc}</p>
                    </div>
                  ))}
                </div>

                <section
                  id="stream-feature-injection-zone"
                  data-testid="injection-container-root"
                  style={{
                    minHeight: '240px',
                    borderRadius: '14px',
                    padding: '24px',
                    border: '1px dashed rgba(121,214,255,0.42)',
                    background: 'linear-gradient(180deg, rgba(13,18,28,0.96) 0%, rgba(9,12,18,0.98) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${shell.border}`,
                    }}
                  >
                    <Sparkles size={18} color={shell.cyan} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', margin: 0 }}>
                      Dynamic Feature Ingestion Hub
                    </h4>
                    <p style={{ fontSize: '12px', color: shell.muted, maxWidth: '280px', margin: '8px auto 0' }}>
                      Drop markdown patches into the stream workflow to integrate features inside this container.
                    </p>
                  </div>
                </section>
              </>
            ) : (
              <section
                data-testid="event-browser-root"
                style={{
                  display: 'grid',
                  gap: '12px',
                }}
              >
                {eventEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      borderRadius: '12px',
                      padding: '14px',
                      border: `1px solid ${shell.border}`,
                      background: 'linear-gradient(180deg, rgba(189,221,255,0.08) 0%, rgba(18,24,35,0.98) 24%, rgba(12,16,24,0.98) 100%)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: shell.muted }}>{entry.time}</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: shell.text }}>{entry.title}</div>
                      </div>
                      <div
                        style={{
                          padding: '4px 8px',
                          borderRadius: '999px',
                          border: `1px solid ${severityColors[entry.severity]}`,
                          color: severityColors[entry.severity],
                          fontSize: '10px',
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {entry.severity}
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: shell.muted, lineHeight: 1.5, margin: 0 }}>{entry.detail}</p>
                  </div>
                ))}
              </section>
            )}
          </section>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, order: isCompact ? 3 : 3, gridColumn: isMobile ? '1 / -1' : undefined }}>
          <section
            style={{
              borderRadius: '14px',
              padding: '14px',
              background: shell.panelStrong,
              border: `1px solid ${shell.border}`,
              boxShadow: shell.glow,
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: shell.muted, marginBottom: '12px' }}>
              Spectrum
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: '6px', minHeight: '150px' }}>
              {spectrum.map((value, index) => (
                <div key={index} style={{ flex: 1, display: 'flex', alignItems: 'end' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${value}%`,
                      minHeight: '16px',
                      borderRadius: '999px',
                      background: 'linear-gradient(180deg, #79efb5 0%, #78d4ff 58%, #526dff 100%)',
                      boxShadow: '0 0 14px rgba(120,212,255,0.18)',
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              borderRadius: '14px',
              padding: '14px',
              background: shell.panelSoft,
              border: `1px solid ${shell.border}`,
              boxShadow: shell.glow,
            }}
          >
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.22em', color: shell.muted, marginBottom: '12px' }}>
              Browser Queue
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                { label: 'Index Delta', icon: <BarChart3 size={14} color={shell.cyan} /> },
                { label: 'Event Relay', icon: <Activity size={14} color={shell.mint} /> },
                { label: 'Routing Bus', icon: <Radio size={14} color={shell.cyan} /> },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${shell.border}`,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    {item.icon}
                    {item.label}
                  </span>
                  <span style={{ fontSize: '10px', letterSpacing: '0.16em', color: shell.muted }}>LIVE</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
