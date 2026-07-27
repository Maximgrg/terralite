// src/sky/skyEngine.ts — CHAPTER II engine.
// Same feel as the Chapter I engine, but built for floating islands: an
// endless void below, gliding + double jump, an armor system with set bonuses,
// five new mobs, two mini-bosses and the Aetherarch finale.

import {
  AIR, TORCH, WORKBENCH, FURNACE, TILE, TILES, isSolid, ITEMS, RECIPES,
  getTile, setTile,
} from "../world";
import { Engine } from "../engine";
import { audio } from "../audio";
import { tileTexture, TEX } from "../pixart";
import { initSprites, getSprite } from "../sprites";
import { skyTileTexture, skyWallTexture } from "./skyPixart";
import {
  SKY_GRASS, SKY_STONE, SKY_WOOD, SKY_LEAVES, CLOUD, AETHERITE, SUNSTONE,
  STORMCORE, VOIDSHARD, VOID_STONE, LUMEN, SKYFORGE, ALTAR, SKY_TILE_IDS,
  SKY_RECIPES, SKY_QUESTS, ARMOR, WEAPON_FX, VOID_Y,
  generateSkyWorld, type SkyRecipe, type SkyStation, type SkyWorld, type ArmorSet,
} from "./skyWorld";

const REACH = 5;
const GRAVITY = 1500;
const JUMP_V = 560;
const MOVE_SPEED = 180;
const DAY_LEN = 150;
const HOTBAR = 10;
const INV_SIZE = 30;
const SAVE_KEY = "terralite_ch2_save_v1";
const UNLOCK_KEY = "terralite_ch2_unlocked";
const CH1_PREFIX = "terralite_save_v1_";

export type SkyBossId = "matriarch" | "titan" | "aetherarch";
type MobType = "sky_slime" | "wisp" | "harpy" | "golem" | "phantom" | SkyBossId;

function u8ToB64(arr: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode.apply(null, arr.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(s);
}
function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

export interface SkySlot { id: string; count: number; }
export interface SkyArmor { head: string | null; chest: string | null; legs: string | null; }

export interface SkyState {
  hp: number;
  maxHp: number;
  defense: number;
  selected: number;
  dayFrac: number;
  isNight: boolean;
  dayCount: number;
  questIndex: number;
  questDone: boolean;
  banner: { title: string; sub: string; key: number } | null;
  boss: { id: SkyBossId; hp: number; maxHp: number; rage: boolean } | null;
  mineProgress: number;
  inventory: (SkySlot | null)[];
  armor: SkyArmor;
  setBonus: ArmorSet | null;
  stations: { workbench: boolean; furnace: boolean; skyforge: boolean };
  craftable: string[];
  altitude: number;
  nearAltar: boolean;
  altarDX: number;
  canGlide: boolean;
  canDoubleJump: boolean;
  savedAt: number;
  playerTX: number;
  playerTY: number;
}

export interface SkyCallbacks {
  onState: (s: SkyState) => void;
  onGameOver: () => void;
  onVictory: () => void;
}

interface Mob {
  type: MobType;
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; hp: number; maxHp: number;
  facing: number; onGround: boolean; hitFlash: number; t: number;
  cd: number; phase: number; burn: number;
}
interface Shot { x: number; y: number; vx: number; vy: number; life: number; dmg: number; kind: "rock" | "bolt" | "feather"; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; }
interface FloatText { x: number; y: number; vy: number; life: number; text: string; color: string; }

const MOB_STATS: Record<MobType, { w: number; h: number; hp: number; dmg: number; fly: boolean }> = {
  sky_slime: { w: 30, h: 26, hp: 34, dmg: 10, fly: false },
  wisp: { w: 22, h: 22, hp: 28, dmg: 13, fly: true },
  harpy: { w: 32, h: 30, hp: 52, dmg: 17, fly: true },
  golem: { w: 40, h: 48, hp: 130, dmg: 24, fly: false },
  phantom: { w: 30, h: 34, hp: 74, dmg: 21, fly: true },
  matriarch: { w: 76, h: 58, hp: 1250, dmg: 26, fly: true },
  titan: { w: 88, h: 82, hp: 2300, dmg: 32, fly: false },
  aetherarch: { w: 84, h: 96, hp: 4200, dmg: 30, fly: true },
};

/** Tool/weapon colour ramp so every tier reads differently in the hand. */
const MAT: Record<string, { h: string; d: string; shaft: string; gem?: string }> = {
  wood: { h: "#c08a4e", d: "#7c5226", shaft: "#8a5a2c" },
  stone: { h: "#b4bac6", d: "#5c606c", shaft: "#7c5226" },
  copper: { h: "#f0933f", d: "#9c5018", shaft: "#7c5226" },
  iron: { h: "#eef2f8", d: "#8c93a3", shaft: "#5a3a22" },
  gold: { h: "#ffd23b", d: "#b8860b", shaft: "#5a3a22", gem: "#ff3b6d" },
  aether: { h: "#bff2ff", d: "#3fa8cf", shaft: "#5f5188", gem: "#5fd8ff" },
  sunsteel: { h: "#ffe9a8", d: "#d99a1f", shaft: "#6b5230", gem: "#ff8a2b" },
  storm: { h: "#e6cfff", d: "#7a3fc8", shaft: "#4a3f6b", gem: "#b06bff" },
  voidm: { h: "#ffc8f0", d: "#a02b80", shaft: "#2f2740", gem: "#ff5fd0" },
};
function matOf(id: string): { h: string; d: string; shaft: string; gem?: string } {
  if (id.startsWith("aether")) return MAT.aether;
  if (id.startsWith("sunsteel") || id.startsWith("sun_")) return MAT.sunsteel;
  if (id.startsWith("storm")) return MAT.storm;
  if (id.startsWith("void")) return MAT.voidm;
  return MAT[id.split("_")[0]] ?? MAT.wood;
}

const ARMOR_TINT: Record<ArmorSet, string> = {
  cloud: "#dfe8ff",
  sunsteel: "#ffcf5a",
  storm: "#c084ff",
  void: "#ff7fe0",
};

export class SkyEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: SkyCallbacks;
  private world!: SkyWorld;

  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private uiOpen = false;

  private camX = 0;
  private camY = 0;
  private viewW = 800;
  private viewH = 600;

  private keys: Record<string, boolean> = {};
  private mouseDown = false;
  private rightDown = false;
  private mouseTX = 0;
  private mouseTY = 0;
  private placeCd = 0;
  private placeMode = false;
  private jumpHeld = false;
  private jumpBuffer = 0;
  private jumpsLeft = 1;

  private px = 0;
  private py = 0;
  private pvx = 0;
  private pvy = 0;
  private pface = 1;
  private onGround = false;
  private hp = 140;
  private maxHp = 140;
  private invuln = 0;
  private regenT = 0;
  private hurtT = 0;
  private selected = 0;
  private inv: (SkySlot | null)[] = new Array(INV_SIZE).fill(null);
  private armor: SkyArmor = { head: null, chest: null, legs: null };
  private sunsteelApplied = false;
  private swingT = 0;
  private attackCd = 0;
  private walkT = 0;
  private gliding = false;
  private fallDistance = 0;

  private mineTX = -1;
  private mineTY = -1;
  private mineProg = 0;
  private mineSfxT = 0;

  private shakeX = 0;
  private shakeY = 0;

  private mobs: Mob[] = [];
  private shots: Shot[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];

  private dayFrac = 0.2;
  private dayCount = 1;
  private workbenchCount = 0;
  private furnaceCount = 0;
  private skyforgeCount = 0;
  private spawnT = 3;
  private moteTimer = 0;
  private gameover = false;
  private victory = false;

  private questIndex = 0;
  private mined: Record<string, number> = {};
  private killed: Record<string, number> = {};
  private banner: { title: string; sub: string; key: number } | null = null;
  private bannerT = 0;

  private stateT = 0;
  private frame = 0;
  private saveTimer = 5;
  private saveCounter = 0;
  private flying = false;
  private godMode = false;

  private glowSprite: HTMLCanvasElement | null = null;
  private lightBuf: HTMLCanvasElement | null = null;
  private lightImg: ImageData | null = null;
  private lightW = 0;
  private lightH = 0;
  private lightGrid: Float32Array | null = null;
  private lightTmp: Float32Array | null = null;
  private colTop: Int16Array | null = null;

  private recipes: SkyRecipe[] = [
    ...RECIPES.map((r) => ({ ...r, station: r.station as SkyStation })),
    ...SKY_RECIPES,
  ];

  constructor(canvas: HTMLCanvasElement, cb: SkyCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cb = cb;
  }

  // ------------------------------------------------------------- lifecycle
  static hasSave(): boolean {
    try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
  }
  static isUnlocked(): boolean {
    try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
  }
  static unlock() {
    try { localStorage.setItem(UNLOCK_KEY, "1"); } catch { /* ignore */ }
  }
  static wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }

  start(mode: "new" | "auto" = "auto") {
    if (mode === "new") SkyEngine.wipe();
    const save = mode === "auto" ? this.loadGame() : null;
    if (save) {
      this.applySave(save);
    } else {
      this.world = generateSkyWorld(1337);
      this.resetProgress();
      this.px = this.world.spawnX * TILE;
      this.py = this.world.spawnY * TILE;
      this.grantCarryOver();
    }
    this.camX = this.px - 400;
    this.camY = this.py - 300;
    this.attach();
    this.resize();
    this.buildGlowSprite();
    initSprites();
    audio.setTrack("day");
    this.running = true;
    this.last = performance.now();
    this.showBanner(save ? "Welcome back" : "THE AETHER", save ? `Day ${this.dayCount}` : "Do not look down");
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.saveGame();
    this.detach();
  }

  private resetProgress() {
    this.hp = 140;
    this.maxHp = 140;
    this.selected = 0;
    this.inv = new Array(INV_SIZE).fill(null);
    this.armor = { head: null, chest: null, legs: null };
    this.sunsteelApplied = false;
    this.dayFrac = 0.2;
    this.dayCount = 1;
    this.workbenchCount = 0;
    this.furnaceCount = 0;
    this.skyforgeCount = 0;
    this.questIndex = 0;
    this.mined = {};
    this.killed = {};
    this.gameover = false;
    this.victory = false;
    this.pvx = 0;
    this.pvy = 0;
    this.fallDistance = 0;
  }

  /** "He never unpacked" — pull the Chapter I inventory across. */
  private grantCarryOver() {
    let best: any = null;
    let bestScore = -1;
    try {
      for (const w of Engine.getWorldList()) {
        const raw = localStorage.getItem(CH1_PREFIX + w.id);
        if (!raw) continue;
        const d = JSON.parse(raw);
        const score = (d.victory ? 100 : 0) + (d.questIndex ?? 0);
        if (score > bestScore) { bestScore = score; best = d; }
      }
    } catch { /* ignore */ }
    if (best && Array.isArray(best.inv)) {
      for (const s of best.inv) {
        if (s && s.id && ITEMS[s.id]) this.addItem(s.id, s.count);
      }
      this.maxHp = Math.max(140, best.maxHp ?? 140);
      this.hp = this.maxHp;
    } else {
      // fresh start still deserves the Chapter I kit
      ["wood", "stone", "iron_bar", "gold_bar"].forEach((id) => this.addItem(id, 20));
      this.addItem("torch", 20);
      this.addItem("apple", 5);
      this.addItem("workbench", 1);
      this.addItem("furnace", 1);
    }
    // guarantee the gear the sky expects you to arrive with
    if (this.count("iron_pickaxe") === 0) this.addItem("iron_pickaxe", 1);
    if (this.count("iron_sword") === 0 && this.count("gold_sword") === 0) this.addItem("iron_sword", 1);
    if (this.count("torch") < 10) this.addItem("torch", 10);
  }

  // ------------------------------------------------------------- save/load
  private saveGame() {
    if (!this.world) return;
    this.saveCounter = (this.saveCounter + 1) % 100000;
    // Never persist a corpse: dying (especially into the void) would otherwise
    // reload you at 0 HP somewhere below the world and kill you again forever.
    const dead = this.gameover || this.hp <= 0 || this.py / TILE > VOID_Y - 2;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        tiles: u8ToB64(this.world.tiles),
        altarX: this.world.altarX,
        altarY: this.world.altarY,
        px: dead ? this.world.spawnX * TILE : this.px,
        py: dead ? this.world.spawnY * TILE : this.py,
        pface: this.pface,
        hp: dead ? this.maxHp : this.hp,
        maxHp: this.maxHp,
        selected: this.selected,
        inv: this.inv.map((s) => (s ? { id: s.id, count: s.count } : null)),
        armor: this.armor,
        sunsteelApplied: this.sunsteelApplied,
        dayFrac: this.dayFrac,
        dayCount: this.dayCount,
        workbenchCount: this.workbenchCount,
        furnaceCount: this.furnaceCount,
        skyforgeCount: this.skyforgeCount,
        questIndex: this.questIndex,
        mined: this.mined,
        killed: this.killed,
      }));
    } catch { /* storage full — ignore */ }
  }

  private loadGame(): any | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && d.tiles ? d : null;
    } catch { return null; }
  }

  private applySave(d: any) {
    this.world = generateSkyWorld(1337);
    const tiles = b64ToU8(d.tiles);
    if (tiles.length === this.world.tiles.length) this.world.tiles = tiles;
    this.world.altarX = d.altarX ?? this.world.altarX;
    this.world.altarY = d.altarY ?? this.world.altarY;
    this.maxHp = d.maxHp ?? 140;
    this.hp = d.hp > 0 ? d.hp : this.maxHp;
    this.px = typeof d.px === "number" ? d.px : this.world.spawnX * TILE;
    this.py = typeof d.py === "number" ? d.py : this.world.spawnY * TILE;
    // defensive: an old/corrupt save must never drop you into the void
    if (!isFinite(this.px) || !isFinite(this.py) || this.py / TILE > VOID_Y - 2 || this.py < 0) {
      this.px = this.world.spawnX * TILE;
      this.py = this.world.spawnY * TILE;
    }
    this.pface = d.pface ?? 1;
    this.selected = d.selected ?? 0;
    this.inv = (d.inv as (SkySlot | null)[]).map((s) => (s && s.id ? { id: s.id, count: s.count } : null));
    while (this.inv.length < INV_SIZE) this.inv.push(null);
    this.armor = d.armor ?? { head: null, chest: null, legs: null };
    this.sunsteelApplied = !!d.sunsteelApplied;
    this.dayFrac = d.dayFrac ?? 0.2;
    this.dayCount = d.dayCount ?? 1;
    this.workbenchCount = d.workbenchCount ?? 0;
    this.furnaceCount = d.furnaceCount ?? 0;
    this.skyforgeCount = d.skyforgeCount ?? 0;
    this.questIndex = d.questIndex ?? 0;
    this.mined = d.mined ?? {};
    this.killed = d.killed ?? {};
    this.victory = false;
    this.gameover = false;
    this.pvx = 0;
    this.pvy = 0;
    this.fallDistance = 0;
    this.jumpsLeft = this.maxJumps();
  }

  saveGameNow() { this.saveGame(); }

  // ------------------------------------------------------------- public API
  setUiOpen(b: boolean) { this.uiOpen = b; if (b) this.keys = {}; }
  setPaused(b: boolean) {
    this.paused = b;
    if (b) { this.keys = {}; this.mouseDown = false; this.rightDown = false; }
  }
  selectSlot(i: number) { if (i >= 0 && i < HOTBAR) this.selected = i; }
  setSelectedByDelta(d: number) {
    let s = (this.selected + d) % HOTBAR;
    if (s < 0) s += HOTBAR;
    this.selected = s;
  }
  setMoveLeft(p: boolean) { this.keys["KeyA"] = p; }
  setMoveRight(p: boolean) { this.keys["KeyD"] = p; }
  jumpNow() {
    if (this.flying) { this.keys["Space"] = true; return; }
    if (this.onGround || this.jumpsLeft > 0) this.doJump();
    else this.jumpBuffer = 0.18;
  }
  setJump(p: boolean) {
    if (p && !this.jumpHeld) this.jumpNow();
    this.jumpHeld = p;
    this.keys["Space"] = p;
  }
  togglePlaceMode(): boolean {
    this.placeMode = !this.placeMode;
    audio.playSfx("click");
    return this.placeMode;
  }
  getPlaceMode(): boolean { return this.placeMode; }
  getWorldForMinimap(): { w: number; h: number; tiles: Uint8Array } | null {
    return this.world ? { w: this.world.w, h: this.world.h, tiles: this.world.tiles } : null;
  }
  getPlayerTileX(): number { return Math.floor(this.px / TILE); }
  getPlayerTileY(): number { return Math.floor(this.py / TILE); }

  toggleFly(): boolean { this.flying = !this.flying; return this.flying; }
  toggleGod(): boolean { this.godMode = !this.godMode; return this.godMode; }
  getFly(): boolean { return this.flying; }
  getGod(): boolean { return this.godMode; }
  healFull() { this.hp = this.maxHp; }
  setDay() { this.dayFrac = 0.05; }
  setNight() { this.dayFrac = 0.55; }
  giveItem(id: string, n: number) { this.addItem(id, n); this.pushState(); this.saveGame(); }
  giveBestGear() {
    ["sky_wood", "sky_stone", "cloud", "aetherite_ore", "sunstone_ore", "storm_core", "void_shard",
      "aetherite_bar", "sunsteel_bar", "storm_alloy", "void_ingot", "feather", "glow_dust"]
      .forEach((id) => this.addItem(id, 40));
    ["void_pickaxe", "void_reaver", "storm_blade", "feather_cloak", "skyforge",
      "void_helm", "void_chest", "void_boots", "titan_heart", "wind_sigil"]
      .forEach((id) => this.addItem(id, 1));
    this.pushState();
    this.saveGame();
  }

  // ------------------------------------------------------------- inventory
  private count(id: string): number {
    let n = 0;
    for (const s of this.inv) if (s && s.id === id) n += s.count;
    return n;
  }
  private addItem(id: string, count: number): number {
    const max = ITEMS[id]?.max ?? 99;
    for (const s of this.inv) {
      if (count <= 0) break;
      if (s && s.id === id && s.count < max) {
        const add = Math.min(max - s.count, count);
        s.count += add;
        count -= add;
      }
    }
    for (let i = 0; i < this.inv.length; i++) {
      if (count <= 0) break;
      if (!this.inv[i]) {
        const add = Math.min(max, count);
        this.inv[i] = { id, count: add };
        count -= add;
      }
    }
    return count;
  }
  private removeItem(id: string, n: number): boolean {
    if (this.count(id) < n) return false;
    for (let i = this.inv.length - 1; i >= 0; i--) {
      const s = this.inv[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, n);
        s.count -= take;
        n -= take;
        if (s.count <= 0) this.inv[i] = null;
        if (n <= 0) break;
      }
    }
    return true;
  }
  private selectedSlot(): SkySlot | null { return this.inv[this.selected]; }

  swapSlots(a: number, b: number) {
    if (a < 0 || b < 0 || a >= INV_SIZE || b >= INV_SIZE || a === b) return;
    const sa = this.inv[a];
    const sb = this.inv[b];
    if (sa && sb && sa.id === sb.id) {
      const max = ITEMS[sa.id]?.max ?? 99;
      const move = Math.min(max - sb.count, sa.count);
      if (move > 0) {
        sb.count += move;
        sa.count -= move;
        if (sa.count <= 0) this.inv[a] = null;
      }
    } else {
      this.inv[a] = sb;
      this.inv[b] = sa;
    }
    audio.playSfx("click");
    this.pushState();
    this.saveGame();
  }

  // ------------------------------------------------------------- armor
  equipFromSlot(i: number) {
    const s = this.inv[i];
    if (!s) return;
    const def = ARMOR[s.id];
    if (!def) return;
    const prev = this.armor[def.slot];
    this.removeItem(s.id, 1);
    this.armor[def.slot] = s.id;
    if (prev) this.addItem(prev, 1);
    audio.playSfx("craft");
    this.applySetBonus();
    this.checkQuest();
    this.pushState();
    this.saveGame();
  }
  unequip(slot: "head" | "chest" | "legs") {
    const cur = this.armor[slot];
    if (!cur) return;
    this.armor[slot] = null;
    this.addItem(cur, 1);
    audio.playSfx("click");
    this.applySetBonus();
    this.pushState();
    this.saveGame();
  }
  private defense(): number {
    let d = 0;
    for (const id of [this.armor.head, this.armor.chest, this.armor.legs]) {
      if (id && ARMOR[id]) d += ARMOR[id].defense;
    }
    return d;
  }
  private setBonus(): ArmorSet | null {
    const h = this.armor.head && ARMOR[this.armor.head]?.set;
    const c = this.armor.chest && ARMOR[this.armor.chest]?.set;
    const l = this.armor.legs && ARMOR[this.armor.legs]?.set;
    return h && h === c && c === l ? (h as ArmorSet) : null;
  }
  private applySetBonus() {
    const wantSunsteel = this.setBonus() === "sunsteel";
    if (wantSunsteel && !this.sunsteelApplied) {
      this.maxHp += 40;
      this.hp = Math.min(this.maxHp, this.hp + 40);
      this.sunsteelApplied = true;
    } else if (!wantSunsteel && this.sunsteelApplied) {
      this.maxHp = Math.max(60, this.maxHp - 40);
      this.hp = Math.min(this.hp, this.maxHp);
      this.sunsteelApplied = false;
    }
  }
  private canGlide(): boolean { return this.count("feather_cloak") > 0; }
  private maxJumps(): number { return this.setBonus() === "storm" ? 2 : 1; }
  private moveMul(): number { return this.setBonus() === "cloud" ? 1.18 : 1; }
  private noFallDamage(): boolean { return this.setBonus() === "void"; }
  private lifeSteal(): number { return this.setBonus() === "void" ? 0.08 : 0; }

  // ------------------------------------------------------------- crafting
  getRecipes(): SkyRecipe[] { return this.recipes; }

  craft(recipeId: string) {
    const r = this.recipes.find((x) => x.id === recipeId);
    if (!r) return;
    if (!this.stationOk(r)) return;
    for (const ing of r.ing) if (this.count(ing.id) < ing.n) return;
    for (const ing of r.ing) this.removeItem(ing.id, ing.n);
    this.addItem(r.out, r.outCount);
    audio.playSfx("craft");
    this.float(this.px, this.py - 30, `+${r.outCount}`, "#ffe08a");
    this.checkQuest();
    this.pushState();
  }
  private stationOk(r: SkyRecipe): boolean {
    if (r.station === "none") return true;
    if (r.station === "workbench") return this.workbenchCount > 0;
    if (r.station === "furnace") return this.furnaceCount > 0;
    if (r.station === "skyforge") return this.skyforgeCount > 0;
    return true;
  }

  consume(id: string) {
    if (this.count(id) <= 0) return;
    const heal = id === "glowfruit" ? 40 : id === "apple" ? 25 : id === "rotten_flesh" ? 5 : 0;
    if (heal <= 0) return;
    this.removeItem(id, 1);
    this.hp = Math.min(this.maxHp, this.hp + heal);
    audio.playSfx("pickup");
    this.float(this.px, this.py - 30, `+${heal} HP`, "#7fff8f");
    this.pushState();
  }

  // ------------------------------------------------------------- summons
  useSummon(id: string) {
    if (this.count(id) <= 0) return;
    if (this.bossActive()) return;
    if (id === "talon_whistle") {
      this.removeItem(id, 1);
      this.spawnBoss("matriarch");
    } else if (id === "titan_call") {
      this.removeItem(id, 1);
      this.spawnBoss("titan");
    } else if (id === "storm_horn") {
      if (!this.nearAltar()) {
        this.showBanner("Storm Altar", "The Horn only answers there");
        return;
      }
      this.removeItem(id, 1);
      this.spawnBoss("aetherarch");
    }
    this.pushState();
  }
  private nearAltar(): boolean {
    const dx = Math.abs(this.px / TILE - this.world.altarX);
    const dy = Math.abs(this.py / TILE - this.world.altarY);
    return dx < 12 && dy < 10;
  }
  private bossActive(): boolean {
    return this.mobs.some((m) => m.type === "matriarch" || m.type === "titan" || m.type === "aetherarch");
  }
  private isNightNow(): boolean { return Math.sin(this.dayFrac * Math.PI * 2) < 0; }

  private spawnBoss(id: SkyBossId) {
    const st = MOB_STATS[id];
    this.mobs.push({
      type: id,
      x: this.px + (id === "titan" ? 120 : 0),
      y: this.py - (st.fly ? 150 : 60),
      vx: 0, vy: 0,
      w: st.w, h: st.h, hp: st.hp, maxHp: st.hp,
      facing: -1, onGround: false, hitFlash: 0, t: 0,
      cd: 2.5, phase: 0, burn: 0,
    });
    audio.playSfx("bossSpawn");
    audio.setTrack("boss");
    this.showBanner(
      id === "matriarch" ? "THE MATRIARCH DESCENDS" : id === "titan" ? "THE TITAN AWAKENS" : "THE FIRST STORM",
      id === "aetherarch" ? "It has been waiting" : "Destroy it!",
    );
    this.shakeX = 12;
    this.shakeY = 8;
  }

  // ------------------------------------------------------------- input
  private kd!: (e: KeyboardEvent) => void;
  private ku!: (e: KeyboardEvent) => void;
  private mm!: (e: PointerEvent) => void;
  private md!: (e: PointerEvent) => void;
  private mu!: (e: PointerEvent) => void;
  private wh!: (e: WheelEvent) => void;
  private bl!: () => void;
  private vis!: () => void;
  private unl!: () => void;
  private cm!: (e: Event) => void;
  private ro?: ResizeObserver;

  private pointToTile(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * this.viewW + this.camX;
    const wy = ((e.clientY - r.top) / r.height) * this.viewH + this.camY;
    this.mouseTX = Math.floor(wx / TILE);
    this.mouseTY = Math.floor(wy / TILE);
  }

  private attach() {
    this.kd = (e) => {
      const c = e.code;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(c)) e.preventDefault();
      if ((c === "Space" || c === "KeyW" || c === "ArrowUp") && !this.keys[c] && !this.flying) this.jumpNow();
      this.keys[c] = true;
      if (c.startsWith("Digit")) {
        const n = parseInt(c.slice(5), 10);
        this.selectSlot(n === 0 ? 9 : n - 1);
        audio.playSfx("click");
      }
    };
    this.ku = (e) => { this.keys[e.code] = false; };
    this.mm = (e) => this.pointToTile(e);
    this.md = (e) => {
      if (this.uiOpen) return;
      audio.ensure();
      this.pointToTile(e);
      if (this.placeMode || e.button === 2) {
        this.rightDown = true;
        this.tryPlace();
      } else if (e.button === 0) {
        this.mouseDown = true;
      }
    };
    this.mu = (e) => {
      if (this.placeMode || e.button === 2) this.rightDown = false;
      else if (e.button === 0) { this.mouseDown = false; this.mineTX = -1; this.mineProg = 0; }
    };
    this.wh = (e) => { if (!this.uiOpen) this.setSelectedByDelta(e.deltaY > 0 ? 1 : -1); };
    this.bl = () => { this.keys = {}; this.mouseDown = false; this.rightDown = false; };
    this.vis = () => { if (document.hidden) this.saveGame(); };
    this.unl = () => this.saveGame();
    this.cm = (e) => e.preventDefault();
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    this.canvas.addEventListener("pointermove", this.mm);
    this.canvas.addEventListener("pointerdown", this.md);
    window.addEventListener("pointerup", this.mu);
    this.canvas.addEventListener("wheel", this.wh, { passive: true });
    this.canvas.addEventListener("contextmenu", this.cm);
    window.addEventListener("blur", this.bl);
    document.addEventListener("visibilitychange", this.vis);
    window.addEventListener("beforeunload", this.unl);
    if (this.canvas.parentElement) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.canvas.parentElement);
    }
  }
  private detach() {
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    this.canvas.removeEventListener("pointermove", this.mm);
    this.canvas.removeEventListener("pointerdown", this.md);
    window.removeEventListener("pointerup", this.mu);
    this.canvas.removeEventListener("wheel", this.wh);
    this.canvas.removeEventListener("contextmenu", this.cm);
    window.removeEventListener("blur", this.bl);
    document.removeEventListener("visibilitychange", this.vis);
    window.removeEventListener("beforeunload", this.unl);
    this.ro?.disconnect();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const cw = parent ? parent.clientWidth : window.innerWidth;
    const ch = parent ? parent.clientHeight : window.innerHeight;
    const MAX_W = 1000;
    let rw = cw;
    let rh = ch;
    if (cw > MAX_W) {
      const s = MAX_W / cw;
      rw = MAX_W;
      rh = Math.max(1, Math.round(ch * s));
    }
    this.viewW = rw;
    this.viewH = rh;
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    this.canvas.width = rw;
    this.canvas.height = rh;
  }

  // ------------------------------------------------------------- loop
  private loop(now: number) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (!this.paused && !this.uiOpen && !this.gameover && !this.victory) this.update(dt);
    this.render();
    this.frame++;
    this.stateT += dt;
    if (this.stateT > 0.08) { this.stateT = 0; this.pushState(); }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    const prevFrac = this.dayFrac;
    this.dayFrac = (this.dayFrac + dt / DAY_LEN) % 1;
    if (this.dayFrac < prevFrac) this.dayCount++;
    const night = this.isNightNow();
    audio.setTrack(this.bossActive() ? "boss" : night ? "night" : "day");

    this.placeCd = Math.max(0, this.placeCd - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.bannerT <= 0) this.banner = null;

    if (this.hurtT <= 0 && this.hp < this.maxHp) {
      this.regenT -= dt;
      if (this.regenT <= 0) { this.hp = Math.min(this.maxHp, this.hp + 1); this.regenT = 0.55; }
    }

    if (this.shakeX !== 0 || this.shakeY !== 0) {
      const decay = Math.max(0, 1 - dt / 0.15);
      this.shakeX *= decay;
      this.shakeY *= decay;
      if (Math.abs(this.shakeX) < 0.5) this.shakeX = 0;
      if (Math.abs(this.shakeY) < 0.5) this.shakeY = 0;
    }

    this.updatePlayer(dt);
    this.updateMining(dt);
    if (this.rightDown && this.placeCd <= 0) { this.tryPlace(); this.placeCd = 0.14; }
    this.updateMobs(dt);
    this.updateShots(dt);
    this.updateParticles(dt);
    this.updateAmbient(dt, night);

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = night ? 2.6 : 4.5;
      this.trySpawn(night);
    }

    this.checkQuest();

    const targetCX = this.px - this.viewW / 2;
    const targetCY = this.py - this.viewH / 2;
    this.camX += (targetCX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetCY - this.camY) * Math.min(1, dt * 8);
    this.camX = Math.max(0, Math.min(this.world.w * TILE - this.viewW, this.camX));
    this.camY = Math.max(0, Math.min(this.world.h * TILE - this.viewH, this.camY));

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 5; this.saveGame(); }
  }

  // ------------------------------------------------------------- player
  private doJump() {
    this.pvy = -JUMP_V;
    this.onGround = false;
    this.jumpBuffer = 0;
    this.jumpsLeft = Math.max(0, this.jumpsLeft - 1);
    audio.playSfx("jump");
    for (let i = 0; i < 4; i++) this.dust(this.px, this.py + 20, "#e8f2ff");
  }

  private updatePlayer(dt: number) {
    let move = 0;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) move -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) move += 1;
    if (move !== 0) {
      this.pface = move > 0 ? 1 : -1;
      this.pvx = move * MOVE_SPEED * this.moveMul();
      if (this.onGround) this.walkT += dt * 14;
    } else {
      this.pvx *= Math.pow(0.001, dt);
      if (Math.abs(this.pvx) < 4) this.pvx = 0;
    }

    this.gliding = false;
    if (this.flying) {
      this.pvy = 0;
      if (this.keys["Space"] || this.keys["KeyW"] || this.keys["ArrowUp"]) this.pvy = -MOVE_SPEED * 1.6;
      if (this.keys["KeyS"] || this.keys["ArrowDown"]) this.pvy = MOVE_SPEED * 1.6;
      this.integrateX(dt);
      this.py += this.pvy * dt;
      this.onGround = false;
    } else {
      const jumpKey = this.keys["Space"] || this.keys["KeyW"] || this.keys["ArrowUp"];
      if (this.jumpBuffer > 0) {
        this.jumpBuffer -= dt;
        if (this.onGround) this.doJump();
      }
      this.pvy += GRAVITY * dt;

      // Feather Cloak: hold jump while falling to feather down
      if (jumpKey && this.pvy > 0 && !this.onGround && this.canGlide()) {
        this.pvy = Math.min(this.pvy, 96);
        this.gliding = true;
        this.fallDistance = 0;
        if (this.frame % 6 === 0) this.dust(this.px, this.py + 16, "#dfe8ff");
      }
      if (this.pvy > 950) this.pvy = 950;
      if (!this.onGround && this.pvy > 0) this.fallDistance += this.pvy * dt;

      this.integrateX(dt);
      const wasGround = this.onGround;
      this.onGround = this.integrateY(dt);
      if (this.onGround) this.jumpsLeft = this.maxJumps();
      if (!wasGround && this.onGround) {
        audio.playSfx("land");
        for (let i = 0; i < 5; i++) this.dust(this.px, this.py + 20, "#cdd8ee");
        if (this.fallDistance > 620 && !this.godMode && !this.noFallDamage()) {
          const raw = Math.floor((this.fallDistance - 620) / 30);
          const dmg = Math.min(45, Math.max(1, raw - this.defense()));
          this.hp -= dmg;
          this.invuln = 0.8;
          this.hurtT = 3;
          this.float(this.px, this.py - 30, `-${dmg}`, "#ff6b6b");
          this.shakeX = 8;
          this.shakeY = 5;
          audio.playSfx("hurt");
          if (this.hp <= 0) { this.hp = 0; this.die(); }
        }
        this.fallDistance = 0;
      }
    }

    this.px = Math.max(8, Math.min(this.world.w * TILE - 8, this.px));

    // the void takes everything
    if (!this.flying && this.py / TILE > VOID_Y) {
      if (this.godMode) {
        this.px = this.world.spawnX * TILE;
        this.py = this.world.spawnY * TILE;
        this.pvy = 0;
      } else {
        this.hp = 0;
        this.die();
      }
    }
  }

  private integrateX(dt: number) {
    const w = 18;
    const h = 44;
    this.px += this.pvx * dt;
    const top = Math.floor((this.py - h / 2) / TILE);
    const bot = Math.floor((this.py + h / 2 - 0.01) / TILE);
    if (this.pvx > 0) {
      const rx = Math.floor((this.px + w / 2) / TILE);
      for (let ty = top; ty <= bot; ty++) {
        if (isSolid(getTile(this.world, rx, ty))) { this.px = rx * TILE - w / 2 - 0.01; this.pvx = 0; break; }
      }
    } else if (this.pvx < 0) {
      const lx = Math.floor((this.px - w / 2) / TILE);
      for (let ty = top; ty <= bot; ty++) {
        if (isSolid(getTile(this.world, lx, ty))) { this.px = (lx + 1) * TILE + w / 2 + 0.01; this.pvx = 0; break; }
      }
    }
  }
  private integrateY(dt: number): boolean {
    const w = 18;
    const h = 44;
    this.py += this.pvy * dt;
    const left = Math.floor((this.px - w / 2) / TILE);
    const right = Math.floor((this.px + w / 2 - 0.01) / TILE);
    if (this.pvy > 0) {
      const by = Math.floor((this.py + h / 2) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(getTile(this.world, tx, by))) { this.py = by * TILE - h / 2 - 0.01; this.pvy = 0; return true; }
      }
    } else if (this.pvy < 0) {
      const ty = Math.floor((this.py - h / 2) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(getTile(this.world, tx, ty))) { this.py = (ty + 1) * TILE + h / 2 + 0.01; this.pvy = 0; break; }
      }
    }
    return false;
  }

  // ------------------------------------------------------------- mining
  private toolInfo(): { power: number; tier: number; dmg: number; kind: string; id: string } {
    const s = this.selectedSlot();
    if (s && ITEMS[s.id]?.kind === "tool") {
      const it = ITEMS[s.id];
      return { power: it.power ?? 1, tier: it.tier ?? 0, dmg: it.dmg ?? 4, kind: it.tool ?? "none", id: s.id };
    }
    return { power: 1, tier: 0, dmg: 4, kind: "fist", id: "" };
  }
  private withinReach(tx: number, ty: number): boolean {
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    return Math.hypot(cx - this.px, cy - (this.py - 8)) <= REACH * TILE;
  }
  private updateMining(dt: number) {
    if (!this.mouseDown) { this.mineTX = -1; this.mineProg = 0; return; }
    const tx = this.mouseTX;
    const ty = this.mouseTY;
    const id = getTile(this.world, tx, ty);
    if (id === AIR || !this.withinReach(tx, ty)) { this.tryAttack(); this.mineTX = -1; return; }
    const def = TILES[id];
    const tool = this.toolInfo();
    if (!def || def.minTier > tool.tier) { this.tryAttack(); this.mineTX = -1; return; }
    if (tx !== this.mineTX || ty !== this.mineTY) {
      this.mineTX = tx;
      this.mineTY = ty;
      this.mineProg = 0;
      this.mineSfxT = 0;
    }
    this.mineProg += tool.power * dt * 3.2;
    this.mineSfxT -= dt;
    if (this.mineSfxT <= 0) {
      this.mineSfxT = 0.18;
      audio.playSfx(id === SKY_WOOD || id === SKY_LEAVES || id === CLOUD ? "mine" : "mineStone");
    }
    if (Math.random() < 0.5) this.dust(tx * TILE + 15, ty * TILE + 15, def.color);
    if (this.mineProg >= def.hp) {
      this.breakTile(tx, ty, id);
      this.mineTX = -1;
      this.mineProg = 0;
    }
  }

  private breakTile(tx: number, ty: number, id: number) {
    const def = TILES[id];
    setTile(this.world, tx, ty, AIR);
    if (id === WORKBENCH) this.workbenchCount = Math.max(0, this.workbenchCount - 1);
    if (id === FURNACE) this.furnaceCount = Math.max(0, this.furnaceCount - 1);
    if (id === SKYFORGE) this.skyforgeCount = Math.max(0, this.skyforgeCount - 1);
    if (def.drop) {
      const lo = def.dropMin ?? 1;
      const hi = def.dropMax ?? lo;
      const n = lo + (hi > lo ? Math.floor(Math.random() * (hi - lo + 1)) : 0);
      this.addItem(def.drop, n);
      audio.playSfx("pickup");
      this.float(tx * TILE + 15, ty * TILE + 10, `+${n}`, "#fff2b0");
      this.mined[def.drop] = (this.mined[def.drop] ?? 0) + n;
    }
    audio.playSfx("break");
    for (let i = 0; i < 6; i++) this.dust(tx * TILE + 15, ty * TILE + 15, def.color);
    this.checkQuest();
  }

  private tryPlace() {
    const s = this.selectedSlot();
    if (!s) return;
    const it = ITEMS[s.id];
    if (it?.place === undefined) return;
    const tx = this.mouseTX;
    const ty = this.mouseTY;
    if (!this.withinReach(tx, ty)) return;
    if (getTile(this.world, tx, ty) !== AIR) return;
    if (isSolid(it.place)) {
      const pl = this.px - 9, pr = this.px + 9, pt = this.py - 22, pb = this.py + 22;
      const bl = tx * TILE, br = bl + TILE, bt = ty * TILE, bb = bt + TILE;
      if (pr > bl && pl < br && pb > bt && pt < bb) return;
    }
    setTile(this.world, tx, ty, it.place);
    audio.playSfx(it.place === TORCH || it.place === LUMEN ? "torch" : "place");
    if (it.place === WORKBENCH) this.workbenchCount++;
    if (it.place === FURNACE) this.furnaceCount++;
    if (it.place === SKYFORGE) this.skyforgeCount++;
    this.removeItem(s.id, 1);
    for (let i = 0; i < 4; i++) this.dust(tx * TILE + 15, ty * TILE + 15, it.color);
    this.checkQuest();
  }

  // ------------------------------------------------------------- combat
  private tryAttack() {
    if (this.attackCd > 0) return;
    const tool = this.toolInfo();
    const reach = tool.kind === "sword" ? TILE * 2.1 : TILE * 1.5;
    const fx = this.px + this.pface * 8;
    let hit: Mob | null = null;
    for (const m of this.mobs) {
      const d = Math.hypot(m.x - fx, m.y - this.py);
      const inFront = (m.x - this.px) * this.pface >= -10;
      if (d < reach + m.w / 2 && inFront) {
        this.damageMob(m, tool.dmg);
        if (!hit) hit = m;
      }
    }
    this.swingT = tool.kind === "sword" ? 0.18 : 0.14;
    this.attackCd = tool.kind === "sword" ? 0.3 : 0.4;
    audio.playSfx("swing");
    if (hit) {
      audio.playSfx("hitEnemy");
      const fx2 = WEAPON_FX[tool.id];
      if (fx2 === "burn") hit.burn = 3;
      if (fx2 === "chain") this.chainLightning(hit, Math.round(tool.dmg * 0.5));
      if (fx2 === "leech" || this.lifeSteal() > 0) {
        const steal = Math.max(1, Math.round(tool.dmg * (fx2 === "leech" ? 0.12 : this.lifeSteal())));
        this.hp = Math.min(this.maxHp, this.hp + steal);
        this.float(this.px, this.py - 44, `+${steal}`, "#7fffc0");
      }
    }
  }

  private chainLightning(from: Mob, dmg: number) {
    let jumps = 0;
    for (const m of this.mobs) {
      if (m === from || jumps >= 2) continue;
      if (Math.hypot(m.x - from.x, m.y - from.y) < TILE * 6) {
        this.boltFx(from.x, from.y, m.x, m.y);
        this.damageMob(m, dmg);
        jumps++;
      }
    }
  }
  private boltFx(x0: number, y0: number, x1: number, y1: number) {
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      this.particles.push({
        x: x0 + (x1 - x0) * t + (Math.random() - 0.5) * 10,
        y: y0 + (y1 - y0) * t + (Math.random() - 0.5) * 10,
        vx: 0, vy: 0, life: 0.18, max: 0.18, size: 3, color: "#c9a8ff", grav: 0,
      });
    }
  }

  private damageMob(m: Mob, dmg: number) {
    let crit = false;
    if (this.py < m.y - m.h / 2 && Math.random() < 0.2) { dmg = Math.round(dmg * 1.5); crit = true; }
    m.hp -= dmg;
    m.hitFlash = 0.12;
    if (m.type !== "titan" && m.type !== "aetherarch") {
      m.vx += this.pface * 150;
      m.vy = -110;
    }
    this.float(m.x, m.y - 20, `${Math.round(dmg)}${crit ? "!" : ""}`, crit ? "#ffeb3b" : "#ffd0d0");
    for (let i = 0; i < 5; i++) this.dust(m.x, m.y, "#ff9b9b");
    this.shakeX = 4;
    this.shakeY = 3;
    if (m.hp <= 0) this.killMob(m);
  }

  private killMob(m: Mob) {
    const idx = this.mobs.indexOf(m);
    if (idx < 0) return;
    this.mobs.splice(idx, 1);
    audio.playSfx("enemyDie");
    for (let i = 0; i < 10; i++) this.dust(m.x, m.y, "#cfe0ff");
    this.killed[m.type] = (this.killed[m.type] ?? 0) + 1;

    switch (m.type) {
      case "sky_slime":
        this.addItem("cloud", 1 + Math.floor(Math.random() * 3));
        if (Math.random() < 0.3) this.addItem("gel", 1);
        break;
      case "wisp":
        this.addItem("glow_dust", 1 + Math.floor(Math.random() * 2));
        break;
      case "harpy":
        this.addItem("feather", 1 + Math.floor(Math.random() * 3));
        break;
      case "golem":
        this.addItem("sky_stone", 4 + Math.floor(Math.random() * 5));
        if (Math.random() < 0.5) this.addItem("aetherite_ore", 1 + Math.floor(Math.random() * 3));
        break;
      case "phantom":
        if (Math.random() < 0.45) this.addItem("void_shard", 1);
        this.addItem("glow_dust", 1);
        break;
      case "matriarch":
        this.addItem("feather", 30);
        this.addItem("aetherite_bar", 10);
        this.addItem("wind_sigil", 1);
        this.showBanner("THE NEST IS QUIET", "Wind Sigil obtained");
        audio.playSfx("levelup");
        break;
      case "titan":
        this.addItem("titan_heart", 1);
        this.addItem("sunsteel_bar", 12);
        this.addItem("storm_core", 6);
        this.showBanner("THE GIANT FALLS", "Titan Heart obtained");
        audio.playSfx("levelup");
        break;
      case "aetherarch":
        this.addItem("void_ingot", 20);
        this.showBanner("THE STORM IS STILL", "The sky has a keeper again");
        this.questIndex = SKY_QUESTS.length;
        this.victory = true;
        audio.playSfx("victory");
        audio.setTrack("day");
        this.saveGame();
        this.cb.onVictory();
        return;
    }
    if (!this.bossActive()) audio.setTrack(this.isNightNow() ? "night" : "day");
    this.checkQuest();
  }

  private hurt(dmg: number) {
    if (this.godMode || this.invuln > 0) return;
    const real = Math.max(1, dmg - this.defense());
    this.hp -= real;
    this.invuln = 0.8;
    this.hurtT = 3;
    this.pvx = this.pface > 0 ? -170 : 170;
    this.pvy = -190;
    audio.playSfx("hurt");
    this.float(this.px, this.py - 30, `-${real}`, "#ff6b6b");
    for (let i = 0; i < 8; i++) this.dust(this.px, this.py, "#ff6b6b");
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  private die() {
    if (this.gameover) return;
    this.gameover = true;
    audio.playSfx("gameOver");
    audio.setTrack("none");
    this.saveGame();
    this.cb.onGameOver();
  }

  // ------------------------------------------------------------- mobs
  private trySpawn(night: boolean) {
    if (this.mobs.length >= 10 || this.bossActive()) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const sx = this.px + side * (this.viewW / 2 + 60 + Math.random() * 120);
    const stx = Math.floor(sx / TILE);
    if (stx < 3 || stx >= this.world.w - 3) return;

    // find a surface near the player's altitude to stand on
    const pty = Math.floor(this.py / TILE);
    let groundY = -1;
    for (let dy = -14; dy <= 18; dy++) {
      const y = pty + dy;
      if (y < 1 || y >= this.world.h) continue;
      if (isSolid(getTile(this.world, stx, y)) && !isSolid(getTile(this.world, stx, y - 1))) { groundY = y; break; }
    }

    const roll = Math.random();
    let type: MobType;
    if (night) type = roll < 0.3 ? "phantom" : roll < 0.6 ? "harpy" : roll < 0.85 ? "wisp" : "golem";
    else type = roll < 0.4 ? "sky_slime" : roll < 0.7 ? "harpy" : roll < 0.9 ? "wisp" : "golem";
    const st = MOB_STATS[type];
    if (!st.fly && groundY < 0) return;

    this.mobs.push({
      type, x: sx,
      y: st.fly ? this.py - 40 - Math.random() * 100 : (groundY - 2) * TILE,
      vx: 0, vy: 0, w: st.w, h: st.h, hp: st.hp, maxHp: st.hp,
      facing: -side, onGround: false, hitFlash: 0, t: Math.random() * 3,
      cd: 1 + Math.random() * 2, phase: 0, burn: 0,
    });
  }

  private updateMobs(dt: number) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      m.t += dt;
      m.cd -= dt;
      m.hitFlash = Math.max(0, m.hitFlash - dt);
      if (m.burn > 0) {
        m.burn -= dt;
        if (this.frame % 30 === 0) {
          m.hp -= 6;
          this.dust(m.x, m.y - 8, "#ffb04a");
          if (m.hp <= 0) { this.killMob(m); continue; }
        }
      }
      const dx = this.px - m.x;
      const dy = this.py - m.y;
      m.facing = dx >= 0 ? 1 : -1;
      const st = MOB_STATS[m.type];

      switch (m.type) {
        case "sky_slime":
          m.vy += GRAVITY * dt;
          if (m.onGround && m.cd <= 0) {
            m.vy = -430;
            m.vx = m.facing * 130;
            m.cd = 1.0;
            audio.playSfx("slime");
          }
          this.mobCollide(m, dt);
          break;
        case "golem":
          m.vy += GRAVITY * dt;
          m.vx += Math.sign(dx) * 90 * dt;
          m.vx = Math.max(-70, Math.min(70, m.vx));
          if (m.onGround && m.cd <= 0 && Math.abs(dx) < TILE * 5) {
            m.vy = -330;
            m.cd = 2.4;
          }
          this.mobCollide(m, dt);
          break;
        case "wisp": {
          const tx = this.px - Math.sign(dx) * 40;
          const ty = this.py - 50 + Math.sin(m.t * 2) * 30;
          m.vx += Math.sign(tx - m.x) * 130 * dt;
          m.vy += Math.sign(ty - m.y) * 130 * dt;
          m.vx = Math.max(-120, Math.min(120, m.vx));
          m.vy = Math.max(-120, Math.min(120, m.vy));
          this.flyCollide(m, dt);
          if (this.frame % 8 === 0) {
            this.particles.push({ x: m.x, y: m.y, vx: 0, vy: -12, life: 0.7, max: 0.7, size: 2.5, color: "#fff2a8", grav: 0 });
          }
          break;
        }
        case "harpy": {
          if (m.cd > 0) {
            m.vy += ((this.py - 90) - m.y) * 1.6 * dt;
            m.vx += Math.sign(dx) * 90 * dt;
            m.vx = Math.max(-190, Math.min(190, m.vx));
            m.vy = Math.max(-260, Math.min(260, m.vy));
          } else if (m.cd > -0.45) {
            m.vx += Math.sign(dx) * 620 * dt;
            m.vy += Math.sign(dy) * 620 * dt;
            m.vx = Math.max(-560, Math.min(560, m.vx));
            m.vy = Math.max(-560, Math.min(560, m.vy));
          } else {
            m.cd = 2 + Math.random() * 2;
          }
          this.flyCollide(m, dt);
          break;
        }
        case "phantom": {
          // ignores geometry — that is the point
          m.vx += Math.sign(dx) * 100 * dt;
          m.vy += Math.sign(dy - 20) * 100 * dt;
          m.vx = Math.max(-135, Math.min(135, m.vx));
          m.vy = Math.max(-135, Math.min(135, m.vy));
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.cd <= 0 && Math.abs(dx) > TILE * 8) {
            m.x = this.px - Math.sign(dx) * TILE * 4;
            m.cd = 5;
            for (let k = 0; k < 8; k++) this.dust(m.x, m.y, "#b06bff");
          }
          break;
        }
        case "matriarch": {
          const hover = this.py - 150;
          if (m.cd > 0) {
            m.vy += (hover - m.y) * 1.5 * dt;
            m.vx += Math.sign(dx) * 110 * dt;
            m.vx = Math.max(-210, Math.min(210, m.vx));
            m.vy = Math.max(-300, Math.min(300, m.vy));
            if (this.frame % 34 === 0) this.shoot(m.x, m.y + 10, this.px, this.py, 320, 18, "feather");
          } else if (m.cd > -0.7) {
            m.vx += Math.sign(dx) * 760 * dt;
            m.vy += Math.sign(dy) * 760 * dt;
            m.vx = Math.max(-660, Math.min(660, m.vx));
            m.vy = Math.max(-660, Math.min(660, m.vy));
          } else {
            m.cd = m.hp < m.maxHp / 2 ? 1.6 : 2.6;
            const brood = m.hp < m.maxHp / 2 ? 3 : 2;
            for (let k = 0; k < brood && this.mobs.length < 16; k++) {
              const hs = MOB_STATS.harpy;
              this.mobs.push({
                type: "harpy", x: m.x + (k % 2 ? 40 : -40), y: m.y,
                vx: 0, vy: 0, w: hs.w, h: hs.h, hp: hs.hp, maxHp: hs.hp,
                facing: 1, onGround: false, hitFlash: 0, t: 0, cd: 1.2, phase: 0, burn: 0,
              });
            }
          }
          this.flyCollide(m, dt);
          break;
        }
        case "titan": {
          m.vy += GRAVITY * dt;
          const rage = m.hp < m.maxHp / 2;
          if (m.onGround && m.cd <= 0) {
            if (Math.abs(dx) < TILE * 7) {
              m.vy = -520;
              m.vx = m.facing * (rage ? 230 : 150);
              m.cd = rage ? 1.6 : 2.4;
              m.phase = 1;
            } else {
              this.shoot(m.x, m.y - 30, this.px, this.py, 420, 24, "rock");
              m.cd = rage ? 1.2 : 2.0;
            }
          }
          const wasAir = !m.onGround;
          this.mobCollide(m, dt);
          if (m.phase === 1 && wasAir && m.onGround) {
            m.phase = 0;
            this.shockwave(m.x, m.y + m.h / 2, rage ? 26 : 18);
          }
          break;
        }
        case "aetherarch": {
          const rage = m.hp < m.maxHp / 2;
          if (rage && m.phase === 0) {
            m.phase = 1;
            this.showBanner("THE SKY BREAKS", "Phase two");
            this.shakeX = 16;
            this.shakeY = 12;
            audio.playSfx("bossSpawn");
          }
          const hover = this.py - 170 + Math.sin(m.t * 1.2) * 40;
          m.vy += (hover - m.y) * (rage ? 2.4 : 1.6) * dt;
          m.vx += Math.sign(dx) * (rage ? 190 : 120) * dt;
          m.vx = Math.max(-260, Math.min(260, m.vx));
          m.vy = Math.max(-320, Math.min(320, m.vy));
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.cd <= 0) {
            const roll = Math.random();
            if (roll < 0.45) {
              const n = rage ? 5 : 3;
              for (let k = 0; k < n; k++) {
                const spread = (k - (n - 1) / 2) * 0.28;
                const ang = Math.atan2(this.py - m.y, this.px - m.x) + spread;
                this.shotAngle(m.x, m.y + 20, ang, rage ? 430 : 340, rage ? 26 : 20, "bolt");
              }
              m.cd = rage ? 1.1 : 1.8;
            } else if (roll < 0.75) {
              this.lightningStrike(this.px, rage ? 30 : 22);
              m.cd = rage ? 1.4 : 2.2;
            } else {
              for (let k = 0; k < (rage ? 3 : 2) && this.mobs.length < 16; k++) {
                const ws = MOB_STATS.wisp;
                this.mobs.push({
                  type: "wisp", x: m.x + (k % 2 ? 50 : -50), y: m.y + 20,
                  vx: 0, vy: 0, w: ws.w, h: ws.h, hp: ws.hp, maxHp: ws.hp,
                  facing: 1, onGround: false, hitFlash: 0, t: 0, cd: 1, phase: 0, burn: 0,
                });
              }
              m.cd = 3;
            }
          }
          break;
        }
      }

      // contact damage
      const overlap = Math.abs(m.x - this.px) < m.w / 2 + 9 && Math.abs(m.y - this.py) < m.h / 2 + 22;
      if (overlap && this.invuln <= 0) this.hurt(st.dmg);

      // cull strays (never cull a boss)
      if (m.type !== "matriarch" && m.type !== "titan" && m.type !== "aetherarch") {
        const dist = Math.abs(m.x - this.px);
        if (dist > this.viewW * 2.2 || m.y / TILE > VOID_Y) this.mobs.splice(i, 1);
        else if (dist > this.viewW * 1.3 && Math.random() < 0.004) this.mobs.splice(i, 1);
      }
    }
  }

  private shockwave(x: number, y: number, dmg: number) {
    this.shakeX = 14;
    this.shakeY = 10;
    audio.playSfx("bossSpawn");
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      this.particles.push({
        x, y, vx: Math.cos(a) * (120 + Math.random() * 220), vy: Math.sin(a) * 90,
        life: 0.5, max: 0.5, size: 3 + Math.random() * 3, color: "#dbe6ff", grav: 400,
      });
    }
    if (Math.abs(this.px - x) < TILE * 7 && Math.abs(this.py - y) < TILE * 3) this.hurt(dmg);
  }

  private lightningStrike(x: number, dmg: number) {
    const tx = Math.floor(x / TILE);
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: this.py - 300 + i * 12,
        vx: 0, vy: 0, life: 0.35, max: 0.35, size: 4, color: "#e8d4ff", grav: 0,
      });
    }
    audio.playSfx("hitEnemy");
    if (Math.abs(Math.floor(this.px / TILE) - tx) <= 1) this.hurt(dmg);
  }

  private shoot(x: number, y: number, tx: number, ty: number, speed: number, dmg: number, kind: Shot["kind"]) {
    this.shotAngle(x, y, Math.atan2(ty - y, tx - x), speed, dmg, kind);
  }
  private shotAngle(x: number, y: number, ang: number, speed: number, dmg: number, kind: Shot["kind"]) {
    this.shots.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 4, dmg, kind });
    audio.playSfx("swing");
  }
  private updateShots(dt: number) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      if (s.kind === "rock") s.vy += 380 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const hitWall = isSolid(getTile(this.world, Math.floor(s.x / TILE), Math.floor(s.y / TILE)));
      const hitPlayer = Math.abs(s.x - this.px) < 14 && Math.abs(s.y - this.py) < 26;
      if (hitPlayer) this.hurt(s.dmg);
      if (s.life <= 0 || hitWall || hitPlayer) {
        for (let k = 0; k < 6; k++) this.dust(s.x, s.y, s.kind === "rock" ? "#b9c6de" : "#c9a8ff");
        this.shots.splice(i, 1);
      }
    }
  }

  private mobCollide(m: Mob, dt: number) {
    m.x += m.vx * dt;
    const top = Math.floor((m.y - m.h / 2) / TILE);
    const bot = Math.floor((m.y + m.h / 2 - 0.01) / TILE);
    if (m.vx > 0) {
      const rx = Math.floor((m.x + m.w / 2) / TILE);
      for (let ty = top; ty <= bot; ty++) if (isSolid(getTile(this.world, rx, ty))) { m.x = rx * TILE - m.w / 2 - 0.01; m.vx = 0; break; }
    } else if (m.vx < 0) {
      const lx = Math.floor((m.x - m.w / 2) / TILE);
      for (let ty = top; ty <= bot; ty++) if (isSolid(getTile(this.world, lx, ty))) { m.x = (lx + 1) * TILE + m.w / 2 + 0.01; m.vx = 0; break; }
    }
    m.y += m.vy * dt;
    const left = Math.floor((m.x - m.w / 2) / TILE);
    const right = Math.floor((m.x + m.w / 2 - 0.01) / TILE);
    m.onGround = false;
    if (m.vy > 0) {
      const by = Math.floor((m.y + m.h / 2) / TILE);
      for (let tx = left; tx <= right; tx++) if (isSolid(getTile(this.world, tx, by))) { m.y = by * TILE - m.h / 2 - 0.01; m.vy = 0; m.onGround = true; break; }
    } else if (m.vy < 0) {
      const ty = Math.floor((m.y - m.h / 2) / TILE);
      for (let tx = left; tx <= right; tx++) if (isSolid(getTile(this.world, tx, ty))) { m.y = (ty + 1) * TILE + m.h / 2 + 0.01; m.vy = 0; break; }
    }
  }

  private flyCollide(m: Mob, dt: number) {
    const hw = m.w / 2;
    const hh = m.h / 2;
    const nx = m.x + m.vx * dt;
    const top = Math.floor((m.y - hh) / TILE);
    const bot = Math.floor((m.y + hh - 0.01) / TILE);
    if (m.vx > 0) {
      const rx = Math.floor((nx + hw) / TILE);
      for (let ty = top; ty <= bot; ty++) if (isSolid(getTile(this.world, rx, ty))) { m.vx = 0; break; }
    } else if (m.vx < 0) {
      const lx = Math.floor((nx - hw) / TILE);
      for (let ty = top; ty <= bot; ty++) if (isSolid(getTile(this.world, lx, ty))) { m.vx = 0; break; }
    }
    m.x += m.vx * dt;
    const ny = m.y + m.vy * dt;
    const left = Math.floor((m.x - hw) / TILE);
    const right = Math.floor((m.x + hw - 0.01) / TILE);
    if (m.vy > 0) {
      const by = Math.floor((ny + hh) / TILE);
      for (let tx = left; tx <= right; tx++) if (isSolid(getTile(this.world, tx, by))) { m.vy = 0; break; }
    } else if (m.vy < 0) {
      const ty = Math.floor((ny - hh) / TILE);
      for (let tx = left; tx <= right; tx++) if (isSolid(getTile(this.world, tx, ty))) { m.vy = 0; break; }
    }
    m.y += m.vy * dt;
  }

  // ------------------------------------------------------------- quests
  private checkQuest() {
    if (this.victory || this.gameover) return;
    const q = SKY_QUESTS[this.questIndex];
    if (!q) return;
    const [kind, arg] = q.check.split(":");
    let done = false;
    if (kind === "have") done = this.count(arg) >= q.n;
    else if (kind === "mined") done = (this.mined[arg] ?? 0) >= q.n;
    else if (kind === "killed") done = (this.killed[arg] ?? 0) >= q.n;
    else if (kind === "armorset") {
      const owned = Object.keys(ARMOR).filter((id) => ARMOR[id].set === arg);
      const held = owned.filter((id) => this.count(id) > 0 || this.armor.head === id || this.armor.chest === id || this.armor.legs === id);
      done = held.length >= 3;
    }
    if (!done) return;

    if (q.reward === "hp20") { this.maxHp += 20; this.hp = Math.min(this.maxHp, this.hp + 20); }
    if (q.reward === "hp30") { this.maxHp += 30; this.hp = Math.min(this.maxHp, this.hp + 30); }
    if (q.reward === "hp40") { this.maxHp += 40; this.hp = Math.min(this.maxHp, this.hp + 40); }
    audio.playSfx("levelup");
    this.showBanner("QUEST COMPLETE", `${this.questIndex + 12}`);
    this.questIndex++;
    this.saveGame();
  }

  private showBanner(title: string, sub: string) {
    this.banner = { title, sub, key: this.frame };
    this.bannerT = 3;
  }

  // ------------------------------------------------------------- particles
  private dust(x: number, y: number, color: string) {
    if (this.particles.length > 320) return;
    const a = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 120;
    this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 2 + Math.random() * 3, color, grav: 500 });
  }
  private float(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, vy: -34, life: 1.1, text, color });
  }
  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }
  private updateAmbient(dt: number, night: boolean) {
    this.moteTimer -= dt;
    if (this.moteTimer > 0 || this.particles.length > 260) return;
    this.moteTimer = 0.14;
    const x = this.camX + Math.random() * this.viewW;
    const y = this.camY + Math.random() * this.viewH;
    if (isSolid(getTile(this.world, Math.floor(x / TILE), Math.floor(y / TILE)))) return;
    this.particles.push(
      night
        ? { x, y, vx: Math.sin(this.frame * 0.05 + x) * 10, vy: -6, life: 3, max: 3, size: 2.4, color: "#bfe8ff", grav: 0 }
        : { x, y, vx: (Math.random() - 0.5) * 14, vy: -12, life: 3.2, max: 3.2, size: 1.8, color: "rgba(255,255,255,0.75)", grav: 0 },
    );
  }

  // ------------------------------------------------------------- state
  private pushState() {
    const craftable: string[] = [];
    for (const r of this.recipes) {
      if (!this.stationOk(r)) continue;
      let ok = true;
      for (const ing of r.ing) if (this.count(ing.id) < ing.n) { ok = false; break; }
      if (ok) craftable.push(r.id);
    }
    const boss = this.mobs.find((m) => m.type === "matriarch" || m.type === "titan" || m.type === "aetherarch");
    const ptx = Math.floor(this.px / TILE);
    const pty = Math.floor(this.py / TILE);
    this.cb.onState({
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      defense: this.defense(),
      selected: this.selected,
      dayFrac: this.dayFrac,
      isNight: this.isNightNow(),
      dayCount: this.dayCount,
      questIndex: this.questIndex,
      questDone: this.questIndex >= SKY_QUESTS.length,
      banner: this.banner,
      boss: boss ? { id: boss.type as SkyBossId, hp: Math.max(0, boss.hp), maxHp: boss.maxHp, rage: boss.hp < boss.maxHp / 2 } : null,
      mineProgress: this.mineTX >= 0 ? Math.min(1, this.mineProg / (TILES[getTile(this.world, this.mineTX, this.mineTY)]?.hp || 1)) : 0,
      inventory: this.inv.map((s) => (s ? { id: s.id, count: s.count } : null)),
      armor: { ...this.armor },
      setBonus: this.setBonus(),
      stations: { workbench: this.workbenchCount > 0, furnace: this.furnaceCount > 0, skyforge: this.skyforgeCount > 0 },
      craftable,
      altitude: Math.max(0, VOID_Y - pty),
      nearAltar: this.nearAltar(),
      altarDX: this.world.altarX - ptx,
      canGlide: this.canGlide(),
      canDoubleJump: this.maxJumps() > 1,
      savedAt: this.saveCounter,
      playerTX: ptx,
      playerTY: pty,
    });
  }

  // ------------------------------------------------------------- render
  private texFor(id: number, v: number): HTMLCanvasElement {
    return SKY_TILE_IDS.has(id) ? skyTileTexture(id, v) : tileTexture(id, v);
  }

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const night = this.isNightNow();
    const bright = Math.max(0.12, Math.sin(this.dayFrac * Math.PI * 2));
    this.drawSky(ctx, bright, night);

    const tx0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const ty0 = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const tx1 = Math.min(this.world.w - 1, Math.ceil((this.camX + this.viewW) / TILE) + 1);
    const ty1 = Math.min(this.world.h - 1, Math.ceil((this.camY + this.viewH) / TILE) + 1);

    ctx.save();
    ctx.translate(-Math.round(this.camX) + Math.round(this.shakeX), -Math.round(this.camY) + Math.round(this.shakeY));
    ctx.imageSmoothingEnabled = false;

    // interior walls (only inside an island, never in open air)
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (getTile(this.world, tx, ty) !== AIR) continue;
        let above = false;
        for (let k = 1; k <= 8; k++) if (isSolid(getTile(this.world, tx, ty - k))) { above = true; break; }
        if (!above) continue;
        let below = false;
        for (let k = 1; k <= 8; k++) if (isSolid(getTile(this.world, tx, ty + k))) { below = true; break; }
        if (!below) continue;
        const kind = ty > 100 ? "void" : "sky";
        const v = (tx * 7 ^ ty * 13) & 3;
        ctx.drawImage(skyWallTexture(kind, v), 0, 0, TEX, TEX, tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const id = getTile(this.world, tx, ty);
        if (id !== AIR) this.drawTile(ctx, tx, ty, id);
      }
    }

    if (this.mineTX >= 0) this.drawCracks(ctx);
    this.drawTarget(ctx);
    const ghost = this.selectedSlot();
    if (ghost && ITEMS[ghost.id]?.place !== undefined && this.withinReach(this.mouseTX, this.mouseTY)
      && getTile(this.world, this.mouseTX, this.mouseTY) === AIR) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      this.drawTile(ctx, this.mouseTX, this.mouseTY, ITEMS[ghost.id].place!);
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const s of this.shots) this.drawShot(ctx, s);
    for (const m of this.mobs) this.drawMob(ctx, m);
    if (!this.gameover) this.drawPlayer(ctx);

    ctx.imageSmoothingEnabled = true;
    ctx.textAlign = "center";
    ctx.font = "bold 13px Rajdhani, sans-serif";
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.fillStyle = "#000";
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    this.drawLighting(tx0, ty0, tx1, ty1, bright);
    this.drawGlow(ctx, tx0, ty0, tx1, ty1, night);

    // the void eats the bottom of the screen
    const voidTop = (VOID_Y - 26) * TILE - this.camY;
    if (voidTop < this.viewH) {
      const g = ctx.createLinearGradient(0, Math.max(0, voidTop), 0, this.viewH);
      g.addColorStop(0, "rgba(10,6,24,0)");
      g.addColorStop(1, "rgba(6,3,16,0.94)");
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.max(0, voidTop), this.viewW, this.viewH - Math.max(0, voidTop));
    }

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const cg = ctx.createLinearGradient(0, 0, 0, this.viewH);
    cg.addColorStop(0, night ? "rgba(60,50,120,0.5)" : "rgba(190,225,255,0.30)");
    cg.addColorStop(1, night ? "rgba(15,10,40,0.55)" : "rgba(120,90,180,0.24)");
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.restore();

    const vg = ctx.createRadialGradient(this.viewW / 2, this.viewH / 2, this.viewH * 0.35, this.viewW / 2, this.viewH / 2, this.viewH * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  private drawSky(ctx: CanvasRenderingContext2D, bright: number, night: boolean) {
    const t = bright;
    const top = night ? [10, 8, 34] : [58, 128, 220];
    const mid = night ? [26, 18, 58] : [138, 190, 245];
    const bot = night ? [40, 24, 74] : [212, 232, 252];
    const mix = (c: number[], i: number) => Math.round(c[i] * t + (night ? c[i] * 0.7 : c[i] * 0.35) * (1 - t));
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, `rgb(${mix(top, 0)},${mix(top, 1)},${mix(top, 2)})`);
    g.addColorStop(0.5, `rgb(${mix(mid, 0)},${mix(mid, 1)},${mix(mid, 2)})`);
    g.addColorStop(1, `rgb(${mix(bot, 0)},${mix(bot, 1)},${mix(bot, 2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const ang = this.dayFrac * Math.PI * 2 - Math.PI / 2;
    const cx = this.viewW / 2 + Math.cos(ang) * this.viewW * 0.42;
    const cy = this.viewH * 0.38 + Math.sin(ang) * this.viewH * 0.36;
    ctx.save();
    if (!night) {
      const sg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 70);
      sg.addColorStop(0, "rgba(255,250,215,0.95)");
      sg.addColorStop(1, "rgba(255,250,215,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(cx - 70, cy - 70, 140, 140);
      ctx.fillStyle = "#fffbe0";
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (let i = 0; i < 90; i++) {
        const x = (i * 977) % this.viewW;
        const y = (i * 613) % (this.viewH * 0.8);
        ctx.globalAlpha = 0.35 + 0.55 * Math.sin(this.frame * 0.03 + i);
        ctx.fillStyle = "#dce8ff";
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
      const mg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 54);
      mg.addColorStop(0, "rgba(225,230,255,0.85)");
      mg.addColorStop(1, "rgba(225,230,255,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(cx - 54, cy - 54, 108, 108);
      ctx.fillStyle = "#eef0ff";
      ctx.beginPath();
      ctx.arc(cx, cy, 19, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // three parallax cloud bands + distant island silhouettes
    for (let layer = 0; layer < 3; layer++) {
      const par = 0.12 + layer * 0.16;
      const offX = -(this.camX * par) % (this.viewW + 400);
      const offY = this.viewH * (0.18 + layer * 0.2) - this.camY * par * 0.35;
      ctx.globalAlpha = night ? 0.18 + layer * 0.06 : 0.3 + layer * 0.14;
      ctx.fillStyle = night ? "#2b2450" : layer === 2 ? "#ffffff" : "#e6efff";
      for (let i = -1; i < 6; i++) {
        const bx = offX + i * 320 + layer * 90;
        const by = offY + Math.sin(i * 1.7 + layer) * 34;
        const s = 2 + layer;
        ctx.fillRect(bx, by, 26 * s, 5 * s);
        ctx.fillRect(bx + 5 * s, by - 4 * s, 16 * s, 6 * s);
        ctx.fillRect(bx + 11 * s, by - 7 * s, 8 * s, 5 * s);
      }
      if (layer < 2) {
        ctx.globalAlpha = night ? 0.28 : 0.22;
        ctx.fillStyle = night ? "#191338" : "#7d94c4";
        for (let i = -1; i < 5; i++) {
          const bx = offX * 0.7 + i * 420 + layer * 160;
          const by = offY + 120 + Math.sin(i * 2.3 + layer * 1.1) * 60;
          const rw = 60 + layer * 30;
          ctx.beginPath();
          ctx.moveTo(bx - rw, by);
          ctx.lineTo(bx + rw, by);
          ctx.lineTo(bx + rw * 0.3, by + 26 + layer * 10);
          ctx.lineTo(bx, by + 46 + layer * 16);
          ctx.lineTo(bx - rw * 0.35, by + 24 + layer * 10);
          ctx.closePath();
          ctx.fill();
          ctx.fillRect(bx - rw, by - 5, rw * 2, 5);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, id: number) {
    const x = tx * TILE;
    const y = ty * TILE;
    if (id === TORCH) {
      const cx = x + TILE / 2;
      ctx.fillStyle = "#5a3a1c";
      ctx.fillRect(cx - 2, y + TILE - 16, 4, 14);
      const fl = 0.8 + 0.2 * Math.sin(this.frame * 0.3 + tx * 1.7);
      ctx.fillStyle = "#ff9d3c";
      ctx.beginPath();
      ctx.ellipse(cx, y + TILE - 15, 4, 7 * fl, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd24a";
      ctx.beginPath();
      ctx.ellipse(cx, y + TILE - 15, 2.5, 5 * fl, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const v = (tx * 7 ^ ty * 13) & 3;
    ctx.drawImage(this.texFor(id, v), 0, 0, TEX, TEX, x, y, TILE, TILE);
    if (id === ALTAR) {
      const fl = 0.6 + 0.4 * Math.sin(this.frame * 0.08 + tx);
      ctx.save();
      ctx.globalAlpha = 0.5 * fl;
      ctx.fillStyle = "#c9a8ff";
      ctx.fillRect(x + 10, y - 40, 12, 44);
      ctx.restore();
      return;
    }
    if (!isSolid(getTile(this.world, tx, ty - 1))) {
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(x, y, TILE, 2);
    }
  }

  private drawCracks(ctx: CanvasRenderingContext2D) {
    const id = getTile(this.world, this.mineTX, this.mineTY);
    const def = TILES[id];
    if (!def) return;
    const prog = Math.min(1, this.mineProg / def.hp);
    const x = this.mineTX * TILE;
    const y = this.mineTY * TILE;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    const c = TILE / 2;
    const n = Math.floor(prog * 5);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      const a = (i / 5) * Math.PI * 2;
      ctx.moveTo(x + c, y + c);
      ctx.lineTo(x + c + Math.cos(a) * (TILE * 0.42), y + c + Math.sin(a) * (TILE * 0.42));
      ctx.stroke();
    }
  }

  private drawTarget(ctx: CanvasRenderingContext2D) {
    const tx = this.mouseTX;
    const ty = this.mouseTY;
    if (tx < 0 || ty < 0 || tx >= this.world.w || ty >= this.world.h) return;
    ctx.strokeStyle = this.withinReach(tx, ty) ? "rgba(255,255,255,0.85)" : "rgba(255,80,80,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
  }

  private drawShot(ctx: CanvasRenderingContext2D, s: Shot) {
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.kind === "rock") {
      ctx.rotate(this.frame * 0.1);
      ctx.fillStyle = "#5c6580";
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = "#b9c6de";
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = "#e2ecff";
      ctx.fillRect(-6, -6, 5, 4);
    } else if (s.kind === "bolt") {
      ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.fillStyle = "#7a3fc8";
      ctx.fillRect(-12, -4, 24, 8);
      ctx.fillStyle = "#e6cfff";
      ctx.fillRect(-9, -2, 20, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(2, -1, 8, 2);
    } else {
      ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.fillStyle = "#8a94b8";
      ctx.fillRect(-11, -3, 22, 6);
      ctx.fillStyle = "#eef4ff";
      ctx.fillRect(-8, -1.5, 18, 3);
    }
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const x = this.px;
    const y = this.py;
    const blink = this.invuln > 0 && Math.floor(this.frame / 4) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = this.onGround ? 0.3 : 0.14;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const moving = this.onGround && this.pvx !== 0;
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * -2 : this.onGround ? Math.sin(this.frame * 0.06) * 0.6 : 0;
    const footY = y + 22 + bob;

    if (this.gliding) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#dfe8ff";
      const flap = Math.sin(this.frame * 0.35) * 4;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 6);
      ctx.lineTo(x - 34, y - 2 - flap);
      ctx.lineTo(x - 12, y + 12);
      ctx.closePath();
      ctx.moveTo(x + 4, y - 6);
      ctx.lineTo(x + 34, y - 2 - flap);
      ctx.lineTo(x + 12, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const spr = getSprite("player");
    ctx.save();
    ctx.globalAlpha = blink ? 0.4 : 1;
    if (spr) {
      const scale = 56 / spr.height;
      const dw = spr.width * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.translate(x, footY);
      ctx.scale(this.pface, 1);
      ctx.drawImage(spr, 0, 0, spr.width, spr.height, -dw / 2, -56, dw, 56);
    } else {
      this.drawPlayerFallback(ctx, x, y + bob, moving);
    }
    ctx.restore();

    this.drawArmorOverlay(ctx, x, footY);
    this.drawTool(ctx, x, y + bob);
  }

  private drawArmorOverlay(ctx: CanvasRenderingContext2D, x: number, footY: number) {
    const set = this.setBonus();
    const tint = (id: string | null) => (id && ARMOR[id] ? ARMOR_TINT[ARMOR[id].set] : null);
    const head = tint(this.armor.head);
    const chest = tint(this.armor.chest);
    const legs = tint(this.armor.legs);
    ctx.save();
    ctx.translate(x, footY);
    ctx.scale(this.pface, 1);
    if (chest) {
      ctx.fillStyle = "#12101c";
      ctx.fillRect(-11, -35, 22, 20);
      ctx.fillStyle = chest;
      ctx.fillRect(-10, -34, 20, 18);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(-10, -34, 20, 3);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(-2, -34, 3, 18);
    }
    if (head) {
      ctx.fillStyle = "#12101c";
      ctx.fillRect(-9, -52, 18, 15);
      ctx.fillStyle = head;
      ctx.fillRect(-8, -51, 16, 13);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(1, -46, 6, 4);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(-8, -51, 16, 2);
    }
    if (legs) {
      ctx.fillStyle = "#12101c";
      ctx.fillRect(-10, -14, 9, 14);
      ctx.fillRect(1, -14, 9, 14);
      ctx.fillStyle = legs;
      ctx.fillRect(-9, -13, 7, 12);
      ctx.fillRect(2, -13, 7, 12);
    }
    ctx.restore();
    if (set) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.14 + 0.06 * Math.sin(this.frame * 0.08);
      ctx.fillStyle = ARMOR_TINT[set];
      ctx.beginPath();
      ctx.ellipse(x, footY - 26, 26, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlayerFallback(ctx: CanvasRenderingContext2D, x: number, y: number, moving: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.pface, 1);
    const legSwing = moving ? Math.sin(this.walkT) * 6 : 0;
    const OL = "#241208";
    ctx.fillStyle = OL;
    ctx.fillRect(-8, 8, 8, 16 + legSwing);
    ctx.fillRect(0, 8, 8, 16 - legSwing);
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(-7, 9, 6, 14 + legSwing);
    ctx.fillRect(1, 9, 6, 14 - legSwing);
    ctx.fillStyle = OL;
    ctx.fillRect(-10, -11, 20, 23);
    const tg = ctx.createLinearGradient(0, -11, 0, 12);
    tg.addColorStop(0, "#5aa0e0");
    tg.addColorStop(1, "#264f8a");
    ctx.fillStyle = tg;
    ctx.fillRect(-9, -10, 18, 21);
    ctx.fillStyle = OL;
    ctx.fillRect(-8, -26, 16, 16);
    ctx.fillStyle = "#fbd9aa";
    ctx.fillRect(-7, -25, 14, 14);
    ctx.fillStyle = "#1a2230";
    ctx.fillRect(3, -19, 3, 3);
    ctx.restore();
  }

  private drawTool(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const s = this.selectedSlot();
    const hasTool = s && ITEMS[s.id]?.kind === "tool";
    const swing = this.swingT > 0 ? Math.sin((1 - this.swingT / 0.18) * Math.PI) : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.pface, 1);
    ctx.translate(7, -4);
    ctx.rotate(-0.25 - swing * 1.7);
    ctx.fillStyle = "#f0c08a";
    ctx.fillRect(0, 0, 5, 11);
    if (hasTool) {
      const it = ITEMS[s!.id];
      const m = matOf(s!.id);
      const OL = "#14101f";
      ctx.translate(2, 0);
      ctx.rotate(0.35);
      ctx.strokeStyle = m.shaft;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 18);
      ctx.stroke();
      if (it.tool === "pickaxe") {
        ctx.strokeStyle = OL;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-11, 14);
        ctx.quadraticCurveTo(0, 7, 11, 14);
        ctx.stroke();
        ctx.strokeStyle = m.d;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-11, 14);
        ctx.quadraticCurveTo(0, 8, 11, 14);
        ctx.stroke();
        ctx.strokeStyle = m.h;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-10, 13);
        ctx.quadraticCurveTo(0, 9, 10, 13);
        ctx.stroke();
        if (m.gem) { ctx.fillStyle = m.gem; ctx.fillRect(-2, 10, 3, 3); }
      } else if (it.tool === "sword") {
        ctx.fillStyle = m.gem ?? "#9a6a3a";
        ctx.fillRect(-6, 0, 12, 3);
        ctx.fillStyle = OL;
        ctx.beginPath();
        ctx.moveTo(-3.5, 0);
        ctx.lineTo(3.5, 0);
        ctx.lineTo(2.5, -26);
        ctx.lineTo(0, -32);
        ctx.lineTo(-2.5, -26);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = m.d;
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.lineTo(2, -25);
        ctx.lineTo(0, -30);
        ctx.lineTo(-2, -25);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = m.h;
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(2, 0);
        ctx.lineTo(1, -23);
        ctx.lineTo(0, -28);
        ctx.lineTo(-1, -23);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillRect(0, -26, 1, 22);
      } else if (it.tool === "axe") {
        ctx.fillStyle = OL;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.quadraticCurveTo(15, 5, 15, 15);
        ctx.lineTo(12, 19);
        ctx.lineTo(0, 15);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = m.h;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.quadraticCurveTo(12, 7, 12, 13);
        ctx.lineTo(0, 13);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawMob(ctx: CanvasRenderingContext2D, m: Mob) {
    const flash = m.hitFlash > 0;
    const OL = "#0b0a16";
    ctx.save();
    ctx.globalAlpha = MOB_STATS[m.type].fly ? 0.12 : 0.26;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + m.h / 2 + 2, m.w * 0.5, MOB_STATS[m.type].fly ? 3 : 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(m.x, m.y);

    if (m.type === "sky_slime") {
      const R = m.w / 2;
      const squish = m.onGround ? 1 + Math.sin(m.t * 3) * 0.04 : 0.82;
      const cy = m.h / 2 - R * squish;
      ctx.fillStyle = OL;
      ctx.beginPath();
      ctx.ellipse(0, cy, R + 1.5, R * squish + 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(-R * 0.3, cy - R * 0.4, 2, 0, cy, R);
      g.addColorStop(0, "#e6fbff");
      g.addColorStop(0.6, "#8fd8ff");
      g.addColorStop(1, "#3f8fd0");
      ctx.fillStyle = flash ? "#fff" : g;
      ctx.beginPath();
      ctx.ellipse(0, cy, R, R * squish, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a1622";
      ctx.fillRect(-R * 0.45, cy - 2, 4, 5);
      ctx.fillRect(R * 0.1, cy - 2, 4, 5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-R * 0.45, cy, 2, 2);
      ctx.fillRect(R * 0.1, cy, 2, 2);
    } else if (m.type === "wisp") {
      const pulse = 0.75 + 0.25 * Math.sin(m.t * 6);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 18 * pulse);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, flash ? "#ffffff" : "#fff0a8");
      g.addColorStop(1, "rgba(255,200,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, 40, 40);
      ctx.fillStyle = OL;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = flash ? "#fff" : "#ffe27a";
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = "#2a1f00";
      ctx.fillRect(-3, -1, 2, 2);
      ctx.fillRect(1, -1, 2, 2);
    } else if (m.type === "harpy" || m.type === "matriarch") {
      const big = m.type === "matriarch";
      const s = big ? 2.1 : 1;
      const flap = Math.sin(m.t * (big ? 9 : 16)) * (big ? 14 : 8);
      ctx.scale(m.facing, 1);
      ctx.fillStyle = OL;
      ctx.beginPath();
      ctx.moveTo(-3 * s, 0);
      ctx.lineTo(-26 * s, -flap - 4);
      ctx.lineTo(-15 * s, 10 * s);
      ctx.closePath();
      ctx.moveTo(3 * s, 0);
      ctx.lineTo(26 * s, -flap - 4);
      ctx.lineTo(15 * s, 10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = flash ? "#fff" : big ? "#c8b0ff" : "#9fb6e8";
      ctx.beginPath();
      ctx.moveTo(-3 * s, 0);
      ctx.lineTo(-24 * s, -flap - 2);
      ctx.lineTo(-14 * s, 8 * s);
      ctx.closePath();
      ctx.moveTo(3 * s, 0);
      ctx.lineTo(24 * s, -flap - 2);
      ctx.lineTo(14 * s, 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = OL;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? "#fff" : big ? "#8f6fd8" : "#6f86b8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 9 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = OL;
      ctx.fillRect(-6 * s, -20 * s, 12 * s, 10 * s);
      ctx.fillStyle = flash ? "#fff" : big ? "#e0d0ff" : "#c8d6f4";
      ctx.fillRect(-5 * s, -19 * s, 10 * s, 8 * s);
      ctx.fillStyle = "#ffb03a";
      ctx.beginPath();
      ctx.moveTo(5 * s, -16 * s);
      ctx.lineTo(12 * s, -13 * s);
      ctx.lineTo(5 * s, -11 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(0, -17 * s, 3 * s, 3 * s);
      if (big) {
        ctx.fillStyle = "#ffd23b";
        ctx.beginPath();
        ctx.moveTo(-7 * s, -20 * s);
        ctx.lineTo(-4 * s, -28 * s);
        ctx.lineTo(0, -21 * s);
        ctx.lineTo(4 * s, -28 * s);
        ctx.lineTo(7 * s, -20 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#e8c86a";
      ctx.fillRect(-7 * s, 10 * s, 4 * s, 6 * s);
      ctx.fillRect(3 * s, 10 * s, 4 * s, 6 * s);
    } else if (m.type === "golem") {
      ctx.scale(m.facing, 1);
      const sway = Math.sin(m.t * 3) * 1.5;
      ctx.fillStyle = OL;
      ctx.fillRect(-19, -24 + sway, 38, 34);
      ctx.fillRect(-13, 10, 11, 14);
      ctx.fillRect(2, 10, 11, 14);
      ctx.fillStyle = flash ? "#fff" : "#aebbd4";
      ctx.fillRect(-17, -22 + sway, 34, 30);
      ctx.fillRect(-12, 11, 9, 12);
      ctx.fillRect(3, 11, 9, 12);
      ctx.fillStyle = "#8896b2";
      ctx.fillRect(-17, -6 + sway, 34, 4);
      ctx.fillStyle = OL;
      ctx.fillRect(-11, -40 + sway, 22, 17);
      ctx.fillStyle = flash ? "#fff" : "#c3cee4";
      ctx.fillRect(-10, -39 + sway, 20, 15);
      ctx.fillStyle = "#5fd8ff";
      ctx.fillRect(-6, -34 + sway, 5, 5);
      ctx.fillRect(2, -34 + sway, 5, 5);
      ctx.fillStyle = "#7fe0ff";
      ctx.fillRect(-4, -2 + sway, 8, 8);
      ctx.fillStyle = OL;
      ctx.fillRect(16, -18 + sway, 12, 24);
      ctx.fillStyle = flash ? "#fff" : "#9fadc8";
      ctx.fillRect(17, -17 + sway, 10, 22);
    } else if (m.type === "phantom") {
      const wob = Math.sin(m.t * 4) * 3;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = OL;
      ctx.beginPath();
      ctx.moveTo(-16, -14 + wob);
      ctx.quadraticCurveTo(0, -26 + wob, 16, -14 + wob);
      ctx.lineTo(14, 12);
      ctx.lineTo(8, 6);
      ctx.lineTo(2, 14);
      ctx.lineTo(-4, 5);
      ctx.lineTo(-10, 13);
      ctx.lineTo(-16, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = flash ? "#fff" : "#6a4ac0";
      ctx.beginPath();
      ctx.moveTo(-14, -13 + wob);
      ctx.quadraticCurveTo(0, -23 + wob, 14, -13 + wob);
      ctx.lineTo(12, 10);
      ctx.lineTo(7, 5);
      ctx.lineTo(2, 12);
      ctx.lineTo(-3, 4);
      ctx.lineTo(-9, 11);
      ctx.lineTo(-14, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff5fd0";
      ctx.fillRect(-7, -10 + wob, 4, 5);
      ctx.fillRect(3, -10 + wob, 4, 5);
      ctx.globalAlpha = 1;
    } else if (m.type === "titan") {
      ctx.scale(m.facing, 1);
      const rage = m.hp < m.maxHp / 2;
      const sway = Math.sin(m.t * 2) * 2;
      ctx.fillStyle = OL;
      ctx.fillRect(-38, -34 + sway, 76, 52);
      ctx.fillRect(-26, 18, 22, 24);
      ctx.fillRect(6, 18, 22, 24);
      ctx.fillStyle = flash ? "#fff" : rage ? "#c8a0b8" : "#aebbd4";
      ctx.fillRect(-35, -31 + sway, 70, 48);
      ctx.fillRect(-24, 20, 19, 21);
      ctx.fillRect(7, 20, 19, 21);
      ctx.fillStyle = rage ? "#8f5f78" : "#8896b2";
      ctx.fillRect(-35, -6 + sway, 70, 6);
      const cg = ctx.createRadialGradient(0, -8 + sway, 2, 0, -8 + sway, 16);
      cg.addColorStop(0, "#ffffff");
      cg.addColorStop(0.4, rage ? "#ff7a4a" : "#ffc44a");
      cg.addColorStop(1, "rgba(255,150,40,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(-18, -26 + sway, 36, 36);
      ctx.fillStyle = OL;
      ctx.fillRect(-17, -56 + sway, 34, 24);
      ctx.fillStyle = flash ? "#fff" : "#c3cee4";
      ctx.fillRect(-15, -54 + sway, 30, 21);
      ctx.fillStyle = rage ? "#ff5a3a" : "#5fd8ff";
      ctx.fillRect(-10, -47 + sway, 7, 7);
      ctx.fillRect(3, -47 + sway, 7, 7);
      ctx.fillStyle = OL;
      ctx.fillRect(32, -26 + sway, 20, 44);
      ctx.fillRect(-52, -26 + sway, 20, 44);
      ctx.fillStyle = flash ? "#fff" : "#9fadc8";
      ctx.fillRect(34, -24 + sway, 16, 40);
      ctx.fillRect(-50, -24 + sway, 16, 40);
    } else if (m.type === "aetherarch") {
      const rage = m.phase === 1;
      const halo = 0.7 + 0.3 * Math.sin(m.t * 3);
      ctx.scale(m.facing, 1);
      const hg = ctx.createRadialGradient(0, -10, 6, 0, -10, 90 * halo);
      hg.addColorStop(0, rage ? "rgba(255,140,220,0.55)" : "rgba(180,140,255,0.45)");
      hg.addColorStop(1, "rgba(120,80,220,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(-100, -110, 200, 200);
      const flap = Math.sin(m.t * 4) * 12;
      ctx.fillStyle = rage ? "rgba(255,150,230,0.75)" : "rgba(200,170,255,0.7)";
      for (let k = 0; k < 3; k++) {
        const o = k * 9;
        ctx.beginPath();
        ctx.moveTo(-8, -20 + o);
        ctx.lineTo(-72 - k * 6, -46 + o - flap);
        ctx.lineTo(-20, 4 + o);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, -20 + o);
        ctx.lineTo(72 + k * 6, -46 + o - flap);
        ctx.lineTo(20, 4 + o);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = OL;
      ctx.fillRect(-17, -34, 34, 58);
      ctx.fillStyle = flash ? "#fff" : rage ? "#4a1f52" : "#2e2352";
      ctx.fillRect(-15, -32, 30, 54);
      ctx.fillStyle = rage ? "#ff8ae0" : "#b48aff";
      ctx.fillRect(-15, -14, 30, 4);
      ctx.fillRect(-6, -32, 12, 54);
      ctx.fillStyle = OL;
      ctx.fillRect(-13, -58, 26, 26);
      ctx.fillStyle = flash ? "#fff" : "#170f2e";
      ctx.fillRect(-11, -56, 22, 23);
      ctx.fillStyle = rage ? "#ffd0f0" : "#dcc8ff";
      ctx.fillRect(-8, -50, 6, 6);
      ctx.fillRect(2, -50, 6, 6);
      ctx.fillStyle = rage ? "#ff5fd0" : "#c084ff";
      ctx.beginPath();
      ctx.moveTo(-14, -58);
      ctx.lineTo(-9, -76);
      ctx.lineTo(-3, -60);
      ctx.lineTo(0, -80);
      ctx.lineTo(3, -60);
      ctx.lineTo(9, -76);
      ctx.lineTo(14, -58);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (m.hp < m.maxHp && m.type !== "matriarch" && m.type !== "titan" && m.type !== "aetherarch") {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(m.x - m.w / 2, m.y - m.h / 2 - 10, m.w, 4);
      ctx.fillStyle = "#ff5a6a";
      ctx.fillRect(m.x - m.w / 2, m.y - m.h / 2 - 10, m.w * (m.hp / m.maxHp), 4);
    }
  }

  // ------------------------------------------------------------- lighting
  private buildGlowSprite() {
    const size = 128;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const c = cv.getContext("2d")!;
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.4, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    this.glowSprite = cv;
  }

  private drawGlow(ctx: CanvasRenderingContext2D, tx0: number, ty0: number, tx1: number, ty1: number, night: boolean) {
    const spr = this.glowSprite;
    if (!spr) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
    const pr = TILE * 2.2;
    ctx.globalAlpha = night ? 0.1 : 0.03;
    ctx.drawImage(spr, 0, 0, spr.width, spr.height, this.px - pr, this.py - 4 - pr, pr * 2, pr * 2);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const L = TILES[getTile(this.world, tx, ty)]?.light ?? 0;
        if (L < 3) continue;
        const fl = 0.75 + 0.25 * Math.sin(this.frame * 0.14 + tx * 1.7);
        const r = TILE * (0.5 + L * 0.13) * fl;
        ctx.globalAlpha = Math.min(0.4, 0.06 + L * 0.022) * fl;
        ctx.drawImage(spr, 0, 0, spr.width, spr.height, tx * TILE + TILE / 2 - r, ty * TILE + TILE / 2 - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
  }

  private drawLighting(tx0: number, ty0: number, tx1: number, ty1: number, bright: number) {
    const ctx = this.ctx;
    const night = this.isNightNow();
    const gw = tx1 - tx0 + 1;
    const gh = ty1 - ty0 + 1;
    if (gw <= 0 || gh <= 0) return;

    if (!this.lightBuf || this.lightW !== gw || this.lightH !== gh) {
      this.lightW = gw;
      this.lightH = gh;
      this.lightBuf = document.createElement("canvas");
      this.lightBuf.width = gw;
      this.lightBuf.height = gh;
      this.lightImg = this.lightBuf.getContext("2d")!.createImageData(gw, gh);
      this.lightGrid = new Float32Array(gw * gh);
      this.lightTmp = new Float32Array(gw * gh);
      this.colTop = new Int16Array(gw);
    }
    const grid = this.lightGrid!;
    const tmp = this.lightTmp!;
    const colTop = this.colTop!;

    // local surface = first solid tile at or below the top of the view
    for (let i = 0; i < gw; i++) {
      const tx = tx0 + i;
      let top = ty1 + 99;
      for (let ty = ty0; ty <= ty1; ty++) {
        if (isSolid(getTile(this.world, tx, ty))) { top = ty; break; }
      }
      colTop[i] = top;
    }

    const skyAmbient = Math.max(bright, night ? 0.2 : 0.32);
    for (let j = 0; j < gh; j++) {
      const ty = ty0 + j;
      for (let i = 0; i < gw; i++) {
        const top = colTop[i];
        grid[j * gw + i] = ty <= top ? skyAmbient : skyAmbient * Math.max(0, 1 - (ty - top) / 4) * 0.45;
      }
    }

    const addLight = (wx: number, wy: number, rTiles: number, intensity: number) => {
      const cx = wx / TILE - tx0;
      const cy = wy / TILE - ty0;
      const i0 = Math.max(0, Math.floor(cx - rTiles));
      const i1 = Math.min(gw - 1, Math.ceil(cx + rTiles));
      const j0 = Math.max(0, Math.floor(cy - rTiles));
      const j1 = Math.min(gh - 1, Math.ceil(cy + rTiles));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dist = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
          if (dist >= rTiles) continue;
          const v = 1 - dist / rTiles;
          const idx = j * gw + i;
          grid[idx] = Math.min(1, Math.max(grid[idx], v * v * intensity));
        }
      }
    };
    addLight(this.px, this.py - 6, 6.5, night ? 1 : 0.7);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const L = TILES[getTile(this.world, tx, ty)]?.light ?? 0;
        if (L > 0) addLight(tx * TILE + TILE / 2, ty * TILE + TILE / 2, L * 0.5 + 2, 1);
      }
    }

    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        let s = grid[j * gw + i];
        let n = 1;
        if (i > 0) { s += grid[j * gw + i - 1]; n++; }
        if (i < gw - 1) { s += grid[j * gw + i + 1]; n++; }
        tmp[j * gw + i] = s / n;
      }
    }
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        let s = tmp[j * gw + i];
        let n = 1;
        if (j > 0) { s += tmp[(j - 1) * gw + i]; n++; }
        if (j < gh - 1) { s += tmp[(j + 1) * gw + i]; n++; }
        grid[j * gw + i] = s / n;
      }
    }

    const data = this.lightImg!.data;
    const dr = night ? 8 : 2;
    const dg = night ? 6 : 2;
    const db = night ? 26 : 8;
    for (let p = 0; p < grid.length; p++) {
      const o = p * 4;
      data[o] = dr;
      data[o + 1] = dg;
      data[o + 2] = db;
      data[o + 3] = (1 - Math.min(1, grid[p])) * 255;
    }
    this.lightBuf!.getContext("2d")!.putImageData(this.lightImg!, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.lightBuf!, 0, 0, gw, gh, tx0 * TILE - this.camX, ty0 * TILE - this.camY, gw * TILE, gh * TILE);
    ctx.restore();
  }
}

/** Tile colours for the Chapter II minimap. */
export const SKY_MINIMAP_COLORS: Record<number, string> = {
  [SKY_GRASS]: "#7fe3c0",
  [SKY_STONE]: "#b9c6de",
  [CLOUD]: "#eef4ff",
  [SKY_WOOD]: "#8f7fb8",
  [SKY_LEAVES]: "#7fe0d0",
  [AETHERITE]: "#5fd8ff",
  [SUNSTONE]: "#ffc44a",
  [STORMCORE]: "#b06bff",
  [VOIDSHARD]: "#ff5fd0",
  [VOID_STONE]: "#453f5c",
  [LUMEN]: "#ffe9a8",
  [SKYFORGE]: "#7a86a8",
  [ALTAR]: "#c9a8ff",
};
