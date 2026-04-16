import './index.css'
import { ChartTableView } from './components/ChartTableView'

function App() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: 40,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="1"
                y="8"
                width="3"
                height="7"
                fill="var(--accent)"
                rx="0.5"
              />
              <rect
                x="6"
                y="5"
                width="3"
                height="10"
                fill="var(--accent)"
                opacity="0.7"
                rx="0.5"
              />
              <rect
                x="11"
                y="1"
                width="3"
                height="14"
                fill="var(--accent)"
                opacity="0.4"
                rx="0.5"
              />
            </svg>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-1)',
                letterSpacing: '-0.01em',
              }}
            >
              Portfolio Dashboard
            </span>
          </div>

          <span
            style={{
              fontSize: 10,
              color: 'var(--text-2)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '1px 6px',
              letterSpacing: '0.04em',
            }}
          >
            DEMO
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 10,
            color: 'var(--text-2)',
            letterSpacing: '0.04em',
            fontFamily: 'ui-sans-serif, system-ui',
          }}
        >
          <span>500 positions</span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--positive)',
                display: 'inline-block',
              }}
            />
            Live
          </span>
        </div>
      </header>

      <ChartTableView />
    </div>
  )
}

export default App
