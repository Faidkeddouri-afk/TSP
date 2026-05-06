# Light Mode Feature — Design Spec

**Date:** 2026-05-06  
**Project:** TSP Visualizer  
**Status:** Approved

---

## Overview

Add a light/dark theme toggle to the TSP Visualizer. Light mode preserves the cyberpunk aesthetic using muted cyan accents on light gray/white backgrounds. The toggle button lives in the sidebar header and persists the user's preference to `localStorage`.

---

## Approach

CSS custom properties (Option A). A `data-theme` attribute on `<html>` switches between two palettes defined in `index.css`. All CSS classes and inline styles reference tokens instead of hardcoded colors. A single `useState` in `App.jsx` drives the toggle.

---

## Color Tokens

| Token              | Dark                      | Light                      |
|--------------------|---------------------------|----------------------------|
| `--bg-app`         | `#07070f`                 | `#f0f2f5`                  |
| `--bg-sidebar`     | `rgba(8,8,17,0.98)`       | `rgba(240,242,248,0.98)`   |
| `--bg-card`        | `rgba(11,11,20,0.9)`      | `rgba(255,255,255,0.85)`   |
| `--border-cyan`    | `rgba(0,245,255,0.1)`     | `rgba(0,180,200,0.2)`      |
| `--accent-cyan`    | `#00f5ff`                 | `#007a85`                  |
| `--text-dim`       | `rgba(255,255,255,0.4)`   | `rgba(0,0,0,0.5)`          |
| `--text-label`     | `rgba(0,245,255,0.5)`     | `rgba(0,120,140,0.8)`      |
| `--grid-line`      | `rgba(0,245,255,0.025)`   | `rgba(0,150,180,0.06)`     |

---

## Toggle Button

- Location: sidebar header, right of "MISSION CONTROL v1.0" label
- Dark mode label: `☀ LIGHT`
- Light mode label: `◑ DARK`
- Styled with `--accent-cyan` and `--border-cyan` tokens
- Font: JetBrains Mono, matching existing header style

---

## State Management

- `useState('dark')` in `App.jsx`
- On mount: read `localStorage.getItem('theme')`, default to `'dark'`
- On toggle: update state, set `document.documentElement.setAttribute('data-theme', newTheme)`, write to `localStorage`
- Pass `theme` as prop only to `Canvas` (SVG attributes need explicit values)

---

## Files Changed

### `src/index.css`
- Add `[data-theme="dark"]` and `[data-theme="light"]` blocks with all token definitions
- Update `body` background from hardcoded `#07070f` to `var(--bg-app)`
- Update `.card`, `.label-text`, `.algo-btn`, `.city-btn`, `.ctrl-btn`, `.speed-btn`, scrollbar rules to use tokens

### `src/App.jsx`
- Add theme state and `localStorage` persistence
- Set `data-theme` on `document.documentElement`
- Add toggle button to sidebar header
- Pass `theme` prop to `Canvas`
- Replace hardcoded `background: '#07070f'` on root div with `var(--bg-app)`
- Replace hardcoded grid background rgba with `var(--grid-line)`

### `src/components/Canvas.jsx`
- Accept `theme` prop
- Replace hardcoded SVG fill/stroke values for: grid lines, corner brackets, city dots, tour path, empty state text — with `theme === 'light' ? lightValue : darkValue`

### No changes needed
`ControlPanel`, `StatsPanel`, `AlgorithmInfo`, `LogPanel`, `Toast`, `ComparisonTable` — inherit via CSS cascade.

---

## Out of Scope

- System `prefers-color-scheme` auto-detection
- Per-component theme overrides
- Animation or transition between themes (beyond what CSS provides naturally)
