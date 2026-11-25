/** Lightweight canvas confetti, no dependencies. */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  flip: number;
  vf: number;
  w: number;
  h: number;
  color: string;
  life: number;
  ttl: number;
  round: boolean;
};

const COLORS = ["#fff1c4", "#f7d987", "#f2c46d", "#e3a73f", "#7ee2a8", "#b9a6ff", "#ffffff"];

export class Confetti {
  private ctx: CanvasRenderingContext2D;
  private parts: Particle[] = [];
  private raf = 0;
  private last = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
  };

  burst(x: number, y: number, count = 150) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
      const speed = 5 + Math.random() * 11;
      this.parts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        flip: Math.random() * Math.PI * 2,
        vf: 0.08 + Math.random() * 0.2,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 0,
        ttl: 90 + Math.random() * 70,
        round: Math.random() < 0.25,
      });
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    const dt = Math.min(3, (now - this.last) / 16.667);
    this.last = now;
    const { ctx, dpr } = this;
    const H = window.innerHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.parts = this.parts.filter((p) => p.life < p.ttl && p.y < H + 40);
    for (const p of this.parts) {
      p.life += dt;
      p.vy += 0.28 * dt;
      p.vx *= Math.pow(0.985, dt);
      p.vy *= Math.pow(0.985, dt);
      p.x += p.vx * dt + Math.sin(p.flip) * 0.6;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;

      const fade = Math.min(1, (p.ttl - p.life) / 30);
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (this.parts.length) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.raf = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
  }
}
