import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ConceptGraph — Feature 4
 * Force-directed graph of concept cards rendered with Canvas.
 * Nodes = cards, edges = wiki-link connections.
 *
 */
export default function ConceptGraph() {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);
  const simRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    fetch('/api/concept_cards/graph')
      .then(r => r.json())
      .then(data => setGraphData(data))
      .catch(() => setGraphData({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));
  }, []);

  // Book → color mapping
  const bookColors = useRef({});
  const PALETTE = [
    '#4a9eff', '#4adf8a', '#ffaa4a', '#ff6b8a', '#a78bfa',
    '#f0c674', '#66d9ef', '#e06c75', '#98c379', '#d19a66',
  ];

  const getBookColor = useCallback((book) => {
    if (!bookColors.current[book]) {
      const idx = Object.keys(bookColors.current).length % PALETTE.length;
      bookColors.current[book] = PALETTE[idx];
    }
    return bookColors.current[book];
  }, []);

  // Force simulation
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = canvas.parentElement.clientHeight - 60;

    // Initialize node positions
    const nodes = graphData.nodes.map((n, i) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * W * 0.6,
      y: H / 2 + (Math.random() - 0.5) * H * 0.6,
      vx: 0,
      vy: 0,
      radius: Math.min(6 + n.connections * 2, 18),
    }));

    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);

    const edges = graphData.edges
      .filter(e => nodeMap[e.source] && nodeMap[e.target])
      .map(e => ({ source: nodeMap[e.source], target: nodeMap[e.target] }));

    // Orphan detection: nodes with 0 edges
    const connectedIds = new Set();
    edges.forEach(e => { connectedIds.add(e.source.id); connectedIds.add(e.target.id); });

    // Bridge detection: nodes connecting otherwise separate clusters
    const bridgeIds = new Set();
    for (const n of nodes) {
      if (n.connections >= 2) {
        const linkedBooks = new Set();
        edges.forEach(e => {
          if (e.source.id === n.id) linkedBooks.add(e.target.source_book);
          if (e.target.id === n.id) linkedBooks.add(e.source.source_book);
        });
        if (linkedBooks.size >= 2) bridgeIds.add(n.id);
      }
    }

    simRef.current = { nodes, edges, nodeMap, connectedIds, bridgeIds };

    let tickCount = 0;
    const maxTicks = 300;

    function tick() {
      if (tickCount++ > maxTicks) {
        // Continue rendering but stop physics
        draw();
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      const alpha = Math.max(0.01, 1 - tickCount / maxTicks);

      // Repulsion (all pairs)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = 800 / (dist * dist) * alpha;
          let fx = (dx / dist) * force;
          let fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction (edges)
      for (const e of edges) {
        let dx = e.target.x - e.source.x;
        let dy = e.target.y - e.source.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = (dist - 100) * 0.01 * alpha;
        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;
        e.source.vx += fx;
        e.source.vy += fy;
        e.target.vx -= fx;
        e.target.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.001 * alpha;
        n.vy += (H / 2 - n.y) * 0.001 * alpha;
      }

      // Apply velocity with damping
      for (const n of nodes) {
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        // Bounds
        n.x = Math.max(n.radius, Math.min(W - n.radius, n.x));
        n.y = Math.max(n.radius, Math.min(H - n.radius, n.y));
      }

      draw();
      animRef.current = requestAnimationFrame(tick);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Draw edges
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (const e of edges) {
        ctx.beginPath();
        ctx.moveTo(e.source.x, e.source.y);
        ctx.lineTo(e.target.x, e.target.y);
        ctx.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        const isOrphan = !connectedIds.has(n.id);
        const isBridge = bridgeIds.has(n.id);
        const isHovered = hoveredNode === n.id;
        const color = getBookColor(n.source_book);

        ctx.beginPath();
        ctx.arc(n.x, n.y, isHovered ? n.radius + 3 : n.radius, 0, Math.PI * 2);

        if (isOrphan) {
          ctx.fillStyle = '#4a2a2a';
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        } else if (isBridge) {
          ctx.fillStyle = color;
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }

        // Label for hovered
        if (isHovered) {
          ctx.fillStyle = '#fff';
          ctx.font = '12px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(n.title, n.x, n.y - n.radius - 8);
        }
      }
    }

    animRef.current = requestAnimationFrame(tick);

    // Mouse hover detection
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found = null;
      for (const n of nodes) {
        const dx = mx - n.x;
        const dy = my - n.y;
        if (dx * dx + dy * dy < (n.radius + 5) * (n.radius + 5)) {
          found = n.id;
          break;
        }
      }
      setHoveredNode(found);
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [graphData, getBookColor, hoveredNode]);

  if (loading) {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <h1 style={s.title}>Concept Graph</h1>
        </header>
        <div style={s.center}>Loading graph data…</div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div style={s.page}>
        <header style={s.header}>
          <h1 style={s.title}>Concept Graph</h1>
        </header>
        <div style={s.center}>
          No concept cards yet. Create cards from annotations to see your knowledge graph.
        </div>
      </div>
    );
  }

  // Get unique books for the legend
  const books = [...new Set(graphData.nodes.map(n => n.source_book))];
  const orphanCount = graphData.nodes.filter(n => n.connections === 0).length;
  const bridgeCount = simRef.current ? simRef.current.bridgeIds.size : 0;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Concept Graph</h1>
        <span style={s.stats}>
          {graphData.nodes.length} nodes · {graphData.edges.length} edges
          {orphanCount > 0 && <span style={{ color: '#ff6b6b' }}> · {orphanCount} orphans</span>}
          {bridgeCount > 0 && <span style={{ color: '#ffd700' }}> · {bridgeCount} bridges</span>}
        </span>
      </header>

      {/* Legend */}
      <div style={s.legend}>
        {books.map(b => (
          <span key={b} style={s.legendItem}>
            <span style={{ ...s.legendDot, background: getBookColor(b) }} />
            {b}
          </span>
        ))}
        <span style={s.legendItem}>
          <span style={{ ...s.legendDot, background: '#4a2a2a', border: '1px solid #ff6b6b' }} />
          Orphan
        </span>
        <span style={s.legendItem}>
          <span style={{ ...s.legendDot, background: '#ffd700' }} />
          Bridge
        </span>
      </div>

      {/* Canvas */}
      <div style={s.canvasWrap}>
        <canvas ref={canvasRef} style={s.canvas} />
      </div>

      {/* Hovered node info */}
      {hoveredNode && simRef.current && (() => {
        const n = simRef.current.nodeMap[hoveredNode];
        if (!n) return null;
        return (
          <div style={s.tooltip}>
            <strong>{n.title}</strong>
            <span style={{ color: 'var(--text-muted)' }}>{n.source_book}</span>
            <span style={{ color: 'var(--text-faint)', fontSize: 'var(--text-xs)' }}>
              {n.connections} connections · interval {n.interval}d
              {n.status !== 'active' && ` · ${n.status}`}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

const s = {
  page: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-deep)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-xl) var(--space-2xl) var(--space-md)',
    flexShrink: 0,
  },
  title: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  stats: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-lg)',
    padding: 'var(--space-sm) var(--space-lg)',
    background: 'var(--bg-deep)',
    borderBottom: '1px solid var(--bg-surface)',
    flexShrink: 0,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  canvasWrap: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-faint)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
  },
  tooltip: {
    position: 'absolute',
    bottom: 'var(--space-lg)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-sm) var(--space-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    zIndex: 10,
    pointerEvents: 'none',
  },
};
