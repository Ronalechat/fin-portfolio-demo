import { Link } from 'react-router-dom'
import { portfolioData, TOTAL_PORTFOLIO_VALUE } from '../data/generateData'

// Primitives highlighted per tool — honest summary of what each page demonstrates
const TOOLS = [
  {
    to: '/workbench',
    title: 'Portfolio Analytics Workbench',
    description:
      'Virtualised position table with expandable trade history, bidirectional D3 brush chart, and a per-trade detail panel. Built to handle 10,000+ rows without layout thrash.',
    primitives: [
      'd3.stack', 'd3.brushX', 'd3.scaleBand',
      'TanStack Virtual', 'TanStack Table', 'ResizeObserver',
    ],
    stat: `${portfolioData.length.toLocaleString()} positions`,
  },
  {
    to: '/gallery',
    title: 'Graph Gallery',
    description:
      'Six standalone D3+SVG exhibits, each targeting a different large-dataset technique: LTTB downsampling, candlestick overview+focus, density heatmaps, force simulation, crossfilter linked charts, and parallel coordinates.',
    primitives: [
      'd3.line', 'd3.area', 'd3.forceSimulation',
      'LTTB', 'd3.quadtree', 'SVG <defs>',
    ],
    stat: 'Up to 500k points',
  },
] as const

const fmtAUM = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(1)}M`

export function HomePage() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 'clamp(24px, 5vw, 48px) clamp(16px, 5vw, 64px)',
      maxWidth: 900,
      width: '100%',
    }}>
      {/* Title block */}
      <div style={{ marginBottom: 48 }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
          marginBottom: 10,
          fontWeight: 500,
        }}>
          Financial Visualisation Demo
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--text-1)',
          letterSpacing: '-0.02em',
          margin: '0 0 12px',
          lineHeight: 1.2,
        }}>
          D3 + SVG · TanStack Table + Virtual
        </h1>
        <p style={{
          fontSize: 12,
          color: 'var(--text-2)',
          lineHeight: 1.7,
          margin: 0,
          maxWidth: 520,
        }}>
          Two standalone tools demonstrating production-grade data visualisation:
          a portfolio workbench showing table↔chart integration, and a graph gallery
          showing D3+SVG techniques for 100k–500k record datasets.
        </p>
        <div style={{
          marginTop: 16,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: 'var(--text-2)',
          letterSpacing: '-0.01em',
        }}>
          AUM {fmtAUM(TOTAL_PORTFOLIO_VALUE)} · {portfolioData.length.toLocaleString()} synthetic positions
        </div>
      </div>

      {/* Tool cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {TOOLS.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              padding: '20px 24px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = 'var(--accent)'
              el.style.background = 'rgba(196,127,0,0.04)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement
              el.style.borderColor = 'var(--border)'
              el.style.background = 'var(--surface)'
            }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-1)',
                  letterSpacing: '-0.01em',
                }}>
                  {tool.title}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: 'var(--text-2)',
                  letterSpacing: '-0.01em',
                  flexShrink: 0,
                  marginLeft: 16,
                }}>
                  {tool.stat}
                </span>
              </div>

              <p style={{
                fontSize: 11,
                color: 'var(--text-2)',
                lineHeight: 1.6,
                margin: '0 0 14px',
              }}>
                {tool.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tool.primitives.map((p) => (
                    <span key={p} style={{
                      fontSize: 9,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: 'var(--accent)',
                      background: 'rgba(196,127,0,0.08)',
                      border: '1px solid rgba(196,127,0,0.2)',
                      borderRadius: 2,
                      padding: '1px 5px',
                      letterSpacing: '0.01em',
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0 }}>→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
