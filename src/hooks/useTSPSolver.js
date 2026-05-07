import { useState, useRef, useCallback, useEffect } from 'react';
import { nearestNeighborSolver } from '../algorithms/nearestNeighbor.js';
import { twoOptSolver } from '../algorithms/twoOpt.js';
import { simulatedAnnealingSolver } from '../algorithms/simulatedAnnealing.js';
import { geneticSolver } from '../algorithms/genetic.js';
import { bruteForceSolver } from '../algorithms/bruteForce.js';
import { branchAndBoundSolver } from '../algorithms/branchAndBound.js';
import { tourDistance } from '../algorithms/utils.js';

const ALGORITHM_MAP = {
  nearestNeighbor: nearestNeighborSolver,
  twoOpt: twoOptSolver,
  simulatedAnnealing: simulatedAnnealingSolver,
  genetic: geneticSolver,
  bruteForce: bruteForceSolver,
  branchAndBound: branchAndBoundSolver,
};

const SPEED_CONFIG = {
  slow:    { delay: 250, stepsPerTick: 1 },
  medium:  { delay: 45,  stepsPerTick: 1 },
  fast:    { delay: 8,   stepsPerTick: 3 },
  instant: { delay: 4,   stepsPerTick: 60 },
};

const INITIAL_STATE = {
  tour: [], bestTour: [], distance: Infinity, currentDistance: Infinity,
  exploredEdges: [], iteration: 0, temperature: null, initialTemp: null,
  generation: null, distHistory: [], tempHistory: [],
  permutationsChecked: null, totalPermutations: null,
  phase: 'idle', complete: false, elapsed: 0, improved: false,
};

export function useTSPSolver() {
  const [cities, setCities] = useState([]);
  const [algorithm, setAlgorithmState] = useState('nearestNeighbor');
  const [speed, setSpeed] = useState('medium');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [solverState, setSolverState] = useState(INITIAL_STATE);
  const [logs, setLogs] = useState([]);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [toast, setToast] = useState(null);

  const genRef = useRef(null);
  const startTimeRef = useRef(null);
  const intervalRef = useRef(null);
  const algorithmRef = useRef(algorithm);
  const speedRef = useRef(speed);
  const prevBestRef = useRef(Infinity);
  const isRunningRef = useRef(false);

  useEffect(() => { algorithmRef.current = algorithm; }, [algorithm]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const addLog = useCallback((message, type = 'info') => {
    const time = new Date().toISOString().split('T')[1].slice(0, 12);
    setLogs(prev => [...prev.slice(-59), { message, type, time, id: Date.now() + Math.random() }]);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const stopInterval = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const tick = useCallback(() => {
    if (!genRef.current) return;
    const cfg = SPEED_CONFIG[speedRef.current];
    let lastValue = null;

    for (let s = 0; s < cfg.stepsPerTick; s++) {
      const result = genRef.current.next();
      const value = result.value;

      if (result.done || value?.complete) {
        stopInterval();
        setIsRunning(false);
        setIsPaused(false);
        isRunningRef.current = false;
        if (value) {
          setSolverState(prev => ({
            ...prev, ...value,
            phase: 'complete', complete: true,
            elapsed: Date.now() - startTimeRef.current,
          }));
          const dist = value.distance;
          if (dist && dist < Infinity) {
            const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(2);
            showToast(`Tour found: ${dist.toFixed(1)} units in ${elapsed}s`, 'success');
            addLog(`COMPLETE — best distance: ${dist.toFixed(2)} | time: ${elapsed}s`, 'success');
          }
        }
        return;
      }

      if (value) {
        lastValue = value;
        if (value.distance < prevBestRef.current - 0.1) {
          prevBestRef.current = value.distance;
          addLog(`↓ New best: ${value.distance.toFixed(2)} @ iter ${value.iteration || value.generation || 0}`, 'improvement');
        }
      }
    }

    if (lastValue) {
      setSolverState(prev => ({
        ...prev, ...lastValue,
        elapsed: Date.now() - startTimeRef.current,
      }));
    }
  }, [addLog, showToast, stopInterval]);

  const startInterval = useCallback(() => {
    stopInterval();
    const { delay } = SPEED_CONFIG[speedRef.current];
    intervalRef.current = setInterval(tick, delay);
  }, [tick, stopInterval]);

  const start = useCallback(() => {
    if (cities.length < 2) { addLog('ERROR: Need at least 2 cities', 'error'); return; }
    if (algorithmRef.current === 'bruteForce' && cities.length > 10) {
      addLog('ERROR: Brute force limited to 10 cities max', 'error');
      showToast('Brute force: max 10 cities', 'error');
      return;
    }
    if (algorithmRef.current === 'branchAndBound' && cities.length > 12) {
      addLog('ERROR: Branch & Bound limited to 12 cities max', 'error');
      showToast('Branch & Bound: max 12 cities', 'error');
      return;
    }

    stopInterval();
    genRef.current = ALGORITHM_MAP[algorithmRef.current](cities);
    startTimeRef.current = Date.now();
    prevBestRef.current = Infinity;

    setSolverState({ ...INITIAL_STATE, phase: 'running' });
    setIsRunning(true);
    setIsPaused(false);
    isRunningRef.current = true;
    addLog(`INIT — algorithm: ${algorithmRef.current} | cities: ${cities.length}`, 'system');
  }, [cities, addLog, showToast, stopInterval]);

  useEffect(() => {
    if (isRunning) startInterval();
    return stopInterval;
  }, [isRunning, startInterval, stopInterval]);

  useEffect(() => {
    if (isRunning) {
      stopInterval();
      startInterval();
    }
  }, [speed]); // eslint-disable-line

  const pause = useCallback(() => {
    if (!isRunning) return;
    stopInterval();
    setIsRunning(false);
    setIsPaused(true);
    isRunningRef.current = false;
    addLog('PAUSED', 'system');
  }, [isRunning, stopInterval, addLog]);

  const resume = useCallback(() => {
    if (!isPaused || !genRef.current) return;
    setIsRunning(true);
    setIsPaused(false);
    isRunningRef.current = true;
    addLog('RESUMED', 'system');
  }, [isPaused, addLog]);

  const reset = useCallback(() => {
    stopInterval();
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    isRunningRef.current = false;
    setSolverState(INITIAL_STATE);
    addLog('RESET', 'system');
  }, [stopInterval, addLog]);

  const addCity = useCallback((city) => {
    if (isRunningRef.current) return;
    setCities(prev => {
      if (prev.length >= 20) return prev;
      return [...prev, city];
    });
  }, []);

  const clearCities = useCallback(() => {
    if (isRunningRef.current) return;
    stopInterval();
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setCities([]);
    setSolverState(INITIAL_STATE);
    setComparisonResults(null);
    addLog('CLEARED', 'system');
  }, [stopInterval, addLog]);

  const generateRandom = useCallback((count) => {
    if (isRunningRef.current) return;
    stopInterval();
    genRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    const margin = 80;
    const newCities = Array.from({ length: count }, () => ({
      x: Math.random() * (1000 - margin * 2) + margin,
      y: Math.random() * (700 - margin * 2) + margin,
    }));
    setCities(newCities);
    setSolverState(INITIAL_STATE);
    setComparisonResults(null);
    addLog(`GENERATED — ${count} random cities`, 'system');
  }, [stopInterval, addLog]);

  const setAlgorithm = useCallback((algo) => {
    if (isRunningRef.current) return;
    setAlgorithmState(algo);
    setSolverState(INITIAL_STATE);
    genRef.current = null;
    addLog(`ALGORITHM — switched to ${algo}`, 'system');
  }, [addLog]);

  const clearComparison = useCallback(() => {
    setComparisonResults(null);
  }, []);

  const runComparison = useCallback(() => {
    if (cities.length < 2 || isRunningRef.current) return;
    setIsComparing(true);
    addLog('COMPARISON — running all algorithms...', 'system');

    setTimeout(() => {
      const results = {};
      for (const [name, solverFn] of Object.entries(ALGORITHM_MAP)) {
        const cityLimit = name === 'bruteForce' ? 10 : name === 'branchAndBound' ? 12 : Infinity;
        if (cities.length > cityLimit) {
          results[name] = { distance: null, time: null, skipped: true, tour: [] };
          addLog(`  ${name}: SKIPPED (${cities.length} cities > ${cityLimit})`, 'warn');
          continue;
        }
        const t0 = Date.now();
        const gen = solverFn([...cities]);
        let lastValue = null;
        let r = gen.next();
        while (!r.done) { if (r.value) lastValue = r.value; r = gen.next(); }
        if (r.value) lastValue = r.value;
        const elapsed = Date.now() - t0;
        const dist = lastValue?.distance ?? Infinity;
        results[name] = { distance: dist, time: elapsed, tour: lastValue?.tour ?? [], skipped: false };
        addLog(`  ${name}: ${dist.toFixed(2)} units in ${elapsed}ms`, 'info');
      }
      setComparisonResults(results);
      setIsComparing(false);
      addLog('COMPARISON DONE', 'success');
    }, 10);
  }, [cities, addLog]);

  return {
    cities, algorithm, speed, isRunning, isPaused, solverState,
    logs, comparisonResults, isComparing, toast,
    addCity, clearCities, generateRandom,
    setAlgorithm, setSpeed, start, pause, resume, reset, runComparison, clearComparison,
  };
}
