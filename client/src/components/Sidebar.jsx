import React, { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { id: 'library',  label: 'Library',   icon: '◫', shortcut: null },
  { id: 'review',   label: 'Review',    icon: '▣', shortcut: null },
  { id: 'search',   label: 'Search',    icon: '⌕', shortcut: 'Ctrl+K' },
  { id: 'graph',    label: 'Graph',     icon: '◎', shortcut: null },
  { id: 'velocity', label: 'Velocity',  icon: '▤', shortcut: null },
  { id: 'projects', label: 'Lists',     icon: '▧', shortcut: null },
  { id: 'vocab',    label: 'Vocab',     icon: '▥', shortcut: null },
];

const BOTTOM_ITEMS = [
  { id: 'admin', label: 'Settings', icon: '⚙' },
];

export default function Sidebar({ activeView, onNavigate, dueCount, streak, todayMin }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  return (
    <nav style={{ ...s.sidebar, width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}>
      {/* Brand */}
      <div style={s.brand} onClick={() => setCollapsed(c => !c)}>
        <span style={s.brandIcon}>📖</span>
        {!collapsed && <span style={s.brandText}>DeepReader</span>}
      </div>

      {/* Streak badge */}
      {streak > 0 && !collapsed && (
        <div style={s.streakBadge}>
          <span style={s.streakFire}>🔥</span>
          <span style={s.streakText}>{streak}d streak</span>
          {todayMin > 0 && <span style={s.streakMeta}>{todayMin}m today</span>}
        </div>
      )}
      {streak > 0 && collapsed && (
        <div style={s.streakBadgeCollapsed} title={`${streak}d streak · ${todayMin}m today`}>
          🔥
        </div>
      )}

      {/* Main nav */}
      <div style={s.navGroup}>
        {NAV_ITEMS.map(item => {
          const isActive = activeView === item.id;
          const showBadge = item.id === 'review' && dueCount > 0;
          return (
            <button
              key={item.id}
              style={{
                ...s.navItem,
                ...(isActive ? s.navItemActive : {}),
              }}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}` : undefined}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {!collapsed && (
                <>
                  <span style={s.navLabel}>{item.label}</span>
                  {showBadge && <span style={s.badge}>{dueCount}</span>}
                  {item.shortcut && <span style={s.shortcut}>{item.shortcut}</span>}
                </>
              )}
              {collapsed && showBadge && <span style={s.badgeDot} />}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom nav */}
      <div style={s.navGroup}>
        {BOTTOM_ITEMS.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              style={{
                ...s.navItem,
                ...(isActive ? s.navItemActive : {}),
              }}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {!collapsed && <span style={s.navLabel}>{item.label}</span>}
            </button>
          );
        })}

        {/* Collapse toggle */}
        <button
          style={s.navItem}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span style={{ ...s.navIcon, transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition)' }}>
            «
          </span>
          {!collapsed && <span style={s.navLabel}>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}

const s = {
  sidebar: {
    height: '100vh',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'width var(--transition-slow)',
    overflow: 'hidden',
    zIndex: 20,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-lg)',
    paddingBottom: 'var(--space-md)',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  brandIcon: {
    fontSize: '1.3rem',
    flexShrink: 0,
    width: '24px',
    textAlign: 'center',
  },
  brandText: {
    fontSize: 'var(--text-md)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  streakBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-xs)',
    margin: '0 var(--space-md) var(--space-md)',
    padding: 'var(--space-xs) var(--space-sm)',
    background: 'var(--accent-amber-muted)',
    border: '1px solid var(--accent-amber-dim)',
    borderRadius: 'var(--radius-md)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  streakFire: { fontSize: '0.85rem', flexShrink: 0 },
  streakText: { fontSize: 'var(--text-sm)', color: 'var(--accent-amber)', fontWeight: 600 },
  streakMeta: { fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 'auto' },
  streakBadgeCollapsed: {
    textAlign: 'center',
    fontSize: '0.85rem',
    padding: 'var(--space-xs) 0',
    marginBottom: 'var(--space-sm)',
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 var(--space-sm)',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-sm) var(--space-sm)',
    background: 'none',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    position: 'relative',
    fontFamily: 'var(--font-ui)',
  },
  navItemActive: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  navIcon: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.05rem',
    flexShrink: 0,
    opacity: 0.8,
  },
  navLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    color: 'var(--accent-blue)',
    background: 'var(--accent-blue-dim)',
    borderRadius: 'var(--radius-pill)',
    padding: '1px 7px',
    lineHeight: 1.4,
  },
  badgeDot: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--accent-blue)',
  },
  shortcut: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    marginLeft: 'auto',
  },
};
