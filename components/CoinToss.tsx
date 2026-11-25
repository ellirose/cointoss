"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Coin, COIN_TILT, type Side } from "./Coin";
import { Confetti } from "@/lib/confetti";
import { sound } from "@/lib/sound";

type Phase = "idle" | "charging" | "flying" | "result";
type Flip = { id: number; side: Side; call: Side; win: boolean };
type Stats = { tosses: number; wins: number; streak: number; best: number };

const STORAGE_KEY = "call-it:v1";
const HISTORY_MAX = 10;
const CHARGE_MS = 1300;
const BOUNCE_MS = 420;
const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const EMPTY_STATS: Stats = { tosses: 0, wins: 0, streak: 0, best: 0 };

const randomSide = (): Side => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] & 1 ? "heads" : "tails";
};

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function CoinToss() {
  const [guess, setGuess] = useState<Side | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [atMax, setAtMax] = useState(false);
  const [last, setLast] = useState<Flip | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [history, setHistory] = useState<Flip[]>([]);
  const [muted, setMuted] = useState(false);
  const [nudge, setNudge] = useState(0);
  const [landKey, setLandKey] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const appRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const wobbleRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const powerRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<Confetti | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const guessRef = useRef<Side | null>(null);
  const chargeRef = useRef(0);
  const rafRef = useRef(0);
  const pose = useRef({ y: 0, x: 0, scale: 1, angle: 0, wobble: 0 });

  guessRef.current = guess;

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /* ---------- rendering the coin pose (no React re-render per frame) ---------- */
  const render = useCallback(() => {
    const p = pose.current;
    const rad = (p.angle * Math.PI) / 180;
    if (liftRef.current)
      liftRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale})`;
    if (wobbleRef.current) wobbleRef.current.style.transform = `rotateZ(${p.wobble}deg)`;
    if (coinRef.current) {
      coinRef.current.style.transform = `rotateX(${p.angle + COIN_TILT}deg)`;
      coinRef.current.style.setProperty("--shine", (50 + 48 * Math.sin(rad * 1.5)).toFixed(1));
      coinRef.current.style.setProperty("--lit", (0.62 + 0.45 * Math.abs(Math.cos(rad))).toFixed(3));
    }
    if (shadowRef.current) {
      const k = Math.min(1, Math.max(0, -p.y) / 320);
      shadowRef.current.style.transform = `translateX(-50%) scale(${1 - k * 0.6})`;
      shadowRef.current.style.opacity = String(1 - k * 0.7);
    }
  }, []);

  const setCharge = (c: number) => {
    chargeRef.current = c;
    appRef.current?.style.setProperty("--charge", c.toFixed(3));
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(RING_C * (1 - c));
  };

  /* ---------- outcome ---------- */
  const finish = useCallback((side: Side, call: Side) => {
    const win = side === call;
    const flip: Flip = { id: Date.now(), side, call, win };
    setLast(flip);
    setHistory((h) => [flip, ...h].slice(0, HISTORY_MAX));
    setStats((s) => {
      const streak = win ? s.streak + 1 : 0;
      return { tosses: s.tosses + 1, wins: s.wins + (win ? 1 : 0), streak, best: Math.max(s.best, streak) };
    });
    go("result");
    if (win) {
      sound.win();
      vibrate([20, 40, 30]);
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) confettiRef.current?.burst(r.left + r.width / 2, r.top + r.height * 0.4);
    } else {
      sound.lose();
    }
  }, []);

  /* ---------- the toss ---------- */
  const launch = useCallback(
    (power: number) => {
      const call = guessRef.current;
      if (!call) return;
      go("flying");
      setAtMax(false);
      sound.whoosh(power);
      vibrate(12);

      const outcome = randomSide();
      // Fly as high as the viewport allows; when headroom is short, bring the
      // coin toward the camera (bigger scale) so the toss still feels big.
      const rect = anchorRef.current?.getBoundingClientRect();
      const size = rect?.height ?? 200;
      const room = (rect?.top ?? 400) - 12;
      const desired = 160 + 340 * power;
      let bump = 0.18;
      if (room - (bump * size) / 2 < desired) {
        bump = Math.min(0.55, 0.18 + ((desired - room) / desired) * 0.7);
      }
      const height = Math.max(60, Math.min(desired, room - (bump * size) / 2));
      const duration = 1000 + 1250 * power;
      const turns = 3 + Math.round(power * 8);

      const p = pose.current;
      const start = p.angle;
      const base = start - (((start % 360) + 360) % 360);
      const target = base + turns * 360 + (outcome === "tails" ? 180 : 0);
      const y0 = p.y;
      const s0 = p.scale;
      const t0 = performance.now();
      let landed = false;

      const step = (now: number) => {
        const e = now - t0;
        if (e < duration) {
          const t = e / duration;
          const spin = 1 - Math.pow(1 - t, 2);
          p.y = -height * 4 * t * (1 - t) + y0 * Math.max(0, 1 - t * 6);
          p.x = 0;
          p.scale = s0 + (1 - s0) * Math.min(1, t * 6) + bump * Math.sin(Math.PI * t);
          p.angle = start + (target - start) * spin;
          p.wobble = Math.sin(t * Math.PI * 4) * 7 * (1 - t);
          setCharge(power * (1 - t));
        } else if (e < duration + BOUNCE_MS) {
          if (!landed) {
            landed = true;
            setCharge(0);
            sound.clink(1);
            vibrate(25);
            setLandKey((k) => k + 1);
          }
          const u = (e - duration) / BOUNCE_MS;
          p.y = -height * 0.06 * 4 * u * (1 - u);
          p.scale = 1 - 0.07 * Math.sin(Math.PI * Math.min(1, u * 3)) * (1 - u);
          p.angle = target + Math.sin(u * Math.PI * 3) * 11 * (1 - u);
          p.wobble = Math.sin(u * Math.PI * 4) * 3 * (1 - u);
        } else {
          p.y = 0;
          p.scale = 1;
          p.wobble = 0;
          p.angle = outcome === "tails" ? 180 : 0;
          render();
          sound.clink(0.35);
          finish(outcome, call);
          return;
        }
        render();
        rafRef.current = requestAnimationFrame(step);
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);
    },
    [finish, render],
  );

  /* ---------- press & hold ---------- */
  const startCharge = useCallback(() => {
    const ph = phaseRef.current;
    if (ph === "charging" || ph === "flying") return;
    sound.unlock();
    if (!guessRef.current) {
      setNudge((n) => n + 1);
      vibrate([10, 30, 10]);
      return;
    }
    go("charging");
    setAtMax(false);
    sound.startCharge();
    const t0 = performance.now();
    let maxed = false;

    const step = (now: number) => {
      const raw = Math.min(1, (now - t0) / CHARGE_MS);
      const c = 1 - Math.pow(1 - raw, 2);
      setCharge(c);
      if (powerRef.current) powerRef.current.textContent = raw >= 1 ? "MAX" : `${Math.round(c * 100)}%`;
      const p = pose.current;
      const tremble = c * c;
      p.y = 7 * c + Math.sin(now / 37) * tremble * 1.5;
      p.x = Math.sin(now / 23) * tremble * 2.5;
      p.scale = 1 - 0.05 * c;
      p.wobble = Math.sin(now / 29) * tremble * 4;
      render();
      sound.setCharge(c);
      if (raw >= 1 && !maxed) {
        maxed = true;
        setAtMax(true);
        vibrate(15);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  }, [render]);

  const release = useCallback(() => {
    if (phaseRef.current !== "charging") return;
    cancelAnimationFrame(rafRef.current);
    sound.stopCharge();
    launch(Math.max(0.15, chargeRef.current));
  }, [launch]);

  const cancelCharge = useCallback(() => {
    if (phaseRef.current !== "charging") return;
    cancelAnimationFrame(rafRef.current);
    sound.stopCharge();
    Object.assign(pose.current, { y: 0, x: 0, scale: 1, wobble: 0 });
    render();
    setCharge(0);
    setAtMax(false);
    go("idle");
  }, [render]);

  const choose = useCallback((side: Side) => {
    const ph = phaseRef.current;
    if (ph === "charging" || ph === "flying") return;
    sound.unlock();
    sound.select();
    setGuess(side);
  }, []);

  /* ---------- effects ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.stats) setStats({ ...EMPTY_STATS, ...d.stats });
        if (Array.isArray(d.history)) setHistory(d.history.slice(0, HISTORY_MAX));
        if (typeof d.muted === "boolean") setMuted(d.muted);
        if (d.guess === "heads" || d.guess === "tails") setGuess(d.guess);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats, history, muted, guess }));
  }, [hydrated, stats, history, muted, guess]);

  useEffect(() => sound.setMuted(muted), [muted]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = new Confetti(canvasRef.current);
    confettiRef.current = c;
    render();
    return () => {
      c.destroy();
      cancelAnimationFrame(rafRef.current);
      sound.stopCharge();
    };
  }, [render]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) startCharge();
        return;
      }
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "h" || k === "arrowleft") choose("heads");
      else if (k === "t" || k === "arrowright") choose("tails");
      else if (k === "m") setMuted((m) => !m);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        release();
      }
    };
    const onBlur = () => cancelCharge();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", onBlur);
    };
  }, [startCharge, release, cancelCharge, choose]);

  /* ---------- view ---------- */
  const busy = phase === "charging" || phase === "flying";
  const ready = !!guess && (phase === "idle" || phase === "result");
  const winRate = stats.tosses ? Math.round((stats.wins / stats.tosses) * 100) : 0;

  let prompt = "";
  if (phase === "idle") prompt = guess ? `You're calling ${guess}. Hold to charge the toss.` : "Call it — heads or tails?";
  if (phase === "charging") prompt = atMax ? "Full power. Let it fly!" : "Release to toss";
  if (phase === "flying") prompt = "In the air…";

  const resetStats = () => {
    setStats(EMPTY_STATS);
    setHistory([]);
    setLast(null);
    if (phaseRef.current === "result") go("idle");
  };

  return (
    <div
      ref={appRef}
      className="app"
      data-phase={phase}
      data-outcome={phase === "result" && last ? (last.win ? "win" : "lose") : undefined}
      style={{ "--charge": 0 } as CSSProperties}
    >
      <canvas ref={canvasRef} className="confetti" aria-hidden="true" />

      <div className="bg" aria-hidden="true">
        <div className="bg__glow bg__glow--top" />
        <div className="bg__glow bg__glow--left" />
        <div className="bg__noise" />
        {phase === "result" && last && (
          <div key={last.id} className={`bg__flash bg__flash--${last.win ? "win" : "lose"}`} />
        )}
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" />
          <span className="brand__name">Call It</span>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            title={muted ? "Unmute (M)" : "Mute (M)"}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <path d="m22 9-6 6M16 9l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <section className="stage">
        <div className="stage__spot" aria-hidden="true" />
        <div className="stage__floor" aria-hidden="true" />
        <div className="coin-anchor" ref={anchorRef}>
          <div className={`coin-float${busy ? " is-paused" : ""}`}>
            <div className="coin-lift" ref={liftRef}>
              <div className="coin-wobble" ref={wobbleRef}>
                <Coin ref={coinRef} />
              </div>
            </div>
          </div>
          <div className="coin-shadow" ref={shadowRef} aria-hidden="true" />
          {landKey > 0 && <span key={landKey} className="shockwave" aria-hidden="true" />}
        </div>
      </section>

      <section className="hud">
        <div className="status" aria-live="polite">
          {phase === "result" && last ? (
            <div key={last.id} className={`verdict verdict--${last.win ? "win" : "lose"}`}>
              <span className="verdict__eyebrow">It landed</span>
              <h2 className="verdict__side">{cap(last.side)}</h2>
              <p className="verdict__note">
                {last.win
                  ? stats.streak > 1
                    ? `You called it — ${stats.streak} in a row`
                    : "You called it"
                  : `You called ${last.call}. Not this time.`}
              </p>
            </div>
          ) : (
            <p key={prompt} className="status__prompt">
              {prompt}
            </p>
          )}
        </div>

        <div
          key={nudge}
          className={`picker${nudge ? " is-nudged" : ""}${busy ? " is-locked" : ""}`}
          data-guess={guess ?? "none"}
          role="group"
          aria-label="Your call"
        >
          <span className="picker__thumb" aria-hidden="true" />
          {(["heads", "tails"] as const).map((side) => (
            <button
              key={side}
              type="button"
              className="picker__opt"
              aria-pressed={guess === side}
              disabled={busy}
              onClick={() => choose(side)}
            >
              <span className={`picker__glyph picker__glyph--${side}`}>{side === "heads" ? "H" : "T"}</span>
              {side}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`hold${phase === "charging" ? " is-charging" : ""}${atMax ? " is-max" : ""}${ready ? " is-ready" : ""}${!guess ? " is-disabled" : ""}`}
          aria-label="Press and hold to charge, release to toss"
          aria-disabled={!guess || phase === "flying"}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            startCharge();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        >
          <svg className="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff1c4" />
                <stop offset="0.5" stopColor="#f2c46d" />
                <stop offset="1" stopColor="#d9902f" />
              </linearGradient>
            </defs>
            <circle className="hold__track" cx="60" cy="60" r={RING_R} />
            <circle
              ref={ringRef}
              className="hold__progress"
              cx="60"
              cy="60"
              r={RING_R}
              strokeDasharray={RING_C}
              style={{ strokeDashoffset: RING_C }}
            />
          </svg>
          <span className="hold__core">
            {phase === "charging" ? (
              <span key="charging" className="hold__stack">
                <span className="hold__label hold__label--power" ref={powerRef} />
                <span className="hold__sub">release</span>
              </span>
            ) : phase === "flying" ? (
              <span key="flying" className="hold__dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <span key="rest" className="hold__stack">
                <span className="hold__label">{guess ? (phase === "result" ? "Again" : "Hold") : "Pick"}</span>
                <span className="hold__sub">{guess ? "to toss" : "a side"}</span>
              </span>
            )}
          </span>
        </button>

        <p className="hint">
          <kbd>H</kbd> / <kbd>T</kbd> to call · hold <kbd>Space</kbd> to toss
        </p>
      </section>

      <footer className="stats">
        <dl className="stats__grid">
          <div className="stat">
            <dt>Tosses</dt>
            <dd>{stats.tosses}</dd>
          </div>
          <div className="stat">
            <dt>Win rate</dt>
            <dd>
              {winRate}
              <small>%</small>
            </dd>
          </div>
          <div className="stat">
            <dt>Streak</dt>
            <dd className={stats.streak > 1 ? "is-hot" : undefined}>{stats.streak}</dd>
          </div>
          <div className="stat">
            <dt>Best</dt>
            <dd>{stats.best}</dd>
          </div>
        </dl>
        <div className="history">
          <div className="history__chips" aria-label="Recent tosses">
            {history.map((f) => (
              <span
                key={f.id}
                className={`chip chip--${f.win ? "win" : "lose"}`}
                title={`${cap(f.side)} — you called ${f.call} (${f.win ? "win" : "loss"})`}
              >
                {f.side === "heads" ? "H" : "T"}
              </span>
            ))}
            {Array.from({ length: HISTORY_MAX - history.length }, (_, i) => (
              <span key={`empty-${i}`} className="chip chip--empty" />
            ))}
          </div>
          <button type="button" className="text-btn" onClick={resetStats} disabled={busy || stats.tosses === 0}>
            Reset
          </button>
        </div>
      </footer>
    </div>
  );
}
