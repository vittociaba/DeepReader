import React from 'react';
import { READER_THEMES, FONT_FAMILIES } from '../hooks/useReaderSettings';

const THEME_LABELS = { light: 'Light', sepia: 'Sepia', dark: 'Dark' };
const FONT_LABELS  = { serif: 'Serif', sans: 'Sans', mono: 'Mono' };

export default function ReaderSettings({ settings, onUpdate, onClose }) {
  const themeColors = READER_THEMES[settings.theme] || READER_THEMES.sepia;

  return (
    <>
      <div style={s.backdrop} onClick={onClose} />
      <div style={s.panel}>
        {/* Handle */}
        <div style={s.header}>
          <div style={s.handle} />
        </div>

        {/* Font size */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Font size</div>
          <div style={s.sliderRow}>
            <span style={s.sizeLabel}>A</span>
            <input
              type="range"
              min={80}
              max={160}
              step={5}
              value={settings.fontSize}
              onChange={e => onUpdate({ fontSize: parseInt(e.target.value, 10) })}
              style={s.slider}
            />
            <span style={{ ...s.sizeLabel, fontSize: '1.3rem' }}>A</span>
            <span style={s.sizeValue}>{settings.fontSize}%</span>
          </div>
        </div>

        {/* Line height */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Line spacing</div>
          <div style={s.sliderRow}>
            <span style={s.sizeLabel}>≡</span>
            <input
              type="range"
              min={140}
              max={250}
              step={10}
              value={settings.lineHeight}
              onChange={e => onUpdate({ lineHeight: parseInt(e.target.value, 10) })}
              style={s.slider}
            />
            <span style={s.sizeValue}>{(settings.lineHeight / 100).toFixed(1)}</span>
          </div>
        </div>

        {/* Font family */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Font</div>
          <div style={s.btnRow}>
            {Object.entries(FONT_LABELS).map(([key, label]) => (
              <button
                key={key}
                style={{
                  ...s.optionBtn,
                  fontFamily: FONT_FAMILIES[key],
                  ...(settings.fontFamily === key ? s.optionBtnActive : {}),
                }}
                onClick={() => onUpdate({ fontFamily: key })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Theme</div>
          <div style={s.btnRow}>
            {Object.entries(THEME_LABELS).map(([key, label]) => {
              const t = READER_THEMES[key];
              const isActive = settings.theme === key;
              return (
                <button
                  key={key}
                  style={{
                    ...s.themeBtn,
                    background: t.bg,
                    color: t.text,
                    border: isActive
                      ? '2px solid var(--accent-blue)'
                      : `2px solid ${t.border}`,
                  }}
                  onClick={() => onUpdate({ theme: key })}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        <div style={{
          ...s.preview,
          background: themeColors.bg,
          color: themeColors.text,
          fontFamily: FONT_FAMILIES[settings.fontFamily],
          fontSize: `${settings.fontSize / 100}rem`,
          lineHeight: settings.lineHeight / 100,
        }}>
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
    </>
  );
}

const s = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 109,
  },
  panel: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'var(--bg-surface)',
    borderTop: '1px solid var(--border)',
    borderRadius: '14px 14px 0 0',
    zIndex: 110,
    padding: '0 var(--space-lg) var(--space-xl)',
    paddingBottom: 'calc(var(--space-xl) + env(safe-area-inset-bottom, 0px))',
    boxShadow: 'var(--shadow-lg)',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'center',
    padding: 'var(--space-sm) 0',
  },
  handle: {
    width: '40px',
    height: '4px',
    background: 'var(--border-strong)',
    borderRadius: '2px',
  },
  section: {
    padding: 'var(--space-md) 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  sectionLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 'var(--space-sm)',
    fontFamily: 'var(--font-ui)',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  sizeLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
    width: '20px',
    textAlign: 'center',
    fontFamily: 'var(--font-ui)',
  },
  sizeValue: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-faint)',
    fontVariantNumeric: 'tabular-nums',
    minWidth: '36px',
    textAlign: 'right',
    fontFamily: 'var(--font-ui)',
  },
  slider: {
    flex: 1,
    height: '36px',
    accentColor: 'var(--accent-blue)',
    cursor: 'pointer',
  },
  btnRow: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  optionBtn: {
    flex: 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    padding: '10px 0',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    minHeight: '44px',
    cursor: 'pointer',
  },
  optionBtnActive: {
    border: '1px solid var(--accent-blue)',
    color: 'var(--accent-blue)',
    background: 'var(--accent-blue-muted)',
    fontWeight: 600,
  },
  themeBtn: {
    flex: 1,
    borderRadius: 'var(--radius-md)',
    padding: '10px 0',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    minHeight: '44px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    textAlign: 'center',
  },
  preview: {
    margin: 'var(--space-md) 0 0',
    padding: 'var(--space-md)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    textAlign: 'center',
  },
};
