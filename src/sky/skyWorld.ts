// src/sky/skyWorld.ts — CHAPTER II "SKY ISLANDS" content pack.
// Registers new tiles / items into the shared registries from ../world so that
// isSolid(), getTile() and the inventory keep working unchanged, then exposes
// Chapter-II-only recipes, armor sets and the floating-island world generator.

import { TILES, ITEMS, AIR, type World } from "../world";

// ---------------------------------------------------------------- tile ids
// Chapter I uses 0..21, so Chapter II starts at 30 to leave room.
export const SKY_GRASS = 30;
export const SKY_DIRT = 31;
export const SKY_STONE = 32;
export const CLOUD = 33;
export const SKY_WOOD = 34;
export const SKY_LEAVES = 35;
export const AETHERITE = 36;
export const SUNSTONE = 37;
export const STORMCORE = 38;
export const VOIDSHARD = 39;
export const SKY_PLANK = 40;
export const LUMEN = 41;
export const SKY_GLASS = 42;
export const VOID_STONE = 43;
export const SKYFORGE = 44;
export const ALTAR = 45;

/** Every tile id introduced by Chapter II (used to route texture lookups). */
export const SKY_TILE_IDS = new Set<number>([
  SKY_GRASS, SKY_DIRT, SKY_STONE, CLOUD, SKY_WOOD, SKY_LEAVES,
  AETHERITE, SUNSTONE, STORMCORE, VOIDSHARD,
  SKY_PLANK, LUMEN, SKY_GLASS, VOID_STONE, SKYFORGE, ALTAR,
]);

// ---------------------------------------------------------------- tile defs
TILES[SKY_GRASS] = { name: "Aether Grass", solid: true, color: "#7fe3c0", shade: "#3f9c84", minTier: 0, hp: 2, drop: "sky_dirt", dropMin: 1, dropMax: 1 };
TILES[SKY_DIRT] = { name: "Cloud Soil", solid: true, color: "#9aa8c8", shade: "#6a7594", minTier: 0, hp: 2, drop: "sky_dirt", dropMin: 1, dropMax: 1 };
TILES[SKY_STONE] = { name: "Skystone", solid: true, color: "#b9c6de", shade: "#7d89a4", minTier: 1, hp: 9, drop: "sky_stone", dropMin: 1, dropMax: 1 };
TILES[CLOUD] = { name: "Cloud Block", solid: true, color: "#eef4ff", shade: "#c3cfe6", minTier: 0, hp: 1, drop: "cloud", dropMin: 1, dropMax: 1, light: 1 };
TILES[SKY_WOOD] = { name: "Aetherwood", solid: true, color: "#8f7fb8", shade: "#5d5183", minTier: 0, hp: 7, drop: "sky_wood", dropMin: 1, dropMax: 2 };
TILES[SKY_LEAVES] = { name: "Glowleaf", solid: false, color: "#7fe0d0", shade: "#3f9c94", minTier: 0, hp: 1, drop: "glowfruit", dropMin: 1, dropMax: 1, light: 2 };
TILES[AETHERITE] = { name: "Aetherite Ore", solid: true, color: "#b9c6de", shade: "#7d89a4", minTier: 3, hp: 16, drop: "aetherite_ore", speckle: "#5fd8ff" };
TILES[SUNSTONE] = { name: "Sunstone Ore", solid: true, color: "#b9c6de", shade: "#7d89a4", minTier: 4, hp: 22, drop: "sunstone_ore", speckle: "#ffc44a", light: 6 };
TILES[STORMCORE] = { name: "Storm Core Ore", solid: true, color: "#8f9ab6", shade: "#5c6580", minTier: 5, hp: 28, drop: "storm_core", speckle: "#b06bff", light: 5 };
TILES[VOIDSHARD] = { name: "Voidshard Ore", solid: true, color: "#4a4460", shade: "#282338", minTier: 6, hp: 36, drop: "void_shard", speckle: "#ff5fd0", light: 3 };
TILES[SKY_PLANK] = { name: "Aether Planks", solid: true, color: "#a894d0", shade: "#6f5f96", minTier: 0, hp: 5, drop: "sky_plank" };
TILES[LUMEN] = { name: "Lumen Block", solid: true, color: "#ffe9a8", shade: "#d9b455", minTier: 0, hp: 4, drop: "lumen", light: 14 };
TILES[SKY_GLASS] = { name: "Crystal Pane", solid: true, color: "#cdeeff", shade: "#8fc4de", minTier: 0, hp: 2, drop: "sky_glass", light: 1 };
TILES[VOID_STONE] = { name: "Voidstone", solid: true, color: "#453f5c", shade: "#241f34", minTier: 3, hp: 18, drop: "void_stone", dropMin: 1, dropMax: 1 };
TILES[SKYFORGE] = { name: "Skyforge", solid: true, color: "#7a86a8", shade: "#464e68", minTier: 0, hp: 8, drop: "skyforge", light: 6 };
TILES[ALTAR] = { name: "Storm Altar", solid: true, color: "#6f5fa8", shade: "#3b3164", minTier: 99, hp: 9999, light: 8 };

// ---------------------------------------------------------------- items
const M = "material" as const;
const T = "tool" as const;

Object.assign(ITEMS, {
  // blocks & raw
  sky_dirt: { name: "Cloud Soil", place: SKY_DIRT, max: 99, kind: M, color: "#9aa8c8", icon: "\u2601\ufe0f" },
  sky_stone: { name: "Skystone", place: SKY_STONE, max: 99, kind: M, color: "#b9c6de", icon: "\ud83e\udea8" },
  cloud: { name: "Cloud Block", place: CLOUD, max: 99, kind: M, color: "#eef4ff", icon: "\u2601\ufe0f" },
  sky_wood: { name: "Aetherwood", place: SKY_WOOD, max: 99, kind: M, color: "#8f7fb8", icon: "\ud83e\udeb5" },
  sky_plank: { name: "Aether Planks", place: SKY_PLANK, max: 99, kind: M, color: "#a894d0", icon: "\ud83d\udfea" },
  sky_glass: { name: "Crystal Pane", place: SKY_GLASS, max: 99, kind: M, color: "#cdeeff", icon: "\ud83d\udd37" },
  void_stone: { name: "Voidstone", place: VOID_STONE, max: 99, kind: M, color: "#453f5c", icon: "\u2b1b" },
  lumen: { name: "Lumen Block", place: LUMEN, max: 99, kind: M, color: "#ffe9a8", icon: "\ud83d\udca1", desc: "A lamp that never dies" },
  skyforge: { name: "Skyforge", place: SKYFORGE, max: 99, kind: M, color: "#7a86a8", icon: "\u2699\ufe0f", desc: "Forges sky metals" },
  // ores & bars
  aetherite_ore: { name: "Aetherite Ore", place: AETHERITE, max: 99, kind: M, color: "#5fd8ff", icon: "\ud83d\udd35" },
  sunstone_ore: { name: "Sunstone Ore", place: SUNSTONE, max: 99, kind: M, color: "#ffc44a", icon: "\ud83c\udf1e" },
  storm_core: { name: "Storm Core", place: STORMCORE, max: 99, kind: M, color: "#b06bff", icon: "\u26a1" },
  void_shard: { name: "Voidshard", place: VOIDSHARD, max: 99, kind: M, color: "#ff5fd0", icon: "\ud83d\udd2e" },
  aetherite_bar: { name: "Aetherite Bar", max: 99, kind: M, color: "#7fe0ff", icon: "\ud83e\uddca" },
  sunsteel_bar: { name: "Sunsteel Bar", max: 99, kind: M, color: "#ffcf5a", icon: "\ud83d\udfe8" },
  storm_alloy: { name: "Storm Alloy", max: 99, kind: M, color: "#c084ff", icon: "\ud83d\udfea" },
  void_ingot: { name: "Void Ingot", max: 99, kind: M, color: "#ff7fe0", icon: "\u2b1c" },
  // loot
  feather: { name: "Storm Feather", max: 99, kind: M, color: "#dfe8ff", icon: "\ud83e\udeb6", desc: "Dropped by harpies" },
  glow_dust: { name: "Glow Dust", max: 99, kind: M, color: "#fff0a8", icon: "\u2728", desc: "Dropped by wisps" },
  titan_heart: { name: "Titan Heart", max: 99, kind: M, color: "#ffb45a", icon: "\ud83e\udde1", desc: "Core of the Cloud Titan" },
  wind_sigil: { name: "Wind Sigil", max: 99, kind: M, color: "#9fe8ff", icon: "\ud83c\udf00", desc: "Torn from the Matriarch" },
  glowfruit: { name: "Glowfruit", max: 99, kind: M, color: "#7fe0d0", icon: "\ud83c\udf50", desc: "Eat to heal 40 HP" },
  // summons
  talon_whistle: { name: "Talon Whistle", max: 99, kind: M, color: "#dfe8ff", icon: "\ud83d\udcef", desc: "Calls the Harpy Matriarch" },
  titan_call: { name: "Titan Call", max: 99, kind: M, color: "#ffb45a", icon: "\ud83e\udea8", desc: "Wakes the Cloud Titan" },
  storm_horn: { name: "Storm Horn", max: 99, kind: M, color: "#c084ff", icon: "\ud83d\udce3", desc: "Challenges the Aetherarch at the Altar" },
  // accessory
  feather_cloak: { name: "Feather Cloak", max: 1, kind: M, color: "#dfe8ff", icon: "\ud83e\udd85", desc: "Hold jump while falling to glide" },
  // pickaxes
  aether_pickaxe: { name: "Aetherite Pickaxe", kind: T, tool: "pickaxe", tier: 4, power: 10, dmg: 14, color: "#7fe0ff", icon: "\u26cf\ufe0f", desc: "Mines sunstone" },
  sunsteel_pickaxe: { name: "Sunsteel Pickaxe", kind: T, tool: "pickaxe", tier: 5, power: 14, dmg: 18, color: "#ffcf5a", icon: "\u26cf\ufe0f", desc: "Mines storm cores" },
  storm_pickaxe: { name: "Stormforged Pickaxe", kind: T, tool: "pickaxe", tier: 6, power: 19, dmg: 24, color: "#c084ff", icon: "\u26cf\ufe0f", desc: "Mines voidshards" },
  void_pickaxe: { name: "Void Pickaxe", kind: T, tool: "pickaxe", tier: 7, power: 26, dmg: 30, color: "#ff7fe0", icon: "\u26cf\ufe0f", desc: "Breaks anything, fast" },
  // swords
  aether_sword: { name: "Aether Sword", kind: T, tool: "sword", dmg: 42, color: "#7fe0ff", icon: "\u2694\ufe0f" },
  sun_glaive: { name: "Sun Glaive", kind: T, tool: "sword", dmg: 58, color: "#ffcf5a", icon: "\u2694\ufe0f", desc: "Burns what it cuts" },
  storm_blade: { name: "Storm Blade", kind: T, tool: "sword", dmg: 72, color: "#c084ff", icon: "\u26a1", desc: "Chains lightning to nearby foes" },
  void_reaver: { name: "Void Reaver", kind: T, tool: "sword", dmg: 95, color: "#ff7fe0", icon: "\ud83d\udde1\ufe0f", desc: "Steals life with every hit" },
  // axe
  aether_axe: { name: "Aether Axe", kind: T, tool: "axe", power: 12, dmg: 20, color: "#7fe0ff", icon: "\ud83e\ude93", desc: "Fells aetherwood instantly" },
  // armor — cloudweave
  cloud_helm: { name: "Cloudweave Hood", max: 1, kind: M, color: "#dfe8ff", icon: "\ud83e\ude96" },
  cloud_chest: { name: "Cloudweave Robe", max: 1, kind: M, color: "#dfe8ff", icon: "\ud83e\uddba" },
  cloud_boots: { name: "Cloudweave Steps", max: 1, kind: M, color: "#dfe8ff", icon: "\ud83d\udc62" },
  // armor — sunsteel
  sunsteel_helm: { name: "Sunsteel Helm", max: 1, kind: M, color: "#ffcf5a", icon: "\u26d1\ufe0f" },
  sunsteel_chest: { name: "Sunsteel Cuirass", max: 1, kind: M, color: "#ffcf5a", icon: "\ud83e\uddba" },
  sunsteel_boots: { name: "Sunsteel Greaves", max: 1, kind: M, color: "#ffcf5a", icon: "\ud83e\udd7e" },
  // armor — stormforged
  storm_helm: { name: "Stormforged Crown", max: 1, kind: M, color: "#c084ff", icon: "\ud83d\udc51" },
  storm_chest: { name: "Stormforged Plate", max: 1, kind: M, color: "#c084ff", icon: "\ud83e\uddba" },
  storm_boots: { name: "Stormforged Treads", max: 1, kind: M, color: "#c084ff", icon: "\ud83e\udd7e" },
  // armor — voidplate
  void_helm: { name: "Voidplate Visor", max: 1, kind: M, color: "#ff7fe0", icon: "\ud83d\udc80" },
  void_chest: { name: "Voidplate Carapace", max: 1, kind: M, color: "#ff7fe0", icon: "\ud83e\uddba" },
  void_boots: { name: "Voidplate Striders", max: 1, kind: M, color: "#ff7fe0", icon: "\ud83e\udd7e" },
});

// ---------------------------------------------------------------- armor
export type ArmorSlot = "head" | "chest" | "legs";
export interface ArmorDef { slot: ArmorSlot; defense: number; set: ArmorSet; }
export type ArmorSet = "cloud" | "sunsteel" | "storm" | "void";

export const ARMOR: Record<string, ArmorDef> = {
  cloud_helm: { slot: "head", defense: 2, set: "cloud" },
  cloud_chest: { slot: "chest", defense: 3, set: "cloud" },
  cloud_boots: { slot: "legs", defense: 2, set: "cloud" },
  sunsteel_helm: { slot: "head", defense: 4, set: "sunsteel" },
  sunsteel_chest: { slot: "chest", defense: 6, set: "sunsteel" },
  sunsteel_boots: { slot: "legs", defense: 4, set: "sunsteel" },
  storm_helm: { slot: "head", defense: 6, set: "storm" },
  storm_chest: { slot: "chest", defense: 9, set: "storm" },
  storm_boots: { slot: "legs", defense: 6, set: "storm" },
  void_helm: { slot: "head", defense: 9, set: "void" },
  void_chest: { slot: "chest", defense: 13, set: "void" },
  void_boots: { slot: "legs", defense: 9, set: "void" },
};

/** i18n keys are resolved by the Chapter II dictionary. */
export const SET_BONUS: Record<ArmorSet, { key: string; color: string }> = {
  cloud: { key: "set_cloud", color: "#dfe8ff" },
  sunsteel: { key: "set_sunsteel", color: "#ffcf5a" },
  storm: { key: "set_storm", color: "#c084ff" },
  void: { key: "set_void", color: "#ff7fe0" },
};

/** Swords with an on-hit gimmick. */
export const WEAPON_FX: Record<string, "burn" | "chain" | "leech"> = {
  sun_glaive: "burn",
  storm_blade: "chain",
  void_reaver: "leech",
};

// ---------------------------------------------------------------- recipes
export type SkyStation = "none" | "workbench" | "furnace" | "skyforge";
export interface SkyRecipe {
  id: string;
  out: string;
  outCount: number;
  station: SkyStation;
  ing: { id: string; n: number }[];
}

export const SKY_RECIPES: SkyRecipe[] = [
  // basics
  { id: "sky_plank", out: "sky_plank", outCount: 2, station: "workbench", ing: [{ id: "sky_wood", n: 1 }] },
  { id: "sky_torch", out: "torch", outCount: 4, station: "none", ing: [{ id: "sky_wood", n: 1 }, { id: "glow_dust", n: 1 }] },
  { id: "sky_glass", out: "sky_glass", outCount: 2, station: "furnace", ing: [{ id: "cloud", n: 2 }] },
  { id: "lumen", out: "lumen", outCount: 1, station: "furnace", ing: [{ id: "sunstone_ore", n: 2 }, { id: "glow_dust", n: 1 }] },
  { id: "skyforge", out: "skyforge", outCount: 1, station: "workbench", ing: [{ id: "sky_stone", n: 30 }, { id: "aetherite_bar", n: 4 }] },
  // smelting
  { id: "aetherite_bar", out: "aetherite_bar", outCount: 1, station: "furnace", ing: [{ id: "aetherite_ore", n: 3 }] },
  { id: "sunsteel_bar", out: "sunsteel_bar", outCount: 1, station: "skyforge", ing: [{ id: "sunstone_ore", n: 3 }, { id: "aetherite_bar", n: 1 }] },
  { id: "storm_alloy", out: "storm_alloy", outCount: 1, station: "skyforge", ing: [{ id: "storm_core", n: 2 }, { id: "sunsteel_bar", n: 2 }] },
  { id: "void_ingot", out: "void_ingot", outCount: 1, station: "skyforge", ing: [{ id: "void_shard", n: 3 }, { id: "storm_alloy", n: 1 }] },
  // tools
  { id: "aether_pickaxe", out: "aether_pickaxe", outCount: 1, station: "workbench", ing: [{ id: "aetherite_bar", n: 10 }, { id: "sky_wood", n: 3 }] },
  { id: "aether_axe", out: "aether_axe", outCount: 1, station: "workbench", ing: [{ id: "aetherite_bar", n: 6 }, { id: "sky_wood", n: 3 }] },
  { id: "aether_sword", out: "aether_sword", outCount: 1, station: "workbench", ing: [{ id: "aetherite_bar", n: 8 }, { id: "sky_wood", n: 2 }] },
  { id: "sunsteel_pickaxe", out: "sunsteel_pickaxe", outCount: 1, station: "skyforge", ing: [{ id: "sunsteel_bar", n: 12 }, { id: "sky_plank", n: 3 }] },
  { id: "sun_glaive", out: "sun_glaive", outCount: 1, station: "skyforge", ing: [{ id: "sunsteel_bar", n: 10 }, { id: "sky_plank", n: 4 }] },
  { id: "storm_pickaxe", out: "storm_pickaxe", outCount: 1, station: "skyforge", ing: [{ id: "storm_alloy", n: 10 }, { id: "sky_plank", n: 4 }] },
  { id: "storm_blade", out: "storm_blade", outCount: 1, station: "skyforge", ing: [{ id: "storm_alloy", n: 12 }, { id: "wind_sigil", n: 1 }] },
  { id: "void_pickaxe", out: "void_pickaxe", outCount: 1, station: "skyforge", ing: [{ id: "void_ingot", n: 12 }, { id: "sky_plank", n: 5 }] },
  { id: "void_reaver", out: "void_reaver", outCount: 1, station: "skyforge", ing: [{ id: "void_ingot", n: 16 }, { id: "titan_heart", n: 1 }] },
  // accessory
  { id: "feather_cloak", out: "feather_cloak", outCount: 1, station: "workbench", ing: [{ id: "feather", n: 24 }, { id: "aetherite_bar", n: 6 }] },
  // armor — cloudweave
  { id: "cloud_helm", out: "cloud_helm", outCount: 1, station: "workbench", ing: [{ id: "cloud", n: 8 }, { id: "aetherite_bar", n: 2 }] },
  { id: "cloud_chest", out: "cloud_chest", outCount: 1, station: "workbench", ing: [{ id: "cloud", n: 12 }, { id: "aetherite_bar", n: 4 }] },
  { id: "cloud_boots", out: "cloud_boots", outCount: 1, station: "workbench", ing: [{ id: "cloud", n: 8 }, { id: "aetherite_bar", n: 2 }] },
  // armor — sunsteel
  { id: "sunsteel_helm", out: "sunsteel_helm", outCount: 1, station: "skyforge", ing: [{ id: "sunsteel_bar", n: 8 }] },
  { id: "sunsteel_chest", out: "sunsteel_chest", outCount: 1, station: "skyforge", ing: [{ id: "sunsteel_bar", n: 14 }] },
  { id: "sunsteel_boots", out: "sunsteel_boots", outCount: 1, station: "skyforge", ing: [{ id: "sunsteel_bar", n: 8 }] },
  // armor — stormforged
  { id: "storm_helm", out: "storm_helm", outCount: 1, station: "skyforge", ing: [{ id: "storm_alloy", n: 8 }] },
  { id: "storm_chest", out: "storm_chest", outCount: 1, station: "skyforge", ing: [{ id: "storm_alloy", n: 14 }] },
  { id: "storm_boots", out: "storm_boots", outCount: 1, station: "skyforge", ing: [{ id: "storm_alloy", n: 8 }] },
  // armor — voidplate
  { id: "void_helm", out: "void_helm", outCount: 1, station: "skyforge", ing: [{ id: "void_ingot", n: 10 }] },
  { id: "void_chest", out: "void_chest", outCount: 1, station: "skyforge", ing: [{ id: "void_ingot", n: 18 }] },
  { id: "void_boots", out: "void_boots", outCount: 1, station: "skyforge", ing: [{ id: "void_ingot", n: 10 }] },
  // summons
  { id: "talon_whistle", out: "talon_whistle", outCount: 1, station: "workbench", ing: [{ id: "feather", n: 14 }, { id: "aetherite_bar", n: 4 }] },
  { id: "titan_call", out: "titan_call", outCount: 1, station: "skyforge", ing: [{ id: "storm_core", n: 6 }, { id: "sunsteel_bar", n: 6 }] },
  { id: "storm_horn", out: "storm_horn", outCount: 1, station: "skyforge", ing: [{ id: "void_ingot", n: 4 }, { id: "titan_heart", n: 1 }, { id: "wind_sigil", n: 1 }] },
];

// ---------------------------------------------------------------- quests
export interface SkyQuest { key: string; check: string; n: number; reward?: "hp20" | "hp30" | "hp40"; }

/** Chapter II quest chain (XII .. XXII). `check` is resolved by the engine. */
export const SKY_QUESTS: SkyQuest[] = [
  { key: "k0", check: "have:sky_wood", n: 15 },
  { key: "k1", check: "mined:sky_stone", n: 25, reward: "hp20" },
  { key: "k2", check: "have:aetherite_bar", n: 3 },
  { key: "k3", check: "armorset:cloud", n: 3, reward: "hp20" },
  { key: "k4", check: "have:feather_cloak", n: 1 },
  { key: "k5", check: "killed:matriarch", n: 1, reward: "hp30" },
  { key: "k6", check: "have:sunsteel_bar", n: 3 },
  { key: "k7", check: "have:storm_core", n: 6, reward: "hp30" },
  { key: "k8", check: "killed:titan", n: 1, reward: "hp40" },
  { key: "k9", check: "have:storm_horn", n: 1 },
  { key: "k10", check: "killed:aetherarch", n: 1 },
];

// ---------------------------------------------------------------- worldgen
export const SKY_W = 400;
export const SKY_H = 160;
/** Anything that falls past this row is gone forever. */
export const VOID_Y = SKY_H - 4;

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Island { cx: number; cy: number; rx: number; ry: number; band: number; }

export interface SkyWorld extends World {
  /** Row of the Storm Altar (boss arena) so the HUD can point at it. */
  altarX: number;
  altarY: number;
}

function put(w: World, x: number, y: number, id: number) {
  if (x < 0 || x >= w.w || y < 0 || y >= w.h) return;
  w.tiles[y * w.w + x] = id;
}
function at(w: World, x: number, y: number): number {
  if (x < 0 || x >= w.w || y < 0 || y >= w.h) return AIR;
  return w.tiles[y * w.w + x];
}

function buildIsland(w: World, isl: Island, rand: () => number) {
  const stone = isl.band === 2 ? VOID_STONE : SKY_STONE;
  for (let x = isl.cx - isl.rx; x <= isl.cx + isl.rx; x++) {
    if (x < 1 || x >= w.w - 1) continue;
    const t = (x - isl.cx) / isl.rx;
    const bulge = Math.sqrt(Math.max(0, 1 - t * t));
    if (bulge <= 0.02) continue;
    const wobble = Math.round((rand() - 0.5) * 2);
    const top = Math.round(isl.cy - isl.ry * 0.3 * bulge) + wobble;
    const depth = Math.max(2, Math.round(isl.ry * 1.7 * bulge * bulge + 2));
    for (let d = 0; d < depth; d++) {
      const y = top + d;
      let id: number;
      if (d === 0) id = isl.band === 2 ? VOID_STONE : SKY_GRASS;
      else if (d <= 2) id = isl.band === 2 ? VOID_STONE : SKY_DIRT;
      else id = stone;
      put(w, x, y, id);
    }
    // fluffy cloud fringe hanging under the biggest islands
    if (isl.rx > 16 && bulge > 0.55 && rand() < 0.5) {
      put(w, x, top + depth, CLOUD);
    }
  }
}

function hollowCaves(w: World, isl: Island, rand: () => number) {
  if (isl.rx < 12) return;
  const pockets = 1 + Math.floor(rand() * 3);
  for (let p = 0; p < pockets; p++) {
    const px = isl.cx + Math.round((rand() - 0.5) * isl.rx * 1.2);
    const py = isl.cy + 3 + Math.round(rand() * isl.ry * 0.8);
    const r = 2 + rand() * 3;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const tx = px + dx;
        const ty = py + dy;
        const cur = at(w, tx, ty);
        if (cur === SKY_STONE || cur === VOID_STONE) put(w, tx, ty, AIR);
      }
    }
  }
}

function seedOres(w: World, isl: Island, rand: () => number) {
  // band 0 = sun-drenched upper isles, 1 = main archipelago, 2 = void depths
  const table: { id: number; chance: number; size: number }[] =
    isl.band === 0
      ? [
          { id: AETHERITE, chance: 0.02, size: 5 },
          { id: SUNSTONE, chance: 0.018, size: 4 },
        ]
      : isl.band === 1
      ? [
          { id: AETHERITE, chance: 0.028, size: 5 },
          { id: SUNSTONE, chance: 0.007, size: 3 },
          { id: STORMCORE, chance: 0.005, size: 3 },
        ]
      : [
          { id: STORMCORE, chance: 0.016, size: 4 },
          { id: VOIDSHARD, chance: 0.011, size: 3 },
          { id: AETHERITE, chance: 0.006, size: 3 },
        ];
  for (let x = isl.cx - isl.rx; x <= isl.cx + isl.rx; x++) {
    for (let y = isl.cy - isl.ry; y <= isl.cy + isl.ry * 2; y++) {
      const cur = at(w, x, y);
      if (cur !== SKY_STONE && cur !== VOID_STONE) continue;
      for (const ore of table) {
        if (rand() < ore.chance) {
          let vx = x;
          let vy = y;
          for (let i = 0; i < ore.size; i++) {
            const c = at(w, vx, vy);
            if (c === SKY_STONE || c === VOID_STONE) put(w, vx, vy, ore.id);
            vx += Math.floor(rand() * 3) - 1;
            vy += Math.floor(rand() * 3) - 1;
          }
          break;
        }
      }
    }
  }
}

function growTrees(w: World, isl: Island, rand: () => number) {
  if (isl.band === 2) return;
  for (let x = isl.cx - isl.rx + 2; x <= isl.cx + isl.rx - 2; x++) {
    for (let y = isl.cy - isl.ry - 4; y <= isl.cy + 4; y++) {
      if (at(w, x, y) !== SKY_GRASS) continue;
      if (at(w, x, y - 1) !== AIR) break;
      if (rand() < 0.13) {
        const h = 4 + Math.floor(rand() * 4);
        for (let i = 1; i <= h; i++) put(w, x, y - i, SKY_WOOD);
        const top = y - h;
        for (let dy = -2; dy <= 1; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > 3) continue;
            if (at(w, x + dx, top + dy) === AIR) put(w, x + dx, top + dy, SKY_LEAVES);
          }
        }
      }
      break;
    }
  }
}

/** Generates the Chapter II archipelago. Deterministic for a given seed. */
export function generateSkyWorld(seed = 1337): SkyWorld {
  const rand = mulberry32(seed);
  const w: SkyWorld = {
    w: SKY_W,
    h: SKY_H,
    tiles: new Uint8Array(SKY_W * SKY_H),
    surfaceY: new Int16Array(SKY_W),
    spawnX: Math.floor(SKY_W / 2),
    spawnY: 60,
    altarX: 0,
    altarY: 0,
  };
  w.tiles.fill(AIR);

  const islands: Island[] = [];

  // the landing island — always the same generous plateau under the player
  const home: Island = { cx: Math.floor(SKY_W / 2), cy: 74, rx: 30, ry: 9, band: 1 };
  islands.push(home);

  const bandRange: [number, number][] = [
    [24, 44],
    [60, 96],
    [112, 140],
  ];
  const bandCount = [8, 15, 11];
  for (let band = 0; band < 3; band++) {
    for (let i = 0; i < bandCount[band]; i++) {
      const cx = 18 + Math.floor(rand() * (SKY_W - 36));
      const [lo, hi] = bandRange[band];
      const cy = lo + Math.floor(rand() * (hi - lo));
      const rx = 7 + Math.floor(rand() * (band === 1 ? 20 : 14));
      const ry = 4 + Math.floor(rand() * 8);
      // keep clear of the home plateau
      if (Math.abs(cx - home.cx) < home.rx + rx + 6 && Math.abs(cy - home.cy) < 18) continue;
      islands.push({ cx, cy, rx, ry, band });
    }
  }

  for (const isl of islands) buildIsland(w, isl, rand);
  for (const isl of islands) hollowCaves(w, isl, rand);
  for (const isl of islands) seedOres(w, isl, rand);
  for (const isl of islands) growTrees(w, isl, rand);

  // clear the spawn pocket so the hero never lands inside a tree
  const sx = home.cx;
  let groundY = 0;
  for (let y = 0; y < w.h; y++) {
    if (at(w, sx, y) !== AIR) { groundY = y; break; }
  }
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = 1; dy <= 10; dy++) put(w, sx + dx, groundY - dy, AIR);
  }
  w.spawnX = sx;
  w.spawnY = groundY - 3;

  // Storm Altar on the highest, widest upper island
  let best: Island | null = null;
  for (const isl of islands) {
    if (isl.band !== 0) continue;
    if (!best || isl.rx > best.rx) best = isl;
  }
  const altar = best ?? islands[1] ?? home;
  let ay = 0;
  for (let y = 0; y < w.h; y++) {
    if (at(w, altar.cx, y) !== AIR) { ay = y; break; }
  }
  for (let dx = -5; dx <= 5; dx++) {
    for (let dy = 1; dy <= 8; dy++) put(w, altar.cx + dx, ay - dy, AIR);
    if (at(w, altar.cx + dx, ay) === AIR) put(w, altar.cx + dx, ay, SKY_STONE);
  }
  for (let dx = -1; dx <= 1; dx++) put(w, altar.cx + dx, ay - 1, ALTAR);
  put(w, altar.cx, ay - 2, ALTAR);
  w.altarX = altar.cx;
  w.altarY = ay - 1;

  // topmost solid per column (used for spawn placement + fast lighting hints)
  for (let x = 0; x < w.w; x++) {
    let top = w.h;
    for (let y = 0; y < w.h; y++) {
      if (w.tiles[y * w.w + x] !== AIR) { top = y; break; }
    }
    w.surfaceY[x] = top;
  }
  return w;
}
