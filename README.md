# Call It — Heads or Tails

A tactile coin-toss game built with Next.js.

1. **Call it**: pick Heads or Tails.
2. **Hold** the button to charge the toss (longer hold = higher, faster flip).
3. **Release** to flip. The coin lands, then the outcome is revealed.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

Production: `npm run build && npm start`.

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Call heads / tails | Tap the picker | `H` / `T` (or ← / →) |
| Charge & toss | Press-and-hold, release | Hold `Space`, release |
| Mute | Speaker icon | `M` |

## How it works

- `components/CoinToss.tsx`: game state plus a `requestAnimationFrame` physics loop (parabolic arc, spin that settles on the result, landing bounce). Transforms are written straight to the DOM, so React doesn't re-render on every frame.
- `components/Coin.tsx`: CSS 3D coin (two SVG faces and stacked edge layers for thickness), with a moving specular sheen and angle-based lighting.
- `lib/sound.ts`: all sounds are synthesized with Web Audio (no audio files).
- `lib/confetti.ts`: dependency-free canvas confetti for wins.
- Results come from `crypto.getRandomValues`, decided when you release.
- Stats, streaks and recent history are kept in `localStorage`.
