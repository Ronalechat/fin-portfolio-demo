import './index.css'
import { Routes, Route, NavLink } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { WorkbenchPage } from './pages/WorkbenchPage'
import { GalleryPage } from './pages/GalleryPage'
import { TOTAL_PORTFOLIO_VALUE } from './data/generateData'

const aum =
  TOTAL_PORTFOLIO_VALUE >= 1e9
    ? `$${(TOTAL_PORTFOLIO_VALUE / 1e9).toFixed(2)}B`
    : `$${(TOTAL_PORTFOLIO_VALUE / 1e6).toFixed(1)}M`

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/workbench', label: 'Workbench', end: false },
  { to: '/gallery', label: 'Gallery', end: false },
] as const

function App() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        height: 40,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
        gap: 16,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="8" width="3" height="7" fill="var(--accent)" rx="0.5" />
            <rect x="6" y="5" width="3" height="10" fill="var(--accent)" opacity="0.7" rx="0.5" />
            <rect x="11" y="1" width="3" height="14" fill="var(--accent)" opacity="0.4" rx="0.5" />
          </svg>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-1)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            FinViz Demo
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-1)' : 'var(--text-2)',
                textDecoration: 'none',
                padding: '3px 10px',
                letterSpacing: '0.02em',
                borderBottom: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* AUM — honest metric replacing the fake "Live" status */}
        <div className="hide-mobile" style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 11,
          color: 'var(--text-2)',
          letterSpacing: '-0.02em',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          AUM {aum}
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
