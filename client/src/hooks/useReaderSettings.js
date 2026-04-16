import { useState, useCallback } from 'react';

const DEFAULTS = {
  fontSize: 105,       // percentage (100 = 1rem)
  lineHeight: 190,     // percentage (190 = 1.9)
  fontFamily: 'serif', // 'serif' | 'sans' | 'mono'
  theme: 'sepia',      // 'light' | 'sepia' | 'dark'
};

const STORAGE_KEY = 'reader_settings';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const READER_THEMES = {
  light: { bg: '#ffffff', text: '#1a1a1a', navBg: '#f5f5f5', border: '#e0e0e0' },
  sepia: { bg: '#f7f2ea', text: '#2a2420', navBg: '#f0ebe3', border: '#e0d8cc' },
  dark:  { bg: '#1a1714', text: '#d4ccc4', navBg: '#201c18', border: '#352f29' },
};

export const FONT_FAMILIES = {
  serif: "'Georgia', 'Times New Roman', serif",
  sans:  "'Inter', system-ui, -apple-system, sans-serif",
  mono:  "'JetBrains Mono', 'Fira Code', monospace",
};

export function useReaderSettings() {
  const [settings, setSettingsState] = useState(load);

  const update = useCallback((partial) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      save(next);
      return next;
    });
  }, []);

  return [settings, update];
}
