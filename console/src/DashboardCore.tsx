import React, { useState } from 'react'
import { LayoutDashboard, ChevronRight, Activity, Layers, Sparkles } from 'lucide-react'

// From Exec-Assistant.md Appendix A2 -- a separate product, its own
// directory, stack, and build. Does not import assets/night.css, and
// nothing under assets/, ui-real/, or ncoa/ imports this.

export const DashboardCore: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'logs'>('analytics')

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased flex">
      <aside className="w-64 bg-white border-r border-slate-200/60 p-5 flex-col justify-between hidden md:flex">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="h-6 w-6 rounded bg-slate-950 flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Helix Core v4.1</span>
          </div>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              aria-current={activeTab === 'analytics' ? 'page' : undefined}
              data-testid="nav-analytics"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 ${
                activeTab === 'analytics'
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="h-3.5 w-3.5" /> Analytics Console
              </span>
              <ChevronRight className="h-3 w-3 opacity-60" />
            </button>
          </nav>
        </div>
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm" />
          <div>
            <p className="text-xs font-medium text-slate-800">Operational Node</p>
            <p className="text-[10px] text-slate-400 font-mono">node_0x992a.live</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA]">
        <header className="h-14 bg-white border-b border-slate-200/60 px-8 flex items-center justify-between">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Environments</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-900 font-semibold">Production Cloud Cluster</span>
          </nav>
          <button
            type="button"
            data-testid="global-sync-btn"
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 active:scale-[0.98] text-white text-xs font-medium rounded-lg shadow-sm transition-all duration-200 ease-out flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400 motion-safe:animate-pulse" />
            Force Global Synchronize
          </button>
        </header>

        <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { id: 'compute', label: 'Compute Allocation', value: '94.2%', rate: '+2.1%', desc: 'Current active vCPU cluster utility.' },
              { id: 'network', label: 'Network Throughput', value: '4.8 GB/s', rate: 'Optimal', desc: 'Ingress routing capacity threshold.' },
              { id: 'database', label: 'Database Mutation Frequency', value: '14,204/s', rate: '+12.4%', desc: 'Strict read/write operation tracking.' },
            ].map((stat) => (
              <div
                key={stat.id}
                data-testid={`metric-card-${stat.id}`}
                className="bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/60 p-5 rounded-xl shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</span>
                  <span
                    data-testid={`metric-rate-${stat.id}`}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      stat.rate.startsWith('+')
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {stat.rate}
                  </span>
                </div>
                <h3
                  data-testid={`metric-value-${stat.id}`}
                  className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums"
                >
                  {stat.value}
                </h3>
                <p className="text-xs text-slate-500 leading-normal">{stat.desc}</p>
              </div>
            ))}
          </div>

          <section
            id="stream-feature-injection-zone"
            data-testid="injection-container-root"
            className="bg-white border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]"
          >
            <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-800">Dynamic Feature Ingestion Hub</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Drop markdown patches into the stream workflow to integrate features inside this container.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
