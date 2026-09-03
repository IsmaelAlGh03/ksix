import { useEffect, useRef, useState } from 'react';

const NODES = [
  { x: 110, y: 24 },
  { x: 196, y: 72 },
  { x: 196, y: 142 },
  { x: 110, y: 190 },
  { x: 24, y: 142 },
  { x: 24, y: 72 },
];

const LINKS = NODES.flatMap((from, i) => NODES.slice(i + 1).map((to) => ({ from, to })));

const DOTS = 3;
const TRIP_MS = 1400;
const REDUCED = '(prefers-reduced-motion: reduce)';

interface Trip {
  from: { x: number; y: number };
  to: { x: number; y: number };
  start: number;
}

function nextTrip(start: number): Trip {
  const link = LINKS[Math.floor(Math.random() * LINKS.length)] ?? LINKS[0]!;
  const flip = Math.random() < 0.5;

  return { from: flip ? link.to : link.from, to: flip ? link.from : link.to, start };
}

export function MeshMark(): JSX.Element {
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const [moving, setMoving] = useState(() => !window.matchMedia(REDUCED).matches);

  useEffect(() => {
    const query = window.matchMedia(REDUCED);
    const sync = (): void => setMoving(!query.matches);

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!moving) return;

    const now = performance.now();
    const trips = Array.from({ length: DOTS }, (_, index) => nextTrip(now - index * (TRIP_MS / DOTS)));
    let frame = 0;

    const step = (time: number): void => {
      trips.forEach((trip, index) => {
        let travelled = (time - trip.start) / TRIP_MS;
        if (travelled >= 1) {
          trips[index] = nextTrip(time);
          travelled = 0;
        }

        const { from, to } = trips[index]!;
        const dot = dots.current[index];
        if (dot === null || dot === undefined) return;

        dot.setAttribute('cx', String(from.x + (to.x - from.x) * travelled));
        dot.setAttribute('cy', String(from.y + (to.y - from.y) * travelled));
        dot.setAttribute('opacity', String(Math.sin(travelled * Math.PI) * 0.9 + 0.1));
      });

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [moving]);

  return (
    <svg viewBox="0 0 220 214" aria-hidden="true" className="w-full max-w-[320px] text-ink">
      <g
        data-links
        stroke="currentColor"
        strokeWidth="1.2"
        opacity={moving ? '0.32' : '0.85'}
        className="transition-opacity duration-500"
      >
        {LINKS.map(({ from, to }) => (
          <line
            key={`${from.x},${from.y}-${to.x},${to.y}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
          />
        ))}
      </g>

      {moving && (
        <g fill="currentColor">
          {Array.from({ length: DOTS }, (_, index) => (
            <circle
              key={index}
              data-dot
              ref={(node) => {
                dots.current[index] = node;
              }}
              r="3.4"
              cx={NODES[0]!.x}
              cy={NODES[0]!.y}
              opacity="0"
            />
          ))}
        </g>
      )}

      <g fill="currentColor">
        {NODES.map((node) => (
          <circle key={`${node.x},${node.y}`} data-node cx={node.x} cy={node.y} r="7" />
        ))}
      </g>
    </svg>
  );
}
