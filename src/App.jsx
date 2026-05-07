import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Canvas from './components/Canvas.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import AlgorithmInfo from './components/AlgorithmInfo.jsx';
import LogPanel from './components/LogPanel.jsx';
import Toast from './components/Toast.jsx';
import ComparisonTable from './components/ComparisonTable.jsx';
import { useTSPSolver } from './hooks/useTSPSolver.js';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') ?? 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const solver = useTSPSolver();
  const { solverState, isRunning, isPaused, toast, isComparing, comparisonResults } = solver;

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isRunning) solver.pause();
          else if (isPaused) solver.resume();
          else solver.start();
          break;
        case 'KeyR':
          if (!e.ctrlKey && !e.metaKey) solver.reset();
          break;
        case 'KeyC':
          if (!e.ctrlKey && !e.metaKey) solver.clearCities();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isRunning, isPaused, solver]);

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-app)', fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        zIndex: 0,
      }} />

      {/* Canvas 60% */}
      <motion.div
        className="relative overflow-hidden"
        style={{ flex: '1 1 60%', zIndex: 1 }}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Canvas
          cities={solver.cities}
          tour={solverState.tour}
          exploredEdges={solverState.exploredEdges}
          onCityAdd={solver.addCity}
          isRunning={isRunning}
          theme={theme}
        />

        {/* Status bar over canvas */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-1.5 rounded font-mono text-xs"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', backdropFilter: 'blur(8px)', zIndex: 20, whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-dim)' }}>CITIES <span style={{ color: 'var(--accent-cyan)' }} className="ml-1">{solver.cities.length}</span></span>
          {solverState.distance < Infinity && (
            <span style={{ color: 'var(--text-dim)' }}>DIST <span style={{ color: 'var(--accent-cyan)' }} className="ml-1">{solverState.distance.toFixed(1)}</span></span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              SOLVING
            </span>
          )}
          {solverState.phase === 'complete' && <span className="text-green-400">✓ COMPLETE</span>}
        </div>
      </motion.div>

      {/* Sidebar 40% */}
      <motion.div
        className="flex flex-col overflow-hidden"
        style={{
          flex: '0 0 420px',
          minWidth: '360px',
          background: 'var(--bg-sidebar)',
          borderLeft: '1px solid var(--border-cyan)',
          zIndex: 2,
        }}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-cyan)' }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex gap-1.5">
              {['#ff3366','#ffb700','#00ff88'].map((c, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}90` }} />
              ))}
            </div>
            <div className="w-px h-4" style={{ background: 'var(--border-divider)' }} />
            <span className="text-xs font-mono tracking-widest" style={{ color: 'var(--text-dim)' }}>MISSION CONTROL v1.0</span>
            <button
              onClick={toggleTheme}
              className="ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded"
              style={{
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border-cyan)',
                background: 'transparent',
                cursor: 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              {theme === 'dark' ? '☀ LIGHT' : '◑ DARK'}
            </button>
          </div>
          <h1 className="font-display font-black tracking-widest"
            style={{ fontSize: '1.3rem', color: 'var(--accent-cyan)', textShadow: `0 0 20px color-mix(in srgb, var(--accent-cyan) 50%, transparent)`, lineHeight: 1.2 }}>
            TSP VISUALIZER
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-dim)' }}>TRAVELLING SALESMAN PROBLEM</p>
          <div className="mt-1 flex flex-col gap-0.5">
            <span className="text-xs font-mono font-bold" style={{ color: '#ffffff' }}>SAADI Sofiane</span>
            <div className="flex gap-3">
              <span className="text-xs font-mono font-bold" style={{ color: '#ffffff' }}>NETTAH Douaa</span>
              <span className="text-xs font-mono font-bold" style={{ color: '#ffffff' }}>HAMMOUCHE Djamila Roza</span>
            </div>
          </div>
        </div>

        {/* Scrollable panel */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in srgb, var(--accent-cyan) 12%, transparent) transparent' }}>
          <ControlPanel solver={solver} />
          <StatsPanel state={solverState} algorithm={solver.algorithm} />
          <AlgorithmInfo algorithm={solver.algorithm} />
          <LogPanel logs={solver.logs} />

          <motion.button
            onClick={solver.runComparison}
            disabled={isRunning || solver.cities.length < 2 || isComparing}
            className="w-full py-2.5 text-xs font-mono font-bold tracking-widest rounded"
            style={{
              background: 'rgba(255,183,0,0.06)',
              border: '1px solid rgba(255,183,0,0.22)',
              color: 'rgba(255,183,0,0.75)',
              opacity: (isRunning || solver.cities.length < 2) ? 0.35 : 1,
              cursor: (isRunning || solver.cities.length < 2) ? 'not-allowed' : 'pointer',
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: (isRunning || solver.cities.length < 2) ? 0.35 : 1 }}
          >
            {isComparing ? '⟳ COMPARING...' : '⊞ RUN ALL — COMPARE ALGORITHMS'}
          </motion.button>

          <AnimatePresence>
            {(comparisonResults || isComparing) && (
              <ComparisonTable results={comparisonResults} isComparing={isComparing} onClose={solver.clearComparison} />
            )}
          </AnimatePresence>

          <div className="h-3 flex-shrink-0" />
        </div>
      </motion.div>

      {/* Toast */}
      <div className="fixed bottom-5 right-5 z-50">
        <AnimatePresence>
          {toast && <Toast key={toast.id} message={toast.message} type={toast.type} />}
        </AnimatePresence>
      </div>

      {/* Scanlines */}
      <div className="fixed inset-0 pointer-events-none z-50" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 4px)',
      }} />
    </div>
  );
}
