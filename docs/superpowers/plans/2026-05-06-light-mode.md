# Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent dark/light theme toggle to the TSP Visualizer sidebar header, keeping the cyberpunk aesthetic in both modes.

**Architecture:** CSS custom properties define two palettes (`[data-theme="dark"]` / `[data-theme="light"]`) on `<html>`. A `useState` in `App.jsx` flips `data-theme` and persists to `localStorage`. CSS classes and inline styles reference `var(--token)` instead of hardcoded colors. The Canvas SVG uses a theme prop for fill/stroke values that SVG attributes can't read from CSS variables.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, plain CSS custom properties (no extra libraries)

---

## File Map

| File | Change |
|---|---|
| `src/index.css` | Add token variable blocks; update all CSS classes to use tokens |
| `src/App.jsx` | Add theme state + toggle button; replace hardcoded inline colors |
| `src/components/Canvas.jsx` | Accept `theme` prop; replace hardcoded SVG fill/stroke values |
| `src/components/ControlPanel.jsx` | Replace `border-white/5`; fix speed-btn white-opacity inline styles |
| `src/components/StatsPanel.jsx` | Replace `border-white/5`, `bg-white/5`; update default StatRow color |

---

## Task 1: Define CSS custom property tokens in `src/index.css`

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the token blocks at the top of `src/index.css`, after `@tailwind utilities;`**

Insert this block immediately after line 3 (`@tailwind utilities;`):

```css
/* ────────── Theme tokens ────────── */
[data-theme="dark"] {
  --bg-app: #07070f;
  --bg-sidebar: rgba(8,8,17,0.98);
  --bg-card: rgba(11,11,20,0.9);
  --border-cyan: rgba(0,245,255,0.1);
  --accent-cyan: #00f5ff;
  --text-dim: rgba(255,255,255,0.4);
  --text-label: rgba(0,245,255,0.5);
  --grid-line: rgba(0,245,255,0.025);
  --border-divider: rgba(255,255,255,0.05);
  --bg-subtle: rgba(255,255,255,0.05);
}

[data-theme="light"] {
  --bg-app: #f0f2f5;
  --bg-sidebar: rgba(240,242,248,0.98);
  --bg-card: rgba(255,255,255,0.85);
  --border-cyan: rgba(0,180,200,0.2);
  --accent-cyan: #007a85;
  --text-dim: rgba(0,0,0,0.5);
  --text-label: rgba(0,120,140,0.8);
  --grid-line: rgba(0,150,180,0.06);
  --border-divider: rgba(0,0,0,0.07);
  --bg-subtle: rgba(0,0,0,0.05);
}
```

- [ ] **Step 2: Update `body` background to use the token**

Change line 7 in `src/index.css`:
```css
/* BEFORE */
body { margin: 0; overflow: hidden; background: #07070f; }

/* AFTER */
body { margin: 0; overflow: hidden; background: var(--bg-app); }
```

- [ ] **Step 3: Update `.card` to use tokens**

```css
/* BEFORE */
.card {
  background: rgba(11, 11, 20, 0.9);
  border: 1px solid rgba(0, 245, 255, 0.1);
  border-radius: 3px;
  backdrop-filter: blur(12px);
}
.card:hover {
  border-color: rgba(0, 245, 255, 0.16);
}

/* AFTER */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-cyan);
  border-radius: 3px;
  backdrop-filter: blur(12px);
}
.card:hover {
  border-color: color-mix(in srgb, var(--accent-cyan) 20%, transparent);
}
```

- [ ] **Step 4: Update `.label-text` to use tokens**

```css
/* BEFORE */
.label-text {
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(0, 245, 255, 0.5);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  text-transform: uppercase;
}

/* AFTER */
.label-text {
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: var(--text-label);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  text-transform: uppercase;
}
```

- [ ] **Step 5: Update `.city-btn` to use tokens**

```css
/* BEFORE */
.city-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  padding: 6px 4px;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.12s ease;
}
.city-btn:hover:not(:disabled) {
  background: rgba(0, 245, 255, 0.08);
  border-color: rgba(0, 245, 255, 0.3);
  color: #00f5ff;
  box-shadow: 0 0 10px rgba(0, 245, 255, 0.2);
}
.city-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* AFTER */
.city-btn {
  background: var(--bg-subtle);
  border: 1px solid var(--border-divider);
  border-radius: 3px;
  padding: 6px 4px;
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.12s ease;
}
.city-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-cyan) 8%, transparent);
  border-color: color-mix(in srgb, var(--accent-cyan) 30%, transparent);
  color: var(--accent-cyan);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent-cyan) 20%, transparent);
}
.city-btn:disabled { opacity: 0.3; cursor: not-allowed; }
```

- [ ] **Step 6: Update `.ctrl-btn` to use tokens**

```css
/* BEFORE */
.ctrl-btn.primary {
  background: rgba(0, 245, 255, 0.1);
  border-color: rgba(0, 245, 255, 0.4);
  color: #00f5ff;
  box-shadow: 0 0 12px rgba(0, 245, 255, 0.15);
}
.ctrl-btn.primary:hover:not(:disabled) {
  background: rgba(0, 245, 255, 0.18);
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
  transform: translateY(-1px);
}

/* AFTER */
.ctrl-btn.primary {
  background: color-mix(in srgb, var(--accent-cyan) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-cyan) 40%, transparent);
  color: var(--accent-cyan);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-cyan) 15%, transparent);
}
.ctrl-btn.primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-cyan) 18%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent-cyan) 30%, transparent);
  transform: translateY(-1px);
}
```

- [ ] **Step 7: Update scrollbar to use tokens**

```css
/* BEFORE */
::-webkit-scrollbar-thumb { background: rgba(0, 245, 255, 0.15); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0, 245, 255, 0.3); }

/* AFTER */
::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--accent-cyan) 15%, transparent); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--accent-cyan) 30%, transparent); }
```

- [ ] **Step 8: Start the dev server and verify dark mode still renders correctly**

```bash
npm run dev
```

Open `http://localhost:5173` in a browser. The app should look identical to before — **no visual change yet** since `data-theme` isn't being set yet. If you see a broken layout, check the CSS edits above for typos.

- [ ] **Step 9: Commit**

```bash
git add src/index.css
git commit -m "feat: add CSS theme tokens for light/dark mode"
```

---

## Task 2: Add theme state and toggle button in `src/App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add theme state with localStorage persistence**

Add these lines at the top of the `App` function body, before the `solver` line:

```jsx
const [theme, setTheme] = useState(() => localStorage.getItem('theme') ?? 'dark');

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}, [theme]);

const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
```

Add `useState` to the existing React import at the top of the file — it should already be there from the existing `useEffect` import. The full import line should be:

```jsx
import { useEffect, useState } from 'react';
```

- [ ] **Step 2: Replace hardcoded inline colors on the root div and grid overlay**

Find the root `<div>` and the grid overlay `<div>` and update them:

```jsx
/* BEFORE — root div */
<div className="h-screen flex overflow-hidden" style={{ background: '#07070f', fontFamily: 'JetBrains Mono, monospace' }}>

/* AFTER */
<div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-app)', fontFamily: 'JetBrains Mono, monospace' }}>
```

```jsx
/* BEFORE — grid overlay */
backgroundImage: `linear-gradient(rgba(0,245,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.025) 1px, transparent 1px)`,

/* AFTER */
backgroundImage: `linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`,
```

- [ ] **Step 3: Replace hardcoded sidebar colors**

```jsx
/* BEFORE */
style={{
  flex: '0 0 420px',
  minWidth: '360px',
  background: 'rgba(8,8,17,0.98)',
  borderLeft: '1px solid rgba(0,245,255,0.07)',
  zIndex: 2,
}}

/* AFTER */
style={{
  flex: '0 0 420px',
  minWidth: '360px',
  background: 'var(--bg-sidebar)',
  borderLeft: '1px solid var(--border-cyan)',
  zIndex: 2,
}}
```

- [ ] **Step 4: Replace hardcoded header border and status bar colors**

```jsx
/* BEFORE — header wrapper */
<div className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,245,255,0.07)' }}>

/* AFTER */
<div className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-cyan)' }}>
```

```jsx
/* BEFORE — status bar */
style={{ background: 'rgba(7,7,15,0.88)', border: '1px solid rgba(0,245,255,0.12)', ... }}

/* AFTER */
style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cyan)', ... }}
```

- [ ] **Step 5: Update the title and "MISSION CONTROL" text colors**

```jsx
/* BEFORE — MISSION CONTROL label */
<span className="text-xs text-gray-600 font-mono tracking-widest">MISSION CONTROL v1.0</span>

/* AFTER */
<span className="text-xs font-mono tracking-widest" style={{ color: 'var(--text-dim)' }}>MISSION CONTROL v1.0</span>
```

```jsx
/* BEFORE — TSP VISUALIZER h1 */
<h1 className="font-display font-black tracking-widest"
  style={{ fontSize: '1.3rem', color: '#00f5ff', textShadow: '0 0 20px rgba(0,245,255,0.5), 0 0 60px rgba(0,245,255,0.15)', lineHeight: 1.2 }}>

/* AFTER */
<h1 className="font-display font-black tracking-widest"
  style={{ fontSize: '1.3rem', color: 'var(--accent-cyan)', textShadow: `0 0 20px color-mix(in srgb, var(--accent-cyan) 50%, transparent)`, lineHeight: 1.2 }}>
```

```jsx
/* BEFORE — subtitle */
<p className="text-xs text-gray-600 font-mono mt-0.5">TRAVELLING SALESMAN PROBLEM</p>

/* AFTER */
<p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-dim)' }}>TRAVELLING SALESMAN PROBLEM</p>
```

- [ ] **Step 6: Replace the `bg-white/10` divider dot and status bar cyan spans**

```jsx
/* BEFORE — vertical divider between dots and label */
<div className="w-px h-4 bg-white/10" />

/* AFTER */
<div className="w-px h-4" style={{ background: 'var(--border-divider)' }} />
```

```jsx
/* BEFORE — status bar city/distance values */
<span className="text-gray-500">CITIES <span className="text-cyan-400 ml-1">{solver.cities.length}</span></span>
{solverState.distance < Infinity && (
  <span className="text-gray-500">DIST <span className="text-cyan-400 ml-1">{solverState.distance.toFixed(1)}</span></span>
)}

/* AFTER */
<span style={{ color: 'var(--text-dim)' }}>CITIES <span style={{ color: 'var(--accent-cyan)' }} className="ml-1">{solver.cities.length}</span></span>
{solverState.distance < Infinity && (
  <span style={{ color: 'var(--text-dim)' }}>DIST <span style={{ color: 'var(--accent-cyan)' }} className="ml-1">{solverState.distance.toFixed(1)}</span></span>
)}
```

- [ ] **Step 7: Add the toggle button to the sidebar header**

In the header `<div className="flex items-center gap-2.5 mb-2">`, add the toggle button as the last child (after the vertical divider and MISSION CONTROL label):

```jsx
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
```

- [ ] **Step 8: Pass `theme` as a prop to `Canvas`**

```jsx
/* BEFORE */
<Canvas
  cities={solver.cities}
  tour={solverState.tour}
  exploredEdges={solverState.exploredEdges}
  onCityAdd={solver.addCity}
  isRunning={isRunning}
/>

/* AFTER */
<Canvas
  cities={solver.cities}
  tour={solverState.tour}
  exploredEdges={solverState.exploredEdges}
  onCityAdd={solver.addCity}
  isRunning={isRunning}
  theme={theme}
/>
```

- [ ] **Step 9: Verify in browser**

With `npm run dev` still running, open `http://localhost:5173`. The toggle button should appear in the sidebar header. Clicking it should switch the sidebar and background colors. The canvas will still be dark (fixed in Task 3).

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add theme toggle button and state to App"
```

---

## Task 3: Update `src/components/Canvas.jsx` to use the `theme` prop

**Files:**
- Modify: `src/components/Canvas.jsx`

- [ ] **Step 1: Accept the `theme` prop and define theme-conditional color constants**

Change the function signature and add a `tc` object at the top of the component body:

```jsx
/* BEFORE */
export default function Canvas({ cities, tour, exploredEdges, onCityAdd, isRunning }) {

/* AFTER */
export default function Canvas({ cities, tour, exploredEdges, onCityAdd, isRunning, theme }) {
  const tc = {
    accent:          theme === 'light' ? '#007a85' : '#00f5ff',
    cityIdle:        theme === 'light' ? '#c8eef2' : '#004a55',
    cityIdleAnim:    theme === 'light' ? '#c8eef2;#7dd8e0;#c8eef2' : '#004a55;#00a0b0;#004a55',
    vignette:        theme === 'light' ? 'rgba(200,210,220,0.3)' : 'rgba(0,0,0,0.6)',
  };
```

Close the object before the `const svgRef` line.

- [ ] **Step 2: Update canvas background**

```jsx
/* BEFORE */
<div className="relative w-full h-full overflow-hidden" style={{ background: '#07070f' }}>

/* AFTER */
<div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg-app)' }}>
```

- [ ] **Step 3: Update SVG grid lines**

```jsx
/* BEFORE */
<line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={H} stroke="#00f5ff" strokeWidth="0.5" />
...
<line key={`h${i}`} x1={0} y1={i * 40} x2={W} y2={i * 40} stroke="#00f5ff" strokeWidth="0.5" />

/* AFTER */
<line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={H} stroke={tc.accent} strokeWidth="0.5" />
...
<line key={`h${i}`} x1={0} y1={i * 40} x2={W} y2={i * 40} stroke={tc.accent} strokeWidth="0.5" />
```

- [ ] **Step 4: Update corner brackets**

```jsx
/* BEFORE */
<g key={i} stroke="#00f5ff" strokeWidth="1.5" opacity="0.3">

/* AFTER */
<g key={i} stroke={tc.accent} strokeWidth="1.5" opacity="0.3">
```

- [ ] **Step 5: Update tour path strokes**

```jsx
/* BEFORE */
<path d={tourPathD} stroke="rgba(0,245,255,0.15)" strokeWidth="8" fill="none" />
<path
  d={tourPathD}
  stroke="#00f5ff" strokeWidth="2" fill="none"
  ...
/>

/* AFTER */
<path d={tourPathD} stroke={tc.accent + '26'} strokeWidth="8" fill="none" />
<path
  d={tourPathD}
  stroke={tc.accent} strokeWidth="2" fill="none"
  ...
/>
```

Note: `'26'` appended to a 6-digit hex gives ~15% opacity (0x26 = 38 / 255 ≈ 15%).

- [ ] **Step 6: Update city dots**

```jsx
/* BEFORE */
<circle cx={city.x} cy={city.y} r="14" fill="none" stroke="#00f5ff" strokeWidth="0.5" opacity="0.3">

<circle
  cx={city.x} cy={city.y} r="6"
  fill={inTour ? '#00f5ff' : '#004a55'}
  stroke="#00f5ff" strokeWidth="1.5"
>
  {!inTour && (
    <animate attributeName="fill" values="#004a55;#00a0b0;#004a55" ... />
  )}
</circle>

<text ... fill="#00f5ff" ...>

/* AFTER */
<circle cx={city.x} cy={city.y} r="14" fill="none" stroke={tc.accent} strokeWidth="0.5" opacity="0.3">

<circle
  cx={city.x} cy={city.y} r="6"
  fill={inTour ? tc.accent : tc.cityIdle}
  stroke={tc.accent} strokeWidth="1.5"
>
  {!inTour && (
    <animate attributeName="fill" values={tc.cityIdleAnim} ... />
  )}
</circle>

<text ... fill={tc.accent} ...>
```

- [ ] **Step 7: Update empty state text and circle**

```jsx
/* BEFORE */
<text ... fill="#00f5ff" ...>CLICK TO PLACE CITIES</text>
<text ... fill="#00f5ff" ...>or use random city generator →</text>
<circle ... stroke="#00f5ff" ...>

/* AFTER */
<text ... fill={tc.accent} ...>CLICK TO PLACE CITIES</text>
<text ... fill={tc.accent} ...>or use random city generator →</text>
<circle ... stroke={tc.accent} ...>
```

- [ ] **Step 8: Update the vignette gradient**

```jsx
/* BEFORE */
<stop offset="100%" stopColor="rgba(0,0,0,0.6)" />

/* AFTER */
<stop offset="100%" stopColor={tc.vignette} />
```

- [ ] **Step 9: Verify in browser**

Toggle between dark and light mode. The canvas SVG elements (grid, cities, tour path, empty state) should switch colors alongside the sidebar. Place a few cities and run an algorithm to verify the tour path and traveling dot look correct in both modes.

- [ ] **Step 10: Commit**

```bash
git add src/components/Canvas.jsx
git commit -m "feat: adapt Canvas SVG colors to theme prop"
```

---

## Task 4: Fix Tailwind white-opacity classes in `ControlPanel` and `StatsPanel`

These Tailwind utilities (`border-white/5`, `bg-white/5`) are invisible on light backgrounds and must be replaced with CSS variable equivalents.

**Files:**
- Modify: `src/components/ControlPanel.jsx`
- Modify: `src/components/StatsPanel.jsx`

- [ ] **Step 1: Fix keyboard hints border in `ControlPanel.jsx`**

```jsx
/* BEFORE — line 156 */
<div className="text-xs text-gray-600 font-mono border-t border-white/5 pt-2 flex gap-3">

/* AFTER */
<div className="text-xs font-mono pt-2 flex gap-3" style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border-divider)' }}>
```

- [ ] **Step 2: Fix keyboard hint key labels in `ControlPanel.jsx`**

```jsx
/* BEFORE */
<span><span className="text-gray-400">SPC</span> play/pause</span>
<span><span className="text-gray-400">R</span> reset</span>
<span><span className="text-gray-400">C</span> clear</span>

/* AFTER */
<span><span style={{ color: 'var(--accent-cyan)' }}>SPC</span> play/pause</span>
<span><span style={{ color: 'var(--accent-cyan)' }}>R</span> reset</span>
<span><span style={{ color: 'var(--accent-cyan)' }}>C</span> clear</span>
```

- [ ] **Step 3: Fix `StatRow` divider border in `StatsPanel.jsx`**

```jsx
/* BEFORE */
function StatRow({ label, value, unit, color = '#00f5ff', pulse = false }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5">

/* AFTER */
function StatRow({ label, value, unit, color = 'var(--accent-cyan)', pulse = false }) {
  return (
    <div className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-divider)' }}>
```

- [ ] **Step 4: Fix label color in `StatsPanel.jsx`**

```jsx
/* BEFORE */
<span className="text-xs text-gray-500 font-mono tracking-wider">{label}</span>

/* AFTER */
<span className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</span>
```

- [ ] **Step 5: Fix temperature gauge track in `StatsPanel.jsx`**

```jsx
/* BEFORE */
<div className="h-2 bg-white/5 rounded overflow-hidden">

/* AFTER */
<div className="h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
```

- [ ] **Step 6: Fix chart divider border in `StatsPanel.jsx`**

```jsx
/* BEFORE */
<motion.div
  className="mt-3 border-t border-white/5 pt-3"

/* AFTER */
<motion.div
  className="mt-3 pt-3"
  style={{ borderTop: '1px solid var(--border-divider)' }}
```

- [ ] **Step 7: Verify in browser**

Toggle to light mode. Check:
- ControlPanel keyboard hint row has a visible divider line
- StatsPanel stat rows have visible divider lines between them
- Temperature gauge track is visible in light mode
- Chart section has a visible top border

- [ ] **Step 8: Fix speed-btn inline styles in `ControlPanel.jsx`**

The unselected speed button uses `rgba(255,255,255,0.35)` for text and `rgba(255,255,255,0.08)` for border — both invisible on a light background. Replace with CSS variable references:

```jsx
/* BEFORE */
style={{
  background: speed === s.id ? 'rgba(0,245,255,0.12)' : 'transparent',
  color: speed === s.id ? '#00f5ff' : 'rgba(255,255,255,0.35)',
  borderColor: speed === s.id ? '#00f5ff' : 'rgba(255,255,255,0.08)',
}}

/* AFTER */
style={{
  background: speed === s.id ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)' : 'transparent',
  color: speed === s.id ? 'var(--accent-cyan)' : 'var(--text-dim)',
  borderColor: speed === s.id ? 'var(--accent-cyan)' : 'var(--border-divider)',
}}
```

- [ ] **Step 9: Fix scrollbar inline style in `App.jsx`**

In the scrollable sidebar panel `<div>` (the one with `flex-1 overflow-y-auto`):

```jsx
/* BEFORE */
style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,245,255,0.12) transparent' }}

/* AFTER */
style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in srgb, var(--accent-cyan) 12%, transparent) transparent' }}
```

- [ ] **Step 10: Commit**

```bash
git add src/components/ControlPanel.jsx src/components/StatsPanel.jsx src/App.jsx
git commit -m "feat: replace white-opacity Tailwind classes with theme tokens"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run the dev server if not already running**

```bash
npm run dev
```

- [ ] **Step 2: Verify dark mode (default on first load)**

- Toggle button shows `☀ LIGHT`
- Background is `#07070f` (very dark)
- Sidebar is dark
- Cards have dark background with cyan border glow
- Canvas grid, cities, and tour path are cyan
- All labels, stat rows, keyboard hints are visible

- [ ] **Step 3: Verify light mode**

Click `☀ LIGHT`. Check:
- Toggle button now shows `◑ DARK`
- Background changes to `#f0f2f5` (light gray)
- Sidebar changes to light gray
- Cards have white background with muted cyan border
- Canvas grid and cities use `#007a85` (dark teal)
- Labels and stat rows are readable dark text
- Keyboard hint divider and stat row dividers are visible

- [ ] **Step 4: Verify persistence**

- Switch to light mode, then reload the page — it should reload in light mode
- Switch back to dark mode, reload — it should reload in dark mode

- [ ] **Step 5: Verify algorithm run**

- Place 8 cities (use random generator)
- Run Nearest Neighbor in both dark and light mode
- Confirm tour path, traveling dot, and explored edges all render correctly in both themes

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: no errors. Fix any that appear.

- [ ] **Step 7: Commit final state**

```bash
git add -A
git commit -m "feat: complete light/dark mode theme toggle"
```
