import { ChartTableView } from '../components/ChartTableView'

export function WorkbenchPage() {
  return (
    <>
      {/* Mobile notice — shown below 768px */}
      <div
        className="mobile-only"
        style={{
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          gap: 16,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="20" height="14" rx="2" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="8" y1="21" x2="16" y2="21" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="18" x2="12" y2="21" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Best viewed on desktop
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 280,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}>
          The Workbench combines a D3 chart and a virtualised table across a wide layout.
          Open on a laptop for the full experience.
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hide-mobile" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ChartTableView />
      </div>
    </>
  )
}
