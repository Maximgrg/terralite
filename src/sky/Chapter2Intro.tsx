// src/sky/Chapter2Intro.tsx — the Chapter II opening cinematic.
// A single canvas plays the whole thing: the Warden resting in a meadow one
// month after the Slime King, a light that falls out of nowhere, the lift-off,
// the climb through the clouds, and the landing on the first sky island.

import { useEffect, useRef, useState } from "react";
import { audio } from "../audio";
import { initSprites, getSprite } from "../sprites";
import { tc } from "./skyI18n";

const T_BEAM = 5.0;
const T_LIFT = 8.6;
const T_ABOVE = 13.4;
const T_ISLES = 15.2;
const T_LAND = 18.4;
const T_TOUCH = 21.0;
const T_RELIEF = 21.6;
const T_END = 25.0;

type Stage = "rest" | "light" | "rise" | "clouds" | "land" | "relief" | "done";

function seg(t: number, a: number, b: number): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}
function ease(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

interface Mote { x: number; y: number; v: number; s: number; a: number; }

export default function Chapter2Intro({ onBegin, onSkip }: { onBegin: () => void; onSkip: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const skipRef = useRef(false);
  const [stage, setStage] = useState<Stage>("rest");

  useEffect(() => {
    initSprites();
    audio.ensure();
    audio.setTrack("menu");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(320, Math.min(1400, Math.round(r.width)));
      canvas.height = Math.max(240, Math.round(r.height));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const motes: Mote[] = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.02 + Math.random() * 0.06,
      s: 1 + Math.random() * 3,
      a: 0.2 + Math.random() * 0.6,
    }));
    const dust: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    startRef.current = performance.now();
    let lastStage: Stage = "rest";

    const draw = (now: number) => {
      const W = canvas.width;
      const H = canvas.height;
      let t = (now - startRef.current) / 1000;
      if (skipRef.current) t = Math.max(t, T_RELIEF + 0.4);

      // ---- stage bookkeeping (drives the text overlay)
      const st: Stage =
        t < T_BEAM ? "rest"
          : t < T_LIFT ? "light"
            : t < T_ABOVE ? "rise"
              : t < T_LAND ? "clouds"
                : t < T_RELIEF ? "land"
                  : t < T_END ? "relief" : "done";
      if (st !== lastStage) {
        lastStage = st;
        setStage(st);
        if (st === "light") audio.playSfx("torch");
        if (st === "rise") audio.playSfx("bossSpawn");
        if (st === "land") audio.playSfx("land");
        if (st === "relief") audio.playSfx("levelup");
      }

      const beamP = seg(t, T_BEAM, T_LIFT);
      const liftP = ease(seg(t, T_LIFT, T_ABOVE));
      const climbP = ease(seg(t, T_ABOVE, T_LAND));
      const islesP = seg(t, T_ISLES, T_LAND);
      const landP = ease(seg(t, T_LAND, T_TOUCH));
      const journey = Math.min(1, liftP * 0.55 + climbP * 0.45);

      // ---------------------------------------------------------------- sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      // ground-level warm afternoon -> high, cold, bright aether
      const lerp = (a: number, b: number, p: number) => Math.round(a + (b - a) * p);
      const topC = [lerp(96, 24, journey), lerp(158, 74, journey), lerp(226, 196, journey)];
      const midC = [lerp(168, 108, journey), lerp(206, 176, journey), lerp(240, 246, journey)];
      const botC = [lerp(214, 196, journey), lerp(232, 226, journey), lerp(246, 255, journey)];
      g.addColorStop(0, `rgb(${topC[0]},${topC[1]},${topC[2]})`);
      g.addColorStop(0.55, `rgb(${midC[0]},${midC[1]},${midC[2]})`);
      g.addColorStop(1, `rgb(${botC[0]},${botC[1]},${botC[2]})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // sun
      const sunX = W * 0.78;
      const sunY = H * (0.2 + journey * 0.12);
      const sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
      sg.addColorStop(0, "rgba(255,250,215,0.95)");
      sg.addColorStop(1, "rgba(255,250,215,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
      ctx.fillStyle = "#fffbe0";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
      ctx.fill();

      // ------------------------------------------------------------ clouds
      // Cloud bands scroll DOWN as the journey goes up.
      const cloudBand = (bandIndex: number, baseY: number, scale: number, alpha: number) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        const drift = (t * 12 * (0.3 + bandIndex * 0.2)) % (W + 400);
        const y = baseY + journey * H * (1.5 + bandIndex * 1.2);
        if (y < -120 || y > H + 160) { ctx.globalAlpha = 1; return; }
        for (let i = -1; i < 5; i++) {
          const x = ((i * 340 + drift + bandIndex * 120) % (W + 400)) - 200;
          const s = scale;
          ctx.fillRect(x, y, 30 * s, 6 * s);
          ctx.fillRect(x + 6 * s, y - 5 * s, 19 * s, 7 * s);
          ctx.fillRect(x + 13 * s, y - 9 * s, 9 * s, 6 * s);
          ctx.fillStyle = "rgba(186,208,236,0.7)";
          ctx.fillRect(x, y + 6 * s, 30 * s, 3 * s);
          ctx.fillStyle = "#ffffff";
        }
        ctx.globalAlpha = 1;
      };
      cloudBand(0, H * 0.12, 2.2, 0.85);
      cloudBand(1, H * -0.28, 3.0, 0.9);
      cloudBand(2, H * -0.75, 4.0, 0.95);

      // -------------------------------------------------------- sky islands
      if (islesP > 0) {
        ctx.globalAlpha = islesP;
        const isle = (cx: number, cy: number, rw: number, col: string, grassCol: string) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(cx - rw, cy);
          ctx.lineTo(cx + rw, cy);
          ctx.lineTo(cx + rw * 0.35, cy + rw * 0.5);
          ctx.lineTo(cx, cy + rw * 0.95);
          ctx.lineTo(cx - rw * 0.4, cy + rw * 0.45);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = grassCol;
          ctx.fillRect(cx - rw, cy - rw * 0.12, rw * 2, rw * 0.14);
        };
        const drift = journey * H * 0.9;
        isle(W * 0.16, H * 0.30 + drift * 0.4, 70, "#7d89a4", "#7fe3c0");
        isle(W * 0.84, H * 0.18 + drift * 0.3, 52, "#8d99b4", "#8ff0cf");
        isle(W * 0.62, H * 0.44 + drift * 0.5, 38, "#96a3bd", "#7fe3c0");
        ctx.globalAlpha = 1;
      }

      // -------------------------------------------------------------- ground
      // The meadow slides off the bottom of the frame as he rises.
      const groundY = H * 0.80 + journey * H * 2.4;
      if (groundY < H + 220) {
        // distant hills
        ctx.fillStyle = "#4f8f5c";
        ctx.beginPath();
        ctx.moveTo(0, groundY + 6);
        for (let x = 0; x <= W; x += 16) {
          ctx.lineTo(x, groundY - 26 + Math.sin(x * 0.009) * 20 + Math.sin(x * 0.03) * 7);
        }
        ctx.lineTo(W, H + 300);
        ctx.lineTo(0, H + 300);
        ctx.closePath();
        ctx.fill();
        // meadow
        ctx.fillStyle = "#3f7d2c";
        ctx.fillRect(0, groundY, W, H + 300 - groundY);
        ctx.fillStyle = "#5fae3a";
        ctx.fillRect(0, groundY, W, 10);
        ctx.fillStyle = "#7fce52";
        for (let x = 0; x < W; x += 7) {
          const sway = Math.sin(t * 2 + x * 0.05) * 2;
          ctx.fillRect(x + sway, groundY - 5, 2, 6);
        }
        ctx.fillStyle = "#8a5a32";
        ctx.fillRect(0, groundY + 12, W, H + 300 - groundY);
        ctx.fillStyle = "#5fae3a";
        ctx.fillRect(0, groundY, W, 12);
        // a tree he was sitting under
        const tx = W * 0.22;
        ctx.fillStyle = "#523319";
        ctx.fillRect(tx - 9, groundY - 96, 18, 96);
        ctx.fillStyle = "#2c6320";
        ctx.beginPath();
        ctx.arc(tx, groundY - 116, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3f8f2f";
        ctx.beginPath();
        ctx.arc(tx - 16, groundY - 126, 38, 0, Math.PI * 2);
        ctx.arc(tx + 22, groundY - 108, 34, 0, Math.PI * 2);
        ctx.fill();
        // flowers
        ctx.fillStyle = "#ffd24a";
        for (let i = 0; i < 12; i++) {
          const fx = (i * 137) % W;
          ctx.fillRect(fx, groundY - 8, 3, 3);
        }
      }

      // --------------------------------------------------- landing platform
      let platformY = H + 400;
      if (landP > 0) {
        platformY = H * 1.4 - landP * (H * 0.62);
        const pw = W * 0.34;
        const pcx = W * 0.5;
        ctx.fillStyle = "#7d89a4";
        ctx.beginPath();
        ctx.moveTo(pcx - pw, platformY);
        ctx.lineTo(pcx + pw, platformY);
        ctx.lineTo(pcx + pw * 0.4, platformY + pw * 0.42);
        ctx.lineTo(pcx, platformY + pw * 0.8);
        ctx.lineTo(pcx - pw * 0.45, platformY + pw * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#b9c6de";
        ctx.fillRect(pcx - pw, platformY - 4, pw * 2, 10);
        ctx.fillStyle = "#7fe3c0";
        ctx.fillRect(pcx - pw, platformY - 10, pw * 2, 8);
        ctx.fillStyle = "#8ff0cf";
        for (let x = -pw; x < pw; x += 9) {
          const sway = Math.sin(t * 2.4 + x * 0.06) * 2;
          ctx.fillRect(pcx + x + sway, platformY - 15, 2, 6);
        }
        // glowing tree on the island
        const gx = pcx + pw * 0.55;
        ctx.fillStyle = "#5d5183";
        ctx.fillRect(gx - 6, platformY - 70, 12, 60);
        ctx.fillStyle = "#3f9c94";
        ctx.beginPath();
        ctx.arc(gx, platformY - 84, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7fe0d0";
        ctx.beginPath();
        ctx.arc(gx - 12, platformY - 92, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      // ------------------------------------------------------------- the beam
      const heroX = W * 0.44;
      let heroFeet: number;
      if (t < T_LIFT) heroFeet = groundY;
      else if (t < T_LAND) heroFeet = groundY + (H * 0.52 - groundY) * ease(seg(t, T_LIFT, T_ABOVE));
      else heroFeet = H * 0.52 + (platformY - H * 0.52) * landP;
      const hover = t > T_LIFT && t < T_TOUCH ? Math.sin(t * 2.2) * 9 : 0;
      heroFeet += hover;

      const beamAlive = t > T_BEAM && t < T_ABOVE + 1.4;
      if (beamAlive) {
        const fade = t > T_ABOVE ? 1 - seg(t, T_ABOVE, T_ABOVE + 1.4) : 1;
        const strength = (t < T_LIFT ? beamP : 1) * fade;
        const halfW = (26 + strength * 92) / 2;
        const bg = ctx.createLinearGradient(heroX, 0, heroX, heroFeet);
        bg.addColorStop(0, `rgba(255,252,225,${0.05 * strength})`);
        bg.addColorStop(0.55, `rgba(255,248,205,${0.32 * strength})`);
        bg.addColorStop(1, `rgba(255,255,255,${0.62 * strength})`);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(heroX - halfW * 0.35, 0);
        ctx.lineTo(heroX + halfW * 0.35, 0);
        ctx.lineTo(heroX + halfW, heroFeet + 6);
        ctx.lineTo(heroX - halfW, heroFeet + 6);
        ctx.closePath();
        ctx.fill();
        // pool of light on the grass
        if (t < T_LIFT + 1.2 && groundY < H + 100) {
          const pg = ctx.createRadialGradient(heroX, groundY, 2, heroX, groundY, halfW * 1.8);
          pg.addColorStop(0, `rgba(255,255,235,${0.7 * strength})`);
          pg.addColorStop(1, "rgba(255,255,235,0)");
          ctx.fillStyle = pg;
          ctx.fillRect(heroX - halfW * 2, groundY - halfW, halfW * 4, halfW * 2);
        }
        ctx.restore();

        // motes sucked upward inside the beam
        ctx.save();
        for (const m of motes) {
          m.y -= m.v * (0.4 + strength * 2.2) * 0.016 * 60;
          if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
          const mx = heroX + (m.x - 0.5) * halfW * 2.4;
          const my = m.y * H;
          ctx.globalAlpha = m.a * strength;
          ctx.fillStyle = "#fff6c8";
          ctx.fillRect(mx, my, m.s, m.s);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // ------------------------------------------------------------- the hero
      const spr = getSprite("player");
      const hHeight = 78;
      const lifting = t > T_LIFT && t < T_TOUCH;
      const tilt = lifting ? Math.sin(t * 1.6) * 0.12 : t > T_BEAM ? -0.05 * beamP : 0;
      ctx.save();
      ctx.translate(heroX, heroFeet);
      ctx.rotate(tilt);
      if (lifting) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const ag = ctx.createRadialGradient(0, -hHeight * 0.5, 4, 0, -hHeight * 0.5, hHeight);
        ag.addColorStop(0, "rgba(255,250,220,0.45)");
        ag.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = ag;
        ctx.fillRect(-hHeight, -hHeight * 1.6, hHeight * 2, hHeight * 2.2);
        ctx.restore();
      }
      if (spr) {
        const scale = hHeight / spr.height;
        const dw = spr.width * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr, 0, 0, spr.width, spr.height, -dw / 2, -hHeight, dw, hHeight);
      } else {
        // procedural stand-in, same silhouette as the in-game fallback
        const OL = "#241208";
        ctx.fillStyle = OL;
        ctx.fillRect(-11, -34, 10, 34);
        ctx.fillRect(1, -34, 10, 34);
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(-10, -33, 8, 32);
        ctx.fillRect(2, -33, 8, 32);
        ctx.fillStyle = OL;
        ctx.fillRect(-14, -62, 28, 30);
        ctx.fillStyle = "#3a78c8";
        ctx.fillRect(-12, -60, 24, 27);
        ctx.fillStyle = OL;
        ctx.fillRect(-11, -84, 22, 22);
        ctx.fillStyle = "#fbd9aa";
        ctx.fillRect(-9, -82, 18, 19);
        ctx.fillStyle = "#5a3a22";
        ctx.fillRect(-9, -83, 18, 7);
        ctx.fillStyle = "#1a2230";
        ctx.fillRect(3, -73, 4, 4);
      }
      ctx.restore();

      // landing dust
      if (t > T_TOUCH && t < T_TOUCH + 0.12 && dust.length === 0) {
        for (let i = 0; i < 24; i++) {
          const a = Math.PI + Math.random() * Math.PI;
          dust.push({ x: heroX, y: heroFeet, vx: Math.cos(a) * (60 + Math.random() * 180), vy: Math.sin(a) * 50, life: 1 });
        }
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.life -= 0.018;
        d.x += d.vx * 0.016;
        d.y += d.vy * 0.016;
        d.vy += 260 * 0.016;
        if (d.life <= 0) { dust.splice(i, 1); continue; }
        ctx.globalAlpha = d.life;
        ctx.fillStyle = "#dfe8ff";
        ctx.fillRect(d.x, d.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // the gear check — icons pop over his head, one by one
      if (t > T_RELIEF) {
        const icons = ["⛏️", "⚔️", "🔥"];
        ctx.textAlign = "center";
        ctx.font = "28px serif";
        icons.forEach((ic, i) => {
          const p = seg(t, T_RELIEF + i * 0.42, T_RELIEF + i * 0.42 + 0.5);
          if (p <= 0) return;
          ctx.globalAlpha = Math.min(1, p * 1.4);
          ctx.fillText(ic, heroX + (i - 1) * 46, heroFeet - hHeight - 26 - p * 12);
        });
        ctx.globalAlpha = 1;
      }

      // subtle vignette to sell the cinematic
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // opening fade-in
      if (t < 1.1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - t / 1.1})`;
        ctx.fillRect(0, 0, W, H);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  const caption =
    stage === "rest" ? { big: tc("in_month"), small: tc("in_rest") }
      : stage === "light" ? { big: "", small: tc("in_light") }
        : stage === "rise" ? { big: "", small: tc("in_rise") }
          : stage === "clouds" ? { big: "", small: tc("in_clouds") }
            : stage === "land" ? { big: "", small: tc("in_land") }
              : { big: "", small: tc("in_relief") };

  const finished = stage === "relief" || stage === "done";

  return (
    <div className="fixed inset-0 z-[220] overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />

      {/* caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center px-8 text-center">
        {caption.big && (
          <div key={caption.big} className="anim-rise title-gradient font-display text-4xl font-black drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)] sm:text-6xl">
            {caption.big}
          </div>
        )}
        {caption.small && (
          <p key={caption.small} className="anim-fade mt-3 max-w-2xl text-base text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-xl">
            {caption.small}
          </p>
        )}
      </div>

      {/* CTA once he has landed and checked his gear */}
      {finished && (
        <div className="anim-fade absolute inset-x-0 bottom-8 flex justify-center gap-3">
          <button
            onClick={onBegin}
            className="rounded-2xl bg-gradient-to-r from-sky-300 via-cyan-300 to-violet-400 px-10 py-4 text-lg font-black text-[#0b1020] shadow-[0_0_36px_rgba(120,200,255,0.6)] transition-transform hover:scale-105"
          >
            ▶ {tc("in_go")}
          </button>
        </div>
      )}

      {/* skip */}
      {!finished && (
        <button
          onClick={() => { skipRef.current = true; }}
          className="absolute bottom-6 right-6 rounded-lg border border-white/20 bg-black/45 px-4 py-2 text-xs text-white/60 backdrop-blur transition-colors hover:bg-white/10 hover:text-white/90"
        >
          {tc("in_skip")} ▸
        </button>
      )}
      <button
        onClick={onSkip}
        className="absolute left-6 top-6 rounded-lg border border-white/15 bg-black/45 px-4 py-2 text-xs text-white/55 backdrop-blur transition-colors hover:bg-white/10 hover:text-white/85"
      >
        ✕
      </button>
    </div>
  );
}
