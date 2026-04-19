import { useRef, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { GalleryFrame } from '../GalleryFrame'
import { mulberry32 } from '../rng'

// ─── Constants ─────────────────────────────────────────────────────────────

const SEED = 7
const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 } as const

const SECTORS = [
  'Tech', 'Finance', 'Energy', 'Health', 'Consumer',
  'Utilities', 'Materials', 'Industrials', 'Real Estate', 'Comms',
] as const

type Sector = typeof SECTORS[number]

const SECTOR_PREFIX: Record<Sector, string> = {
  'Tech': 'TECH',
  'Finance': 'FIN',
  'Energy': 'ENRG',
  'Health': 'HLTH',
  'Consumer': 'CONS',
  'Utilities': 'UTIL',
  'Materials': 'MATL',
  'Industrials': 'INDS',
  'Real Estate': 'REIT',
  'Comms': 'COMM',
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string
  sector: Sector
  marketCap: number
}

interface RawEdge {
  source: string
  target: string
  correlation: number
}

// After D3 forceLink resolves source/target strings into object references:
interface ResolvedEdge extends d3.SimulationLinkDatum<NetworkNode> {
  correlation: number
}

// ─── Tooltip state ─────────────────────────────────────────────────────────

interface NodeTooltipState {
  node: NetworkNode
  edgeCount: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function nodeRadius(node: NetworkNode): number {
  return Math.min(Math.sqrt(node.marketCap) * 2 + 4, 18)
}

// ─── Data generation ───────────────────────────────────────────────────────

function generateData(rng: () => number): { nodes: NetworkNode[]; edges: RawEdge[] } {
  const nodes: NetworkNode[] = []

  for (const sector of SECTORS) {
    for (let i = 1; i <= 5; i++) {
      nodes.push({
        id: `${SECTOR_PREFIX[sector]}${i}`,
        sector,
        marketCap: rng() * 10 + 1,
      })
    }
  }

  const edges: RawEdge[] = []

  // O(n²) over 50 nodes = 1225 pairs — fast enough to run synchronously.
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const na = nodes[a]
      const nb = nodes[b]
      const sameSector = na.sector === nb.sector

      const correlation = sameSector
        ? 0.5 + rng() * 0.4           // within-sector: high positive [0.5, 0.9]
        : (rng() - 0.5) * 0.6         // cross-sector: weak, can be negative [-0.3, 0.3]

      // Only keep edges that exceed the absolute minimum threshold (0.3).
      // The slider will further filter above this floor.
      if (Math.abs(correlation) > 0.3) {
        edges.push({ source: na.id, target: nb.id, correlation })
      }
    }
  }

  return { nodes, edges }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ForceNetwork() {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const linksGRef    = useRef<SVGGElement>(null)
  const nodesGRef    = useRef<SVGGElement>(null)
  const legendGRef   = useRef<SVGGElement>(null)

  const [innerW, setInnerW] = useState(760)
  const [innerH, setInnerH] = useState(420)
  const [threshold, setThreshold] = useState(0.3)
  const [tooltip, setTooltip] = useState<NodeTooltipState | null>(null)
  // selectedNodeId drives dimming — stored in React state so JSX tooltip rerenders.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Stable refs for mutable simulation objects. We must NOT store D3
  // simulation state in React state — the simulation fires ticks at 60fps and
  // going through React's reconciler would be catastrophically slow.
  const simRef = useRef<d3.Simulation<NetworkNode, ResolvedEdge> | null>(null)
  // We keep the node array stable across threshold changes because D3 mutates
  // x/y/vx/vy in-place. Recreating nodes loses position history.
  const stableNodesRef = useRef<NetworkNode[]>([])

  // ─── Data (generated once) ────────────────────────────────────────────────
  const { nodes: sourceNodes, edges } = useMemo(() => {
    const rng = mulberry32(SEED)
    return generateData(rng)
  }, [])

  const sectorColor = useMemo(
    () => d3.scaleOrdinal<string>(d3.schemeTableau10).domain(SECTORS as unknown as string[]),
    []
  )

  // ─── Filtered edges based on current threshold ────────────────────────────
  const filteredEdges = useMemo(
    () => edges.filter(e => Math.abs(e.correlation) >= threshold),
    [edges, threshold]
  )

  // ─── Build per-node edge count (for tooltip) ──────────────────────────────
  const edgeCountById = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of filteredEdges) {
      counts[e.source] = (counts[e.source] ?? 0) + 1
      counts[e.target] = (counts[e.target] ?? 0) + 1
    }
    return counts
  }, [filteredEdges])

  // ─── ResizeObserver ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      // Reserve ~40px at the bottom for the slider control strip
      setInnerW(rect.width  - MARGIN.left - MARGIN.right)
      setInnerH(rect.height - MARGIN.top  - MARGIN.bottom - 40)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── Legend ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = d3.select(legendGRef.current)
    g.selectAll('*').remove()

    const COL_W = 96
    const ROW_H = 16

    SECTORS.forEach((sector, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)

      const item = g.append('g')
        .attr('transform', `translate(${col * COL_W},${row * ROW_H})`)

      item.append('circle')
        .attr('r', 4)
        .attr('fill', sectorColor(sector))

      item.append('text')
        .attr('x', 10)
        .attr('dy', '0.35em')
        .attr('fill', 'var(--text-2)')
        .attr('font-size', 11)
        .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
        .text(sector)
    })
  }, [sectorColor])

  // ─── Force simulation ─────────────────────────────────────────────────────
  // This effect re-runs when filteredEdges or dimensions change. The node array
  // is kept stable in stableNodesRef so that position state survives threshold
  // changes — only the link set is rebuilt.
  useEffect(() => {
    const linksG = linksGRef.current
    const nodesG = nodesGRef.current
    if (!linksG || !nodesG) return

    // Initialise stable node array on first run (deep-copy to allow in-place mutation)
    if (stableNodesRef.current.length === 0) {
      stableNodesRef.current = sourceNodes.map(n => ({ ...n }))
    }
    const currentNodes = stableNodesRef.current

    // Build resolved edge objects for D3. forceLink replaces string ids with
    // object references in-place, so we give it fresh copies each time.
    const resolvedEdges: ResolvedEdge[] = filteredEdges.map(e => ({
      source: e.source,
      target: e.target,
      correlation: e.correlation,
    }))

    // ── Links ──
    const linkSel = d3.select(linksG)
      .selectAll<SVGLineElement, ResolvedEdge>('line')
      .data(resolvedEdges, d => {
        const s = typeof d.source === 'object' ? (d.source as NetworkNode).id : String(d.source)
        const t = typeof d.target === 'object' ? (d.target as NetworkNode).id : String(d.target)
        return `${s}--${t}`
      })
      .join('line')
      .attr('stroke', d => d.correlation > 0 ? 'var(--positive)' : 'var(--negative)')
      .attr('stroke-width', d => Math.abs(d.correlation) * 3)
      .attr('stroke-opacity', 0.4)

    // ── Nodes ──
    const nodeGroup = d3.select(nodesG)
      .selectAll<SVGGElement, NetworkNode>('g.node')
      .data(currentNodes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'node')
            .style('cursor', 'grab')

          g.append('circle')
            .attr('r', d => nodeRadius(d))
            .attr('fill', d => sectorColor(d.sector))
            .attr('stroke', 'var(--bg)')
            .attr('stroke-width', 1.5)

          // Labels only appear on large nodes — smaller nodes are too small to read
          g.filter(d => nodeRadius(d) > 10)
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .attr('font-size', 8)
            .attr('fill', 'var(--text-1)')
            .attr('pointer-events', 'none')
            .text(d => d.id)

          return g
        },
        update => update,
        exit => exit.remove()
      )

    // ── Hover: show tooltip, dim unrelated nodes ──
    // We use mouseenter/mouseleave rather than mouseover/mouseout to avoid
    // child-element re-fires (the text label inside the node group would fire
    // mouseover continuously during mouse movement).
    nodeGroup
      .on('mouseenter', (_event: MouseEvent, d: NetworkNode) => {
        // The tooltip position is derived from d.x/d.y (simulation coordinates)
        // in the JSX below, so we only need to store the node identity here.
        setTooltip({
          node: d,
          edgeCount: edgeCountById[d.id] ?? 0,
        })
        setSelectedNodeId(d.id)
      })
      .on('mouseleave', () => {
        setTooltip(null)
        setSelectedNodeId(null)
      })

    // ── Drag ──
    // dragstart pins the node by setting fx/fy. We reheat the sim so the
    // surrounding nodes respond. dragend intentionally leaves the pin — this is
    // a user affordance: you pin a node to examine its neighbourhood.
    const drag = d3.drag<SVGGElement, NetworkNode>()
      .on('start', (event, d) => {
        d.fx = d.x
        d.fy = d.y
        simRef.current?.alpha(0.3).restart()
        d3.select<SVGGElement, NetworkNode>(event.sourceEvent.target.parentNode as SVGGElement)
          .style('cursor', 'grabbing')
      })
      .on('drag', (event, d) => {
        const r = nodeRadius(d)
        d.fx = Math.max(r, Math.min(innerW - r, event.x))
        d.fy = Math.max(r, Math.min(innerH - r, event.y))
      })
      .on('end', (event) => {
        d3.select<SVGGElement, NetworkNode>(event.sourceEvent.target.parentNode as SVGGElement)
          .style('cursor', 'grab')
      })

    nodeGroup.call(drag)

    // Double-click releases the pin, returning the node to free simulation control
    nodeGroup.on('dblclick', (event: MouseEvent, d: NetworkNode) => {
      event.stopPropagation()
      d.fx = null
      d.fy = null
      simRef.current?.alpha(0.3).restart()
    })

    // ── Simulation ──
    // Stop previous simulation. If we don't, two sims will fight over the same
    // node positions, causing wild oscillation.
    simRef.current?.stop()

    const sim = d3.forceSimulation<NetworkNode, ResolvedEdge>(currentNodes)
      .force('link',
        d3.forceLink<NetworkNode, ResolvedEdge>(resolvedEdges)
          .id(d => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody<NetworkNode>().strength(-120))
      .force('center', d3.forceCenter(innerW / 2, innerH / 2))
      .force('collide', d3.forceCollide<NetworkNode>().radius(d => nodeRadius(d) + 4))
      // Weak centering forces keep unpinned nodes within the viewport
      .force('x', d3.forceX(innerW / 2).strength(0.05))
      .force('y', d3.forceY(innerH / 2).strength(0.05))
      .alpha(0.3)

    simRef.current = sim

    // The tick callback directly mutates SVG attributes. No React state is
    // touched here — that would re-render the component on every animation frame.
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as NetworkNode).x ?? 0)
        .attr('y1', d => (d.source as NetworkNode).y ?? 0)
        .attr('x2', d => (d.target as NetworkNode).x ?? 0)
        .attr('y2', d => (d.target as NetworkNode).y ?? 0)

      nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      sim.stop()
    }
  }, [filteredEdges, sourceNodes, sectorColor, innerW, innerH, edgeCountById])

  // ─── Dimming effect ───────────────────────────────────────────────────────
  // When a node is selected, dim all nodes and edges that are not connected.
  // We do this via a separate effect so we don't couple it to the expensive
  // simulation rebuild — the sim effect only runs on threshold/dimension changes.
  useEffect(() => {
    const nodesG = nodesGRef.current
    const linksG = linksGRef.current
    if (!nodesG || !linksG) return

    if (!selectedNodeId) {
      // No selection — restore full opacity on all elements
      d3.select(nodesG).selectAll<SVGGElement, NetworkNode>('g.node')
        .style('opacity', null)
      d3.select(linksG).selectAll<SVGLineElement, ResolvedEdge>('line')
        .style('opacity', null)
      return
    }

    // Build set of neighbour ids for the selected node
    const neighbours = new Set<string>([selectedNodeId])
    for (const e of filteredEdges) {
      if (e.source === selectedNodeId || e.target === selectedNodeId) {
        neighbours.add(e.source)
        neighbours.add(e.target)
      }
    }

    d3.select(nodesG).selectAll<SVGGElement, NetworkNode>('g.node')
      .style('opacity', d => neighbours.has(d.id) ? null : '0.08')

    d3.select(linksG).selectAll<SVGLineElement, ResolvedEdge>('line')
      .style('opacity', (d) => {
        const sid = typeof d.source === 'object' ? (d.source as NetworkNode).id : String(d.source)
        const tid = typeof d.target === 'object' ? (d.target as NetworkNode).id : String(d.target)
        return sid === selectedNodeId || tid === selectedNodeId ? null : '0.04'
      })
  }, [selectedNodeId, filteredEdges])

  // Compute tooltip pixel position in the SVG coordinate space
  // The nodeGroup transform gives us the x/y from the tick; we store it in
  // a simpler way by reading the node's current x/y from stableNodesRef.
  const tooltipNode = useMemo(() => {
    if (!tooltip) return null
    const n = stableNodesRef.current.find(n => n.id === tooltip.node.id)
    if (!n) return null
    return n
  }, [tooltip])

  return (
    <GalleryFrame
      title="Force-Directed Network"
      intro="Hover a node to see its sector, market cap, and edge count — and dim unrelated nodes. Drag to pin; double-click to release."
      description="50 securities connected by rolling correlation strength. Node area encodes market cap; edge width encodes |r|. Drag to pin, double-click to release. Threshold slider filters low-correlation edges."
      totalPoints={50}
      renderedPoints={50}
      height={560}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {/* SVG takes all available height above the slider strip */}
        <svg
          ref={svgRef}
          style={{ flex: 1, display: 'block', overflow: 'visible', minHeight: 0 }}
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            <g ref={linksGRef} />
            <g ref={nodesGRef} />
            {/* Legend: 2 columns x 5 rows of sector colour dots */}
            <g ref={legendGRef} transform="translate(4,4)" />
          </g>

          {/* JSX-like tooltip rendered as SVG foreignObject avoids coordinate
              transforms. Instead we use a React JSX div portalled via absolute
              positioning on the container div below. */}
        </svg>

        {/* Threshold slider — rendered as a sibling div, not inside the SVG.
            Putting interactive controls inside SVG is possible but requires
            foreignObject, which has poor browser support for flex/form styling. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 12px 8px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: 'var(--text-2)',
              whiteSpace: 'nowrap',
            }}
          >
            Edge threshold: |r| &ge; {threshold.toFixed(2)}
          </span>
          <input
            type="range"
            min={0.1}
            max={0.9}
            step={0.05}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            style={{ width: 180, accentColor: 'var(--accent)' }}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              color: 'var(--text-2)',
            }}
          >
            {filteredEdges.length} edges
          </span>
          <button
            onClick={() => {
              stableNodesRef.current.forEach(n => { n.fx = null; n.fy = null })
              simRef.current?.alpha(0.8).restart()
            }}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
              fontSize: 11,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              cursor: 'pointer',
              padding: '2px 8px',
            }}
          >
            reset
          </button>
        </div>

        {/* Node tooltip — absolutely positioned over the container.
            We read the node's simulation x/y from stableNodesRef and offset by
            the SVG's bounding rect relative to the container. */}
        {tooltip && tooltipNode && (
          <div
            style={{
              position: 'absolute',
              left: (tooltipNode.x ?? 0) + MARGIN.left + 14,
              top: (tooltipNode.y ?? 0) + MARGIN.top - 20,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '5px 10px',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--text-1)', fontWeight: 600, marginBottom: 2 }}>
              {tooltip.node.id}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>
              {tooltip.node.sector}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>
              mktcap {tooltip.node.marketCap.toFixed(1)}B
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>
              {tooltip.edgeCount} edges
            </div>
          </div>
        )}
      </div>
    </GalleryFrame>
  )
}
