import { useRef, useCallback, useMemo } from 'react';
import { distance } from '../algorithms/utils.js';

const W = 1000;
const H = 700;

function buildPathD(tour, cities, close = true) {
  if (!tour || tour.length < 2) return '';
  const pts = tour.map(i => cities[i]).filter(Boolean);
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  if (close) d += ' Z';
  return d;
}

export default function Canvas({ cities, tour, exploredEdges, onCityAdd, isRunning, theme }) {
  const tc = {
    accent:       theme === 'light' ? '#007a85' : '#00f5ff',
    cityIdle:     theme === 'light' ? '#c8eef2' : '#004a55',
    cityIdleAnim: theme === 'light' ? '#c8eef2;#7dd8e0;#c8eef2' : '#004a55;#00a0b0;#004a55',
    vignette:     theme === 'light' ? 'rgba(200,210,220,0.3)' : 'rgba(0,0,0,0.6)',
    scanline:     theme === 'light' ? 'rgba(0,0,0,0.035)' : 'rgba(0,0,0,0.04)',
  };
  const svgRef = useRef(null);

  const handleClick = useCallback((e) => {
    if (isRunning) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (svgPt.x < 10 || svgPt.x > W - 10 || svgPt.y < 10 || svgPt.y > H - 10) return;
    onCityAdd({ x: svgPt.x, y: svgPt.y });
  }, [isRunning, onCityAdd]);

  const tourPathD = useMemo(() => buildPathD(tour, cities), [tour, cities]);
  const tourKey = tour?.join(',') ?? '';

  const tourLength = useMemo(() => {
    if (!tour || tour.length < 2) return 0;
    let len = 0;
    for (let i = 0; i < tour.length; i++) {
      const a = cities[tour[i]], b = cities[tour[(i + 1) % tour.length]];
      if (a && b) len += distance(a, b);
    }
    return len;
  }, [tour, cities]);

  const approxStrokeDashArray = tourLength > 0 ? tourLength + ' 0' : undefined;

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg-app)' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        onClick={handleClick}
        style={{ cursor: isRunning ? 'not-allowed' : 'crosshair', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-city" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor={tc.vignette} />
          </radialGradient>
        </defs>

        {/* Grid */}
        <g opacity="0.035">
          {Array.from({ length: Math.ceil(W / 40) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * 40} y1={0} x2={i * 40} y2={H} stroke={tc.accent} strokeWidth="0.5" />
          ))}
          {Array.from({ length: Math.ceil(H / 40) + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 40} x2={W} y2={i * 40} stroke={tc.accent} strokeWidth="0.5" />
          ))}
        </g>

        {/* Corner brackets */}
        {[[10,10,1,1],[W-10,10,-1,1],[10,H-10,1,-1],[W-10,H-10,-1,-1]].map(([x,y,sx,sy], i) => (
          <g key={i} stroke={tc.accent} strokeWidth="1.5" opacity="0.3">
            <line x1={x} y1={y} x2={x + sx*25} y2={y} />
            <line x1={x} y1={y} x2={x} y2={y + sy*25} />
          </g>
        ))}

        {/* Explored edges */}
        {exploredEdges?.map(([a, b], i) => {
          const ca = cities[a], cb = cities[b];
          if (!ca || !cb) return null;
          return (
            <line key={i}
              x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y}
              stroke="#ffb700" strokeWidth="1" opacity="0.25"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Best tour path */}
        {tourPathD && (
          <>
            <path d={tourPathD} stroke={tc.accent + '26'} strokeWidth="8" fill="none" />
            <path
              d={tourPathD}
              stroke={tc.accent} strokeWidth="2" fill="none"
              filter="url(#glow-cyan)"
              style={{
                strokeDasharray: approxStrokeDashArray,
                animation: tour?.length > 2 ? 'dash 1.2s ease-in-out' : undefined,
              }}
            />
          </>
        )}

        {/* Traveling dot along tour */}
        {tourPathD && tour?.length > 1 && (
          <g filter="url(#glow-amber)">
            <circle r="9" fill="rgba(255,183,0,0.2)">
              <animateMotion key={tourKey} dur="4s" repeatCount="indefinite" path={tourPathD} rotate="auto" />
            </circle>
            <circle r="5" fill="#ffb700">
              <animateMotion key={tourKey + '_2'} dur="4s" repeatCount="indefinite" path={tourPathD} rotate="auto" />
            </circle>
          </g>
        )}

        {/* Cities */}
        {cities.map((city, i) => {
          const inTour = tour?.includes(i);
          return (
            <g key={i} filter="url(#glow-city)">
              {/* Outer pulse ring */}
              <circle cx={city.x} cy={city.y} r="14" fill="none" stroke={tc.accent} strokeWidth="0.5" opacity="0.3">
                <animate attributeName="r" values="10;18;10" dur="2.5s" begin={`${(i * 0.3) % 2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" begin={`${(i * 0.3) % 2}s`} repeatCount="indefinite" />
              </circle>
              {/* City dot */}
              <circle
                cx={city.x} cy={city.y} r="6"
                fill={inTour ? tc.accent : tc.cityIdle}
                stroke={tc.accent} strokeWidth="1.5"
              >
                {!inTour && (
                  <animate attributeName="fill" values={tc.cityIdleAnim} dur="2s" begin={`${(i * 0.4) % 2}s`} repeatCount="indefinite" />
                )}
              </circle>
              {/* Index label */}
              <text
                x={city.x + 9} y={city.y - 9}
                fill={tc.accent} fontSize="10" fontFamily="JetBrains Mono, monospace"
                opacity="0.9" style={{ userSelect: 'none' }}
              >
                {i}
              </text>
            </g>
          );
        })}

        {/* Vignette */}
        <rect width={W} height={H} fill="url(#vignette)" pointerEvents="none" />

        {/* Empty state hint */}
        {cities.length === 0 && (
          <g opacity="0.35" style={{ pointerEvents: 'none' }}>
            <text x={W / 2} y={H / 2 - 20} textAnchor="middle"
              fill={tc.accent} fontSize="14" fontFamily="Orbitron, monospace" fontWeight="700" letterSpacing="4">
              CLICK TO PLACE CITIES
            </text>
            <text x={W / 2} y={H / 2 + 8} textAnchor="middle"
              fill={tc.accent} fontSize="10" fontFamily="JetBrains Mono, monospace">
              or use random city generator →
            </text>
            <circle cx={W / 2} cy={H / 2 + 50} r="20" fill="none" stroke={tc.accent} strokeWidth="1" strokeDasharray="6 4" opacity="0.5">
              <animateTransform attributeName="transform" type="rotate" values={`0 ${W/2} ${H/2+50};360 ${W/2} ${H/2+50}`} dur="8s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${tc.scanline} 2px, ${tc.scanline} 4px)`,
        zIndex: 10,
      }} />
    </div>
  );
}
