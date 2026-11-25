/**
 * Tiny synthesized sound engine (Web Audio, no assets).
 * The AudioContext is created lazily on the first user gesture.
 */

type Hum = {
  osc: OscillatorNode;
  sub: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private hum: Hum | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  /** Must be called from inside a user gesture (pointerdown / keydown). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopCharge();
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  private out() {
    if (this.muted || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, out: this.master, t: this.ctx.currentTime };
  }

  private noise(ctx: AudioContext) {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private tone(
    freq: number,
    { delay = 0, dur = 0.3, vol = 0.15, type = "sine" as OscillatorType } = {},
  ) {
    const o = this.out();
    if (!o) return;
    const { ctx, out } = o;
    const t = o.t + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Rising hum while the button is held. */
  startCharge() {
    const o = this.out();
    if (!o) return;
    this.stopCharge();
    const { ctx, out, t } = o;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 7;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 90;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 180;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(out);
    osc.start(t);
    sub.start(t);
    this.hum = { osc, sub, filter, gain };
  }

  setCharge(c: number) {
    if (!this.hum || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.hum.osc.frequency.setTargetAtTime(90 + 260 * c, t, 0.05);
    this.hum.sub.frequency.setTargetAtTime(180 + 540 * c, t, 0.05);
    this.hum.filter.frequency.setTargetAtTime(700 + 2800 * c, t, 0.05);
  }

  stopCharge() {
    if (!this.hum || !this.ctx) return;
    const t = this.ctx.currentTime;
    const h = this.hum;
    this.hum = null;
    h.gain.gain.cancelScheduledValues(t);
    h.gain.gain.setValueAtTime(h.gain.gain.value, t);
    h.gain.gain.linearRampToValueAtTime(0, t + 0.06);
    h.osc.stop(t + 0.08);
    h.sub.stop(t + 0.08);
  }

  /** Thumb flick + air rush on release. */
  whoosh(power: number) {
    const o = this.out();
    if (!o) return;
    const { ctx, out, t } = o;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2400 + 2200 * power, t + 0.16);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 + 0.25 * power, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(bp).connect(g).connect(out);
    src.start(t);
    src.stop(t + 0.6);
    this.tone(2100, { dur: 0.08, vol: 0.12, type: "triangle" });
  }

  /** Metallic ring when the coin lands. */
  clink(intensity = 1) {
    const partials = [2637, 3951, 5274, 6645];
    partials.forEach((f, i) =>
      this.tone(f * (0.985 + Math.random() * 0.03), {
        dur: 0.55 - i * 0.1,
        vol: (0.11 - i * 0.022) * intensity,
      }),
    );
  }

  select() {
    this.tone(1320, { dur: 0.07, vol: 0.06, type: "triangle" });
  }

  win() {
    [784, 988, 1175, 1568].forEach((f, i) =>
      this.tone(f, { delay: 0.05 + i * 0.075, dur: 0.45, vol: 0.12, type: "triangle" }),
    );
  }

  lose() {
    this.tone(392, { delay: 0.05, dur: 0.3, vol: 0.1, type: "triangle" });
    this.tone(294, { delay: 0.2, dur: 0.5, vol: 0.1, type: "triangle" });
  }
}

export const sound = new SoundEngine();
