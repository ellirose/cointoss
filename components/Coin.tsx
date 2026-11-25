import { forwardRef, type CSSProperties, type ReactNode } from "react";

export type Side = "heads" | "tails";

/** Resting camera tilt so the coin's thickness reads as 3D. */
export const COIN_TILT = 14;

const EDGE_LAYERS = 16;
const r2 = (n: number) => Math.round(n * 100) / 100;

const BEADS = Array.from({ length: 64 }, (_, i) => {
  const a = (i / 64) * Math.PI * 2;
  return { x: r2(100 + Math.cos(a) * 88.5), y: r2(100 + Math.sin(a) * 88.5) };
});

const STAR = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
  const rad = i % 2 === 0 ? 37 : 12.5;
  return `${r2(100 + Math.cos(a) * rad)},${r2(100 + Math.sin(a) * rad)}`;
}).join(" ");

const STAR_DOTS = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
  return { x: r2(100 + Math.cos(a) * 29), y: r2(100 + Math.sin(a) * 29) };
});

/** Draws its children three times (shadow, highlight, body) for a struck-metal emboss. */
function Relief({ id, children }: { id: string; children: ReactNode }) {
  return (
    <>
      <g transform="translate(1.2 1.7)" fill="#4a2f08" color="#4a2f08" opacity="0.55">
        {children}
      </g>
      <g transform="translate(-0.8 -1)" fill="#fff7dc" color="#fff7dc" opacity="0.7">
        {children}
      </g>
      <g fill={`url(#${id}-relief)`} color="#e8bb59">
        {children}
      </g>
    </>
  );
}

function Face({ side }: { side: Side }) {
  const id = `coin-${side}`;
  return (
    <svg className="coin__svg" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-metal`} cx="32%" cy="26%" r="88%">
          <stop offset="0" stopColor="#fff4cf" />
          <stop offset="0.18" stopColor="#f8dc8e" />
          <stop offset="0.45" stopColor="#e2b04f" />
          <stop offset="0.75" stopColor="#b27b25" />
          <stop offset="1" stopColor="#7c5214" />
        </radialGradient>
        <linearGradient id={`${id}-field`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#e5b95f" />
          <stop offset="0.5" stopColor="#cf9a3d" />
          <stop offset="1" stopColor="#a8731f" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="35%" cy="28%" r="60%">
          <stop offset="0" stopColor="#fff6d6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-relief`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c9" />
          <stop offset="0.55" stopColor="#f0c76a" />
          <stop offset="1" stopColor="#c08a30" />
        </linearGradient>
        <path id={`${id}-top`} d="M 34 100 A 66 66 0 0 1 166 100" />
        <path id={`${id}-bot`} d="M 25 100 A 75 75 0 0 0 175 100" />
      </defs>

      {/* Rim */}
      <circle cx="100" cy="100" r="100" fill={`url(#${id}-metal)`} />
      <circle cx="100" cy="100" r="95" fill="none" stroke="#fff1c4" strokeOpacity="0.35" />
      <g fill="#5a3a0c" opacity="0.45">
        {BEADS.map((b, i) => (
          <circle key={i} cx={b.x + 0.5} cy={b.y + 0.7} r="1.7" />
        ))}
      </g>
      <g fill="#fdeab0">
        {BEADS.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r="1.6" />
        ))}
      </g>

      {/* Recessed field */}
      <circle cx="100" cy="100" r="82" fill={`url(#${id}-field)`} />
      <circle cx="100" cy="100" r="82" fill={`url(#${id}-sheen)`} />
      <circle cx="100" cy="100" r="82" fill="none" stroke="#5a3a0c" strokeOpacity="0.45" strokeWidth="2" />
      <circle cx="100" cy="100" r="83.5" fill="none" stroke="#fff1c4" strokeOpacity="0.4" />

      <Relief id={id}>
        <text className="coin__legend">
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            FORTUNE · FAVORS · THE · BOLD
          </textPath>
        </text>
        <text className="coin__label">
          <textPath href={`#${id}-bot`} startOffset="50%" textAnchor="middle">
            {side === "heads" ? "HEADS" : "TAILS"}
          </textPath>
        </text>

        {side === "heads" ? (
          <g transform="translate(0 -5)">
            <path d="M60 124 L55 82 L78 100 L100 68 L122 100 L145 82 L140 124 Z" />
            <rect x="58" y="128" width="84" height="11" rx="2.5" />
            <circle cx="55" cy="78" r="5" />
            <circle cx="100" cy="63" r="6" />
            <circle cx="145" cy="78" r="5" />
          </g>
        ) : (
          <g>
            <circle cx="100" cy="100" r="47" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <polygon points={STAR} />
            {STAR_DOTS.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r="2.2" />
            ))}
          </g>
        )}
      </Relief>

      {/* Engraved details */}
      {side === "heads" ? (
        <g fill="#7a4f12" opacity="0.55" transform="translate(0 -5)">
          <circle cx="80" cy="133.5" r="2.3" />
          <circle cx="100" cy="133.5" r="2.8" />
          <circle cx="120" cy="133.5" r="2.3" />
        </g>
      ) : (
        <circle cx="100" cy="100" r="5" fill="#7a4f12" opacity="0.5" />
      )}
    </svg>
  );
}

export const Coin = forwardRef<HTMLDivElement>(function Coin(_props, ref) {
  return (
    <div className="coin" ref={ref} style={{ transform: `rotateX(${COIN_TILT}deg)` }}>
      <div className="coin__face coin__face--heads">
        <Face side="heads" />
        <div className="coin__shine" />
      </div>
      <div className="coin__face coin__face--tails">
        <Face side="tails" />
        <div className="coin__shine" />
      </div>
      {Array.from({ length: EDGE_LAYERS }, (_, i) => (
        <div
          key={i}
          className="coin__edge"
          style={{ "--i": i / (EDGE_LAYERS - 1) } as CSSProperties}
        />
      ))}
    </div>
  );
});
