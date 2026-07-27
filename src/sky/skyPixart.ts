// src/sky/skyPixart.ts — procedural 16x16 pixel-art for the Chapter II blocks.
// Deliberately mirrors the technique used by ../pixart.ts (noise fill + edge
// shading + speckled nuggets) so the sky tileset reads as the same game.

import { TEX } from "../pixart";
import {
  SKY_GRASS, SKY_DIRT, SKY_STONE, CLOUD, SKY_WOOD, SKY_LEAVES,
  AETHERITE, SUNSTONE, STORMCORE, VOIDSHARD,
  SKY_PLANK, LUMEN, SKY_GLASS, VOID_STONE, SKYFORGE, ALTAR,
} from "./skyWorld";

const PAL = {
  soil: ["#98a6c6", "#8a97b6", "#7d8aa8", "#a3b1d0", "#8492b2", "#909dbd"],
  grass: ["#7fe3c0", "#6ed3b0", "#8ff0cf", "#5cc0a0", "#78dcb9"],
  stone: ["#b9c6de", "#adbad3", "#a1aec8", "#c4d1e8", "#96a3bd", "#b3c0d8"],
  voidstone: ["#453f5c", "#3c3651", "#4e4767", "#332e47", "#484263"],
  wood: ["#8f7fb8", "#7d6ea4", "#9c8cc6", "#6b5d90", "#8779b0"],
  leaves: ["#7fe0d0", "#68ccbc", "#93ede0", "#54b4a6", "#7ad9c8"],
  plank: ["#a894d0", "#9584bc", "#b6a2de", "#8272a6", "#a08dc8"],
  cloud: ["#eef4ff", "#e2ebfa", "#f7fbff", "#d8e3f4", "#eaf1fd"],
  speckle: {
    aetherite: ["#5fd8ff", "#37bde8", "#a8ecff"],
    sunstone: ["#ffc44a", "#e8a022", "#ffeaa8"],
    stormcore: ["#b06bff", "#8a3ee0", "#dcb4ff"],
    voidshard: ["#ff5fd0", "#d42ba6", "#ffb0ea"],
  } as Record<string, string[]>,
};

function hash(x: number, y: number, s: number): number {
  let n = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function pick(arr: string[], x: number, y: number, s: number): string {
  return arr[Math.floor(hash(x, y, s) * arr.length) % arr.length];
}
function noiseFill(c: CanvasRenderingContext2D, pal: string[], seed: number, y0 = 0, y1 = TEX) {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < TEX; x++) {
      c.fillStyle = pick(pal, x, y, seed);
      c.fillRect(x, y, 1, 1);
    }
  }
}
function edgeShade(c: CanvasRenderingContext2D) {
  c.fillStyle = "rgba(0,0,0,0.16)";
  c.fillRect(0, TEX - 1, TEX, 1);
  c.fillRect(TEX - 1, 0, 1, TEX);
  c.fillStyle = "rgba(255,255,255,0.10)";
  c.fillRect(0, 0, TEX, 1);
}
function cracks(c: CanvasRenderingContext2D, seed: number, col: string) {
  c.strokeStyle = col;
  c.lineWidth = 1;
  const n = 1 + Math.floor(hash(seed, 3, 5) * 2);
  for (let i = 0; i < n; i++) {
    let x = 2 + Math.floor(hash(seed, i, 11) * 11);
    let y = 2 + Math.floor(hash(seed, i, 23) * 11);
    c.beginPath();
    c.moveTo(x, y);
    const steps = 2 + Math.floor(hash(seed, i, 31) * 3);
    for (let s = 0; s < steps; s++) {
      x += Math.round((hash(seed, i, s) - 0.5) * 6);
      y += Math.round((hash(seed, i, s + 9) - 0.5) * 6);
      c.lineTo(x, y);
    }
    c.stroke();
  }
}
function nuggets(c: CanvasRenderingContext2D, speckle: string[], seed: number, glow: boolean) {
  const blobs = 3 + Math.floor(hash(seed, 1, 7) * 3);
  for (let i = 0; i < blobs; i++) {
    const bx = 2 + Math.floor(hash(seed, i, 13) * 11);
    const by = 2 + Math.floor(hash(seed, i, 17) * 11);
    c.fillStyle = speckle[i % speckle.length];
    c.fillRect(bx, by, 1, 1);
    if (hash(seed, i, 19) > 0.4) c.fillRect(bx + 1, by, 1, 1);
    if (hash(seed, i, 29) > 0.5) c.fillRect(bx, by + 1, 1, 1);
    if (hash(seed, i, 39) > 0.6) c.fillRect(bx + 1, by + 1, 1, 1);
    c.fillStyle = glow ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)";
    c.fillRect(bx, by, 1, 1);
  }
}

function newCanvas(): { cv: HTMLCanvasElement; c: CanvasRenderingContext2D } {
  const cv = document.createElement("canvas");
  cv.width = TEX;
  cv.height = TEX;
  const c = cv.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  return { cv, c };
}

function build(id: number, variant: number): HTMLCanvasElement {
  const { cv, c } = newCanvas();
  const seed = id * 53 + variant * 131;
  switch (id) {
    case SKY_DIRT:
      noiseFill(c, PAL.soil, seed);
      c.fillStyle = "#6b7896";
      for (let i = 0; i < 4; i++) c.fillRect(Math.floor(hash(seed, i, 5) * 15), Math.floor(hash(seed, i, 9) * 15), 1, 1);
      edgeShade(c);
      break;
    case SKY_GRASS:
      noiseFill(c, PAL.soil, seed);
      noiseFill(c, PAL.grass, seed + 1, 0, 3);
      c.fillStyle = pick(PAL.grass, 0, 0, seed);
      for (let x = 0; x < TEX; x++) {
        if (hash(seed, x, 2) > 0.55) c.fillRect(x, 0, 1, 1);
        if (hash(seed, x, 5) > 0.72) c.fillRect(x, 3, 1, 1);
      }
      c.fillStyle = "rgba(120,255,225,0.35)";
      c.fillRect(0, 0, TEX, 1);
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillRect(0, 3, TEX, 1);
      edgeShade(c);
      break;
    case SKY_STONE:
      noiseFill(c, PAL.stone, seed);
      cracks(c, seed, "rgba(90,105,135,0.55)");
      edgeShade(c);
      break;
    case VOID_STONE:
      noiseFill(c, PAL.voidstone, seed);
      cracks(c, seed, "rgba(12,10,20,0.7)");
      c.fillStyle = "rgba(180,120,255,0.20)";
      for (let i = 0; i < 3; i++) c.fillRect(Math.floor(hash(seed, i, 21) * 15), Math.floor(hash(seed, i, 33) * 15), 1, 1);
      edgeShade(c);
      break;
    case CLOUD: {
      noiseFill(c, PAL.cloud, seed);
      c.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 8; i++) {
        const x = Math.floor(hash(seed, i, 3) * 13);
        const y = Math.floor(hash(seed, i, 7) * 13);
        c.fillRect(x, y, 3, 2);
      }
      c.fillStyle = "rgba(160,180,220,0.45)";
      c.fillRect(0, TEX - 2, TEX, 2);
      break;
    }
    case AETHERITE:
    case SUNSTONE:
    case STORMCORE:
    case VOIDSHARD: {
      const base = id === VOIDSHARD ? PAL.voidstone : PAL.stone;
      const key = id === AETHERITE ? "aetherite" : id === SUNSTONE ? "sunstone" : id === STORMCORE ? "stormcore" : "voidshard";
      noiseFill(c, base, seed);
      nuggets(c, PAL.speckle[key], seed + 9, id !== AETHERITE);
      if (id === SUNSTONE) {
        c.fillStyle = "rgba(255,200,90,0.18)";
        c.fillRect(0, 0, TEX, TEX);
      } else if (id === STORMCORE) {
        c.fillStyle = "rgba(170,100,255,0.16)";
        c.fillRect(0, 0, TEX, TEX);
      } else if (id === VOIDSHARD) {
        c.fillStyle = "rgba(255,90,210,0.14)";
        c.fillRect(0, 0, TEX, TEX);
      }
      edgeShade(c);
      break;
    }
    case SKY_WOOD: {
      noiseFill(c, PAL.wood, seed);
      c.fillStyle = "#5b4d80";
      for (let x = 1; x < TEX; x += 4) {
        c.fillRect(x, 0, 1, TEX);
        c.fillRect(x + 1, 0, 1, TEX);
      }
      c.fillStyle = "rgba(190,255,245,0.16)";
      c.fillRect(4, 0, 1, TEX);
      edgeShade(c);
      break;
    }
    case SKY_LEAVES: {
      noiseFill(c, PAL.leaves, seed);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(hash(seed, i, 3) * 15);
        const y = Math.floor(hash(seed, i, 7) * 15);
        c.clearRect(x, y, 1, 1);
        c.clearRect(x + 1, y, 1, 1);
      }
      c.fillStyle = "#d8fff6";
      for (let i = 0; i < 5; i++) c.fillRect(Math.floor(hash(seed, i, 41) * 15), Math.floor(hash(seed, i, 43) * 15), 1, 1);
      break;
    }
    case SKY_PLANK: {
      noiseFill(c, PAL.plank, seed);
      c.fillStyle = "rgba(0,0,0,0.28)";
      c.fillRect(0, 5, TEX, 1);
      c.fillRect(0, 10, TEX, 1);
      c.fillStyle = "#5f5188";
      c.fillRect(2, 2, 1, 1);
      c.fillRect(13, 7, 1, 1);
      c.fillRect(4, 12, 1, 1);
      edgeShade(c);
      break;
    }
    case SKY_GLASS:
      c.fillStyle = "rgba(160,225,255,0.30)";
      c.fillRect(0, 0, TEX, TEX);
      c.strokeStyle = "rgba(215,245,255,0.85)";
      c.strokeRect(0.5, 0.5, TEX - 1, TEX - 1);
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.fillRect(2, 2, 3, 1);
      c.fillRect(2, 2, 1, 4);
      break;
    case LUMEN: {
      const g = c.createRadialGradient(TEX / 2, TEX / 2, 1, TEX / 2, TEX / 2, TEX / 1.4);
      g.addColorStop(0, "#fff6d0");
      g.addColorStop(0.55, "#ffe08a");
      g.addColorStop(1, "#d9a63f");
      c.fillStyle = g;
      c.fillRect(0, 0, TEX, TEX);
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.fillRect(4, 4, 2, 2);
      c.fillRect(10, 9, 2, 2);
      c.strokeStyle = "rgba(130,90,20,0.45)";
      c.strokeRect(0.5, 0.5, TEX - 1, TEX - 1);
      break;
    }
    case SKYFORGE: {
      noiseFill(c, PAL.stone, seed);
      c.fillStyle = "#3a4258";
      c.fillRect(3, 6, 10, 9);
      const g = c.createLinearGradient(0, 6, 0, 15);
      g.addColorStop(0, "#9fe8ff");
      g.addColorStop(0.5, "#5fb8ff");
      g.addColorStop(1, "#b06bff");
      c.fillStyle = g;
      c.fillRect(4, 8, 8, 5);
      c.fillStyle = "#ffffff";
      c.fillRect(5, 8, 2, 1);
      c.fillStyle = "rgba(0,0,0,0.4)";
      c.fillRect(3, 5, 10, 1);
      c.fillStyle = "#d8e4ff";
      c.fillRect(2, 1, 12, 2);
      break;
    }
    case ALTAR: {
      noiseFill(c, PAL.voidstone, seed);
      c.fillStyle = "#6f5fa8";
      c.fillRect(2, 3, 12, 11);
      c.fillStyle = "#8f7fd0";
      c.fillRect(3, 4, 10, 9);
      const g = c.createRadialGradient(TEX / 2, 8, 1, TEX / 2, 8, 8);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, "#c9a8ff");
      g.addColorStop(1, "rgba(120,80,200,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, TEX, TEX);
      c.fillStyle = "#2a2340";
      c.fillRect(1, 14, 14, 2);
      break;
    }
    default:
      c.fillStyle = "#ff00ff";
      c.fillRect(0, 0, TEX, TEX);
  }
  return cv;
}

const cache = new Map<number, HTMLCanvasElement>();
export function skyTileTexture(id: number, variant: number): HTMLCanvasElement {
  const key = id * 100 + variant;
  let t = cache.get(key);
  if (!t) {
    t = build(id, variant);
    cache.set(key, t);
  }
  return t;
}

// ---- background walls seen through hollowed-out island interiors ----
const wallCache = new Map<number, HTMLCanvasElement>();
function dim(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * f);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * f);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * f);
  return `rgb(${r},${g},${b})`;
}
function buildWall(kind: "sky" | "void", variant: number): HTMLCanvasElement {
  const { cv, c } = newCanvas();
  const seed = (kind === "sky" ? 2200 : 2700) + variant * 17;
  if (kind === "sky") {
    noiseFill(c, PAL.stone.map((p) => dim(p, 0.5)), seed);
    cracks(c, seed, "rgba(30,40,60,0.5)");
  } else {
    noiseFill(c, PAL.voidstone.map((p) => dim(p, 0.55)), seed);
    cracks(c, seed, "rgba(10,8,16,0.6)");
  }
  return cv;
}
export function skyWallTexture(kind: "sky" | "void", variant: number): HTMLCanvasElement {
  const key = (kind === "sky" ? 0 : 1000) + variant;
  let t = wallCache.get(key);
  if (!t) {
    t = buildWall(kind, variant);
    wallCache.set(key, t);
  }
  return t;
}
