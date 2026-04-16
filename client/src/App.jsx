import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import CommandPalette from './components/CommandPalette';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import DueCardsView from './components/DueCardsView';
import ConceptGraph from './components/ConceptGraph';
import VelocityDashboard from './components/VelocityDashboard';
import AdminPanel from './components/AdminPanel';
import SearchView from './components/SearchView';
import ProjectsView from './components/ProjectsView';
import VocabView from './components/VocabView';
import { useIsMobile } from './hooks/useIsMobile';

export default function App() {
  const [view, setView] = useState('library');
  const [selectedBook, setSelectedBook] = useState(null);
  const [dueCount, setDueCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todaySec, setTodaySec] = useState(0);
  const [books, setBooks] = useState([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const isMobile = useIsMobile();

  // Fetch global stats
  useEffect(() => {
    fetch('/api/concept_cards?due=true')
      .then(r => r.json())
      .then(cards => setDueCount(Array.isArray(cards) ? cards.length : 0))
      .catch(() => {});

    fetch('/api/stats/streak')
      .then(r => r.json())
      .then(data => { setStreak(data.streak || 0); setTodaySec(data.today_seconds || 0); })
      .catch(() => {});

    fetch('/api/books')
      .then(r => r.json())
      .then(data => setBooks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [view]); // Refresh when view changes

  const navigate = useCallback((viewId) => {
    if (viewId === 'library') setSelectedBook(null);
    setView(viewId);
  }, []);

  const selectBook = useCallback((book) => {
    setSelectedBook(book);
    setView('reader');
  }, []);

  // Global Ctrl+K handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === 'Escape' && cmdOpen) {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdOpen]);

  const todayMin = Math.floor(todaySec / 60);

  // Reader is full-screen — no sidebar
  if (view === 'reader' && selectedBook) {
    return (
      <>
        <ReaderView
          book={selectedBook}
          onBack={() => { setSelectedBook(null); setView('library'); }}
          onReview={() => setView('review')}
          onVocab={() => setView('vocab')}
        />
        <CommandPalette
          open={cmdOpen}
          onClose={() => setCmdOpen(false)}
          onNavigate={navigate}
          onSelectBook={selectBook}
          books={books}
          dueCount={dueCount}
        />
      </>
    );
  }

  // All other views get sidebar layout
  const renderView = () => {
    switch (view) {
      case 'review':   return <DueCardsView onBack={() => navigate('library')} />;
      case 'graph':    return <ConceptGraph />;
      case 'velocity': return <VelocityDashboard onBack={() => navigate('library')} />;
      case 'admin':    return <AdminPanel onBack={() => navigate('library')} />;
      case 'search':   return <SearchView onBack={() => navigate('library')} />;
      case 'projects': return <ProjectsView onBack={() => navigate('library')} />;
      case 'vocab':    return <VocabView onBack={() => navigate('library')} />;
      default:         return (
        <LibraryView
          onSelectBook={selectBook}
          onReview={() => navigate('review')}
          onGraph={() => navigate('graph')}
          onVelocity={() => navigate('velocity')}
          onAdmin={() => navigate('admin')}
          onSearch={() => navigate('search')}
          onProjects={() => navigate('projects')}
          onVocab={() => navigate('vocab')}
        />
      );
    }
  };

  return (
    <>
      {!isMobile && (
        <Sidebar
          activeView={view}
          onNavigate={navigate}
          dueCount={dueCount}
          streak={streak}
          todayMin={todayMin}
        />
      )}
      <main style={s.main}>
        {renderView()}
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={s.mobileNav}>
          {[
            { id: 'library',  icon: '◫', label: 'Library' },
            { id: 'review',   icon: '▣', label: 'Review' },
            { id: 'search',   icon: '⌕', label: 'Search' },
            { id: 'vocab',    icon: '▥', label: 'Vocab' },
            { id: 'velocity', icon: '▤', label: 'Stats' },
            { id: 'admin',    icon: '⚙', label: 'More' },
          ].map(item => (
            <button
              key={item.id}
              style={{
                ...s.mobileNavBtn,
                ...(view === item.id ? s.mobileNavBtnActive : {}),
              }}
              onClick={() => navigate(item.id)}
            >
              <span style={s.mobileNavIcon}>{item.icon}</span>
              <span style={s.mobileNavLabel}>{item.label}</span>
              {item.id === 'review' && dueCount > 0 && <span style={s.mobileBadge}>{dueCount}</span>}
            </button>
          ))}
        </nav>
      )}

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNavigate={navigate}
        onSelectBook={selectBook}
        books={books}
        dueCount={dueCount}
      />
    </>
  );
}

const s = {
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  mobileNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    background: 'var(--bg-surface)',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 50,
  },
  mobileNavBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    minWidth: '48px',
    minHeight: '48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    position: 'relative',
    fontFamily: 'var(--font-ui)',
    padding: '4px 2px',
  },
  mobileNavBtnActive: {
    color: 'var(--accent-blue)',
  },
  mobileNavIcon: {
    fontSize: '1.15rem',
    lineHeight: 1,
  },
  mobileNavLabel: {
    fontSize: '0.6rem',
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: '0.02em',
  },
  mobileBadge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    fontSize: '0.55rem',
    fontWeight: 700,
    color: '#fff',
    background: 'var(--accent-blue)',
    borderRadius: '100px',
    padding: '0 4px',
    lineHeight: '14px',
    minWidth: '14px',
    textAlign: 'center',
  },
};
