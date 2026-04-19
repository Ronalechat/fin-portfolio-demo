// Shared number and date formatters used across DataTable, SubTable, and TradeDetailPanel.
// Centralised here so the locale and precision options stay consistent.

export const fmtDollar = (n: number, sign = false): string =>
  (sign && n >= 0 ? '+' : '') +
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Compact date for table cells — "12 Jan '25"
export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })

// Full date with weekday for detail panels — "Mon, 12 Jan 2025"
export const fmtDateFull = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

// K/M shorthand for market values
export const fmtK = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : `${(n / 1_000).toFixed(1)}K`
