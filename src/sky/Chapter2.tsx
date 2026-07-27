// src/sky/Chapter2.tsx — the whole Chapter II screen: intro cinematic, canvas,
// HUD, inventory with armor slots, Skyforge crafting, pause, death and ending.

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { SkyEngine, SKY_MINIMAP_COLORS, type SkyState } from "./skyEngine";
import { ARMOR, SET_BONUS, type SkyRecipe, type SkyStation } from "./skyWorld";
import Chapter2Intro from "./Chapter2Intro";
import { ITEMS } from "../world";
import { audio } from "../audio";
import { useT, t } from "../i18n";
import { tc, tcItem, tcItemDesc, tcQuest } from "./skyI18n";
import { goFullscreen } from "../MobileGate";

const SUMMONS = ["talon_whistle", "titan_call", "storm_horn"];
const EDIBLE = ["glowfruit", "apple", "rotten_flesh"];

function icon(id: string) { return ITEMS[id]?.icon ?? "❓"; }

function Btn({ children, onClick, variant = "ghost", className = "" }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const base = "font-semibold tracking-wide uppercase rounded-xl px-6 py-3 text-sm transition-all duration-150 active:scale-95 select-none";
  const styles: Record<string, string> = {
    primary: "text-[#08111f] bg-gradient-to-r from-sky-200 via-cyan-300 to-violet-300 shadow-[0_0_24px_rgba(130,200,255,0.45)] hover:-translate-y-0.5",
    ghost: "text-sky-50 border border-sky-200/30 bg-black/40 hover:bg-sky-300/10 hover:border-sky-200/60",
    danger: "text-rose-100 border border-rose-300/30 bg-rose-500/10 hover:bg-rose-500/20",
  };
  return <button onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>{children}</button>;
}

// ------------------------------------------------------------------ canvas
const SkyStage = memo(function SkyStage({
  runId, mode, engineRef, onState, onGameOver, onVictory,
}: {
  runId: number;
  mode: "new" | "auto";
  engineRef: React.MutableRefObject<SkyEngine | null>;
  onState: (s: SkyState) => void;
  onGameOver: () => void;
  onVictory: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cb = useRef({ onState, onGameOver, onVictory });
  cb.current = { onState, onGameOver, onVictory };
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new SkyEngine(canvas, {
      onState: (s) => cb.current.onState(s),
      onGameOver: () => cb.current.onGameOver(),
      onVictory: () => cb.current.onVictory(),
    });
    engineRef.current = eng;
    eng.start(modeRef.current);
    return () => {
      eng.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return <canvas ref={canvasRef} className="block h-full w-full touch-none" />;
});

// ----------------------------------------------------------------- minimap
function SkyMinimap({ engineRef, state }: { engineRef: React.MutableRefObject<SkyEngine | null>; state: SkyState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const render = () => {
      const eng = engineRef.current;
      const world = eng?.getWorldForMinimap();
      if (!world) { raf.current = requestAnimationFrame(render); return; }
      const scale = 4;
      const mw = Math.min(Math.floor(world.w / scale), 120);
      const mh = Math.min(Math.floor(world.h / scale), 120);
      const yOff = Math.max(0, Math.floor((120 - mh) / 2));
      ctx.fillStyle = "#080b16";
      ctx.fillRect(0, 0, 120, 120);
      for (let my = 0; my < mh; my++) {
        for (let mx = 0; mx < mw; mx++) {
          const tx = mx * scale;
          const ty = my * scale;
          if (tx >= world.w || ty >= world.h) continue;
          const id = world.tiles[ty * world.w + tx];
          if (!id) continue;
          ctx.fillStyle = SKY_MINIMAP_COLORS[id] ?? "#8a8f9c";
          ctx.fillRect(mx, yOff + my, 1, 1);
        }
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.floor(state.playerTX / scale) - 1, yOff + Math.floor(state.playerTY / scale) - 1, 3, 3);
      raf.current = requestAnimationFrame(render);
    };
    raf.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf.current);
  }, [engineRef, state]);
  return <canvas ref={ref} width={120} height={120} className="pointer-events-none" style={{ imageRendering: "pixelated" }} />;
}

// --------------------------------------------------------------------- HUD
function Hearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  const hearts = Math.ceil(maxHp / 20);
  return (
    <div className="flex flex-wrap gap-0.5">
      {Array.from({ length: hearts }).map((_, i) => {
        const full = hp >= (i + 1) * 20;
        const half = !full && hp > i * 20;
        return <span key={i} className="text-xs leading-none drop-shadow sm:text-base">{full ? "💙" : half ? "💧" : "🤍"}</span>;
      })}
    </div>
  );
}

function Hud({ s, onSelectSlot, onToggleInv, onPause }: {
  s: SkyState;
  onSelectSlot: (i: number) => void;
  onToggleInv: () => void;
  onPause: () => void;
}) {
  const q = tcQuest(s.questIndex);
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute left-2 top-2 space-y-0.5 sm:left-3 sm:top-3">
        <Hearts hp={s.hp} maxHp={s.maxHp} />
        <div className="text-[10px] text-sky-100/80 sm:text-xs">
          {s.hp}/{s.maxHp}{s.defense > 0 ? ` · 🛡${s.defense}` : ""}
        </div>
        <div className="text-[10px] text-cyan-200/70 sm:text-xs">
          ☁ {tc("altitude")} {s.altitude}
        </div>
      </div>

      <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2 py-0.5 text-xs sm:top-3 sm:px-3 sm:py-1 sm:text-sm">
        <span>{s.isNight ? "🌙" : "☀️"}</span>
        <span className="text-white/60">{t("day")} {s.dayCount}</span>
        <span className="text-white/30">·</span>
        <span className="text-violet-200/80">{tc("altar_dir")} {s.altarDX >= 0 ? "▶" : "◀"} {Math.abs(s.altarDX)}</span>
      </div>

      <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5 sm:right-3 sm:top-3">
        <div className="flex gap-1.5 sm:gap-2">
          <button onClick={onToggleInv} className="pointer-events-auto rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-sm text-white/85 hover:bg-white/10 sm:px-3">
            🎒<span className="ml-1 hidden sm:inline">{t("inventory")}</span>
          </button>
          <button onClick={onPause} className="pointer-events-auto rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-sm text-white/85 hover:bg-white/10 sm:px-3">❚❚</button>
        </div>
        <div className="w-44 rounded-lg border border-cyan-300/20 bg-black/55 p-1.5 backdrop-blur-sm sm:w-60 sm:rounded-xl sm:p-2.5">
          <div className="text-[9px] uppercase tracking-[0.15em] text-cyan-300/80 sm:text-[10px]">
            {s.questDone ? t("all_complete") : `${tc("ch2_name")} · ${t("quest")}`}
          </div>
          <div className="truncate text-xs font-semibold text-white/90 sm:text-sm">{q.title}</div>
          <div className="text-[11px] leading-tight text-white/60 sm:text-xs">{q.text}</div>
        </div>
        {s.setBonus && (
          <div className="rounded-lg border px-2 py-1 text-[10px] backdrop-blur-sm sm:text-xs"
            style={{ borderColor: SET_BONUS[s.setBonus].color + "55", background: SET_BONUS[s.setBonus].color + "18", color: SET_BONUS[s.setBonus].color }}>
            ✦ {tc(SET_BONUS[s.setBonus].key)}
          </div>
        )}
      </div>

      {s.boss && (
        <div className="absolute bottom-44 left-1/2 w-[84%] max-w-2xl -translate-x-1/2 sm:bottom-24">
          <div className="mb-1 text-center text-xs font-semibold text-violet-200 sm:text-sm">
            {tc("e_" + s.boss.id)}{s.boss.rage ? " · ⚡" : ""}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/70 ring-1 ring-violet-400/30 sm:h-3">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${(s.boss.hp / s.boss.maxHp) * 100}%`,
                background: s.boss.rage ? "linear-gradient(90deg,#ff5fd0,#ffb45a)" : "linear-gradient(90deg,#7a3fc8,#5fd8ff)",
              }}
            />
          </div>
        </div>
      )}

      {s.banner && (
        <div key={s.banner.key} className="anim-banner absolute inset-x-0 top-[28%] flex flex-col items-center text-center">
          <div className="text-2xl font-black text-cyan-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-4xl">{s.banner.title}</div>
          <div className="mt-1 text-sm uppercase tracking-[0.3em] text-white/80 sm:text-base">{s.banner.sub}</div>
        </div>
      )}

      {s.nearAltar && !s.boss && (
        <div className="absolute left-1/2 top-[13%] -translate-x-1/2 animate-pulse rounded-xl border border-violet-400/40 bg-violet-900/60 px-5 py-2 text-xs font-semibold text-violet-100 backdrop-blur-sm sm:text-sm">
          {tc("near_altar")}
        </div>
      )}

      <div className="absolute bottom-24 left-1/2 w-[94%] max-w-md -translate-x-1/2 sm:bottom-3">
        <div className="flex gap-0.5 rounded-2xl border border-white/10 bg-black/50 p-1 backdrop-blur-sm sm:gap-1 sm:p-1.5">
          {s.inventory.slice(0, 10).map((slot, i) => (
            <button
              key={i}
              title={slot ? tcItem(slot.id) : ""}
              onClick={() => onSelectSlot(i)}
              className={`pointer-events-auto relative flex h-9 w-[10%] items-center justify-center rounded-lg border text-base transition-all sm:h-14 sm:text-2xl ${
                s.selected === i ? "border-cyan-300 bg-cyan-300/20 ring-2 ring-cyan-300/50" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span className="absolute left-0.5 top-0 text-[7px] text-white/40 sm:text-[9px]">{(i + 1) % 10}</span>
              {slot && <span>{icon(slot.id)}</span>}
              {slot && slot.count > 1 && <span className="absolute bottom-0 right-0.5 text-[9px] font-bold text-white sm:text-[10px]">{slot.count}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ touch button
function TouchBtn({ onDown, onUp, className, children }: {
  onDown: () => void; onUp: () => void; className: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const downRef = useRef(onDown);
  const upRef = useRef(onUp);
  downRef.current = onDown;
  upRef.current = onUp;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let mine: number | null = null;
    const td = (e: TouchEvent) => {
      e.preventDefault();
      if (mine !== null) return;
      mine = e.changedTouches[0].identifier;
      downRef.current();
    };
    const tu = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === mine) {
          e.preventDefault();
          mine = null;
          upRef.current();
          return;
        }
      }
    };
    el.addEventListener("touchstart", td, { passive: false });
    el.addEventListener("touchend", tu, { passive: false });
    el.addEventListener("touchcancel", tu, { passive: false });
    return () => {
      el.removeEventListener("touchstart", td);
      el.removeEventListener("touchend", tu);
      el.removeEventListener("touchcancel", tu);
    };
  }, []);
  return <button ref={ref} className={`touch-btn ${className}`} onContextMenu={(e) => e.preventDefault()}>{children}</button>;
}

function TouchControls({ engineRef }: { engineRef: React.MutableRefObject<SkyEngine | null> }) {
  const btn = "pointer-events-auto select-none flex items-center justify-center rounded-full border border-white/25 bg-black/40 backdrop-blur-sm active:bg-white/30";
  const noop = () => {};
  const [place, setPlace] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none">
      <div className="absolute flex items-end gap-2" style={{ left: "calc(26px + env(safe-area-inset-left))", bottom: "calc(18px + env(safe-area-inset-bottom))" }}>
        <TouchBtn onDown={() => engineRef.current?.setMoveLeft(true)} onUp={() => engineRef.current?.setMoveLeft(false)} className={`${btn} h-16 w-16 text-3xl text-white`}>◀</TouchBtn>
        <TouchBtn onDown={() => engineRef.current?.setMoveRight(true)} onUp={() => engineRef.current?.setMoveRight(false)} className={`${btn} h-16 w-16 text-3xl text-white`}>▶</TouchBtn>
      </div>
      <div className="absolute flex items-end gap-2" style={{ right: "calc(26px + env(safe-area-inset-right))", bottom: "calc(18px + env(safe-area-inset-bottom))" }}>
        <TouchBtn
          onDown={() => setPlace(engineRef.current?.togglePlaceMode() ?? false)}
          onUp={noop}
          className={`${btn} h-14 w-14 text-xl ${place ? "border-cyan-300 bg-cyan-400/40" : "text-white/70"}`}
        >🧱</TouchBtn>
        <TouchBtn
          onDown={() => engineRef.current?.setJump(true)}
          onUp={() => engineRef.current?.setJump(false)}
          className={`${btn} h-[4.5rem] w-[4.5rem] text-3xl text-white`}
        >⤴</TouchBtn>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- inventory
function stationLabel(s: SkyStation): string {
  if (s === "none") return t("st_none");
  if (s === "workbench") return t("st_workbench");
  if (s === "furnace") return t("st_furnace");
  return tc("station_skyforge");
}

function ArmorSlotBox({ id, label, onClick }: { id: string | null; label: string; onClick: () => void }) {
  const tint = id && ARMOR[id] ? SET_BONUS[ARMOR[id].set].color : "#64748b";
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-xl border p-2 transition-colors"
      style={{ borderColor: tint + "55", background: id ? tint + "14" : "rgba(255,255,255,0.03)" }}
    >
      <span className="text-[9px] uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-2xl">{id ? icon(id) : "➕"}</span>
      <span className="line-clamp-1 text-[10px] text-white/60">{id ? tcItem(id) : tc("empty_slot")}</span>
      {id && <span className="text-[10px] font-bold" style={{ color: tint }}>🛡 {ARMOR[id].defense}</span>}
    </button>
  );
}

function InventoryPanel({ s, recipes, onClose, onCraft, onConsume, onSummon, onSwap, onSelectSlot, onEquip, onUnequip }: {
  s: SkyState;
  recipes: SkyRecipe[];
  onClose: () => void;
  onCraft: (id: string) => void;
  onConsume: (id: string) => void;
  onSummon: (id: string) => void;
  onSwap: (a: number, b: number) => void;
  onSelectSlot: (i: number) => void;
  onEquip: (i: number) => void;
  onUnequip: (slot: "head" | "chest" | "legs") => void;
}) {
  const [tapSel, setTapSel] = useState<number | null>(null);
  const [filter, setFilter] = useState<SkyStation | "all">("all");
  const sel = s.inventory[s.selected];
  const shown = recipes.filter((r) => filter === "all" || r.station === filter);

  return (
    <div className="anim-fade absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-cyan-200/10 bg-[#080d1a]/95 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-bold text-cyan-100">{t("inv_craft")}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span className={s.stations.workbench ? "text-emerald-300" : "text-white/30"}>🛠️ {s.stations.workbench ? "✓" : "✗"}</span>
            <span className={s.stations.furnace ? "text-emerald-300" : "text-white/30"}>🏭 {s.stations.furnace ? "✓" : "✗"}</span>
            <span className={s.stations.skyforge ? "text-cyan-300" : "text-white/30"}>⚙️ {s.stations.skyforge ? "✓" : "✗"}</span>
            <button onClick={onClose} className="rounded-md bg-white/10 px-3 py-1 text-white hover:bg-white/20">{t("close")} ✕</button>
          </div>
        </div>

        <div className="grid gap-4 overflow-y-auto p-4 md:grid-cols-2">
          {/* left: armor + grid */}
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-white/40">{tc("armor")} · 🛡 {s.defense}</div>
            <div className="flex gap-2">
              <ArmorSlotBox id={s.armor.head} label={tc("slot_head")} onClick={() => onUnequip("head")} />
              <ArmorSlotBox id={s.armor.chest} label={tc("slot_chest")} onClick={() => onUnequip("chest")} />
              <ArmorSlotBox id={s.armor.legs} label={tc("slot_legs")} onClick={() => onUnequip("legs")} />
            </div>
            {s.setBonus && (
              <div className="mt-2 rounded-lg border px-3 py-1.5 text-xs"
                style={{ borderColor: SET_BONUS[s.setBonus].color + "55", background: SET_BONUS[s.setBonus].color + "14", color: SET_BONUS[s.setBonus].color }}>
                ✦ {tc("set_bonus")}: {tc(SET_BONUS[s.setBonus].key)}
              </div>
            )}

            <div className="mb-2 mt-4 flex items-center gap-2 text-xs uppercase tracking-widest text-white/40">
              <span>{t("items")}</span>
              <span className="normal-case tracking-normal text-white/25">· {t("items_hint")}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {s.inventory.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => {
                    audio.playSfx("click");
                    if (tapSel === null) {
                      setTapSel(i);
                      if (i < 10) onSelectSlot(i);
                    } else if (tapSel === i) {
                      setTapSel(null);
                    } else {
                      onSwap(tapSel, i);
                      setTapSel(null);
                    }
                  }}
                  onDoubleClick={() => { if (slot && ARMOR[slot.id]) onEquip(i); }}
                  title={slot ? `${tcItem(slot.id)} ×${slot.count}` : ""}
                  className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg border text-xl transition-all ${
                    tapSel === i
                      ? "scale-105 border-sky-300 bg-sky-400/30 ring-2 ring-sky-300"
                      : tapSel !== null
                        ? "border-cyan-300/60 bg-cyan-300/10 hover:bg-cyan-300/20"
                        : i === s.selected
                          ? "border-cyan-300 bg-cyan-300/20"
                          : i < 10
                            ? "border-white/15 bg-white/5 hover:bg-white/10"
                            : "border-white/5 bg-black/30 hover:bg-white/5"
                  }`}
                >
                  {slot && <span className="pointer-events-none">{icon(slot.id)}</span>}
                  {slot && slot.count > 1 && <span className="pointer-events-none absolute bottom-0 right-0.5 text-[10px] font-bold text-white">{slot.count}</span>}
                  {slot && ARMOR[slot.id] && <span className="pointer-events-none absolute left-0.5 top-0 text-[8px] text-cyan-300">🛡</span>}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
              {sel ? (
                <div>
                  <div className="text-sm font-semibold text-white">
                    {icon(sel.id)} {tcItem(sel.id)} <span className="text-white/40">×{sel.count}</span>
                  </div>
                  {tcItemDesc(sel.id) && <div className="text-xs text-white/50">{tcItemDesc(sel.id)}</div>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ARMOR[sel.id] && (
                      <Btn variant="primary" className="px-4 py-1.5 text-xs" onClick={() => onEquip(s.selected)}>
                        🛡 {tc("equip")}
                      </Btn>
                    )}
                    {EDIBLE.includes(sel.id) && (
                      <Btn variant="ghost" className="px-4 py-1.5 text-xs" onClick={() => onConsume(sel.id)}>
                        🍽 {sel.id === "glowfruit" ? tc("eat_glowfruit") : t("eat_hp")}
                      </Btn>
                    )}
                    {SUMMONS.includes(sel.id) && (
                      <Btn variant="danger" className="px-4 py-1.5 text-xs" onClick={() => onSummon(sel.id)}>
                        {sel.id === "talon_whistle" ? `📯 ${tc("summon_matriarch")}` : sel.id === "titan_call" ? `🪨 ${tc("summon_titan")}` : `📣 ${tc("summon_arch")}`}
                      </Btn>
                    )}
                  </div>
                  {sel.id === "storm_horn" && !s.nearAltar && (
                    <div className="mt-2 text-[11px] text-rose-300/80">{tc("need_altar")}</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-white/40">—</div>
              )}
            </div>
          </div>

          {/* right: crafting */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {(["all", "none", "workbench", "furnace", "skyforge"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                    filter === f ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-white/15 bg-black/40 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {f === "all" ? "★" : stationLabel(f)}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {shown.map((r) => {
                const can = s.craftable.includes(r.id);
                return (
                  <div key={r.id} className={`flex items-center gap-2 rounded-lg border p-2 ${can ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/5 bg-black/20 opacity-60"}`}>
                    <span className="text-xl">{icon(r.out)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white/90">
                        {tcItem(r.out)} <span className="text-white/40">×{r.outCount}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-2 text-[10px] text-white/50">
                        <span className={r.station === "none" || s.stations[r.station as "workbench" | "furnace" | "skyforge"] ? "text-cyan-300/70" : "text-rose-300/60"}>
                          {stationLabel(r.station)}
                        </span>
                        {r.ing.map((ing) => <span key={ing.id}>{icon(ing.id)} {ing.n}</span>)}
                      </div>
                    </div>
                    <button
                      disabled={!can}
                      onClick={() => onCraft(r.id)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold ${can ? "bg-cyan-400 text-cyan-950 hover:bg-cyan-300" : "bg-white/5 text-white/30"}`}
                    >
                      {t("craft")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ending
function Chapter2Ending({ onContinue, onMenu }: { onContinue: () => void; onMenu: () => void }) {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setScene(1), 5000);
    const b = setTimeout(() => setScene(2), 10000);
    const c = setTimeout(() => setScene(3), 14500);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, []);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-[#04060c] text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-[#131033] via-[#0a0a20] to-[#04060c]" />
      <div className="end-beam pointer-events-none absolute -top-1/3 left-1/2 h-[150vh] w-[60vw] -translate-x-1/2 rotate-12 bg-gradient-to-b from-cyan-200/25 to-transparent blur-2xl" />
      <div className="relative z-10 w-full max-w-2xl px-8 text-center">
        {scene === 0 && (
          <div className="end-in">
            <div className="mb-5 text-6xl">🌪️</div>
            <h1 className="end-title title-gradient font-display text-4xl font-black sm:text-6xl">{tc("end2_title")}</h1>
            <p className="mt-6 text-lg leading-relaxed text-cyan-50/85 sm:text-2xl">{tc("end2_1")}</p>
          </div>
        )}
        {scene === 1 && (
          <div className="end-in">
            <div className="mb-5 text-5xl">🪽</div>
            <p className="text-xl leading-relaxed text-cyan-50/90 sm:text-3xl">{tc("end2_2")}</p>
          </div>
        )}
        {scene === 2 && (
          <div className="end-in">
            <div className="mb-5 text-5xl">🌊</div>
            <p className="text-xl leading-relaxed text-sky-100/90 sm:text-3xl">{tc("end2_3")}</p>
            <p className="mt-8 text-2xl tracking-[0.3em] text-cyan-100/90 sm:text-4xl">{tc("end2_tbc")}</p>
            <p className="mt-4 text-sm uppercase tracking-[0.4em] text-white/40">{tc("end2_ch3")}</p>
          </div>
        )}
        {scene === 3 && (
          <div className="end-in">
            <div className="mb-4 text-5xl">☁️</div>
            <p className="mb-2 text-xs uppercase tracking-[0.5em] text-white/40">{tc("ch2_sub")}</p>
            <h1 className="end-title title-gradient font-display text-3xl font-black sm:text-5xl">{t("made_by")}</h1>
            <h2 className="end-title title-gradient font-display mt-2 text-4xl font-black sm:text-6xl">Maximgrg Dev Team</h2>
            <div className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <p className="mt-4 text-sm text-white/50">{t("thanks")}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Btn variant="primary" className="px-8 py-3.5" onClick={onContinue}>▶ {t("continue_world")}</Btn>
              <Btn variant="ghost" onClick={onMenu}>{t("main_menu")}</Btn>
            </div>
          </div>
        )}
      </div>
      {scene < 3 && (
        <button onClick={() => setScene(3)} className="absolute bottom-6 right-6 rounded-lg border border-white/15 bg-black/40 px-4 py-2 text-xs text-white/50 backdrop-blur hover:bg-white/10">
          {t("skip")} ▸
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- root
export default function Chapter2({ mode, onExit }: { mode: "new" | "continue"; onExit: () => void }) {
  useT();
  const [phase, setPhase] = useState<"intro" | "playing">(mode === "new" ? "intro" : "playing");
  const [runId, setRunId] = useState(0);
  const [startMode, setStartMode] = useState<"new" | "auto">(mode === "new" ? "new" : "auto");
  const [state, setState] = useState<SkyState | null>(null);
  const [invOpen, setInvOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [ended, setEnded] = useState<null | "over" | "win">(null);
  const [isTouch, setIsTouch] = useState(false);
  const engineRef = useRef<SkyEngine | null>(null);

  useEffect(() => {
    setIsTouch(typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
  }, []);

  useEffect(() => {
    engineRef.current?.setUiOpen(invOpen);
    engineRef.current?.setPaused(pauseOpen);
  }, [invOpen, pauseOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (phase !== "playing" || ended) return;
      if (e.code === "KeyE") {
        e.preventDefault();
        setInvOpen((v) => !v);
        audio.playSfx("click");
      } else if (e.code === "Escape") {
        e.preventDefault();
        if (invOpen) setInvOpen(false);
        else setPauseOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, invOpen, ended]);

  const onState = useCallback((s: SkyState) => setState(s), []);
  const onGameOver = useCallback(() => setEnded("over"), []);
  const onVictory = useCallback(() => setEnded("win"), []);

  const restart = () => {
    audio.playSfx("click");
    setState(null);
    setEnded(null);
    setInvOpen(false);
    setPauseOpen(false);
    setStartMode("new");
    setRunId((r) => r + 1);
    setPhase("playing");
  };
  const respawn = () => {
    audio.playSfx("click");
    setState(null);
    setEnded(null);
    setStartMode("auto");
    setRunId((r) => r + 1);
  };
  const quit = () => {
    engineRef.current?.saveGameNow();
    audio.setTrack("menu");
    onExit();
  };

  if (phase === "intro") {
    return (
      <Chapter2Intro
        onBegin={() => { setStartMode("new"); setPhase("playing"); }}
        onSkip={onExit}
      />
    );
  }

  const recipes = engineRef.current?.getRecipes() ?? [];

  return (
    <div className="absolute inset-0 bg-[#050810]">
      <SkyStage runId={runId} mode={startMode} engineRef={engineRef} onState={onState} onGameOver={onGameOver} onVictory={onVictory} />

      {state && !ended && (
        <Hud
          s={state}
          onSelectSlot={(i) => engineRef.current?.selectSlot(i)}
          onToggleInv={() => setInvOpen(true)}
          onPause={() => setPauseOpen(true)}
        />
      )}

      {state && !ended && !invOpen && !pauseOpen && (
        <div className="absolute bottom-28 left-3 z-10 rounded-lg border border-white/10 bg-black/60 p-1 backdrop-blur-sm">
          <SkyMinimap engineRef={engineRef} state={state} />
        </div>
      )}

      {isTouch && state && !ended && !invOpen && !pauseOpen && <TouchControls engineRef={engineRef} />}

      {state && !ended && !invOpen && !pauseOpen && (state.canGlide || state.canDoubleJump) && (
        <div className="pointer-events-none absolute right-3 bottom-3 hidden flex-col items-end gap-1 text-[11px] text-white/45 sm:flex">
          {state.canGlide && <span>🪶 {tc("glide_hint")}</span>}
          {state.canDoubleJump && <span>⚡ {tc("djump_hint")}</span>}
        </div>
      )}

      {state && invOpen && !ended && (
        <InventoryPanel
          s={state}
          recipes={recipes}
          onClose={() => setInvOpen(false)}
          onCraft={(id) => engineRef.current?.craft(id)}
          onConsume={(id) => engineRef.current?.consume(id)}
          onSummon={(id) => { engineRef.current?.useSummon(id); setInvOpen(false); }}
          onSwap={(a, b) => engineRef.current?.swapSlots(a, b)}
          onSelectSlot={(i) => engineRef.current?.selectSlot(i)}
          onEquip={(i) => engineRef.current?.equipFromSlot(i)}
          onUnequip={(slot) => engineRef.current?.unequip(slot)}
        />
      )}

      {pauseOpen && !ended && (
        <div className="anim-fade absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm text-center">
            <div className="text-xs uppercase tracking-[0.4em] text-cyan-300/70">{tc("ch2_name")}</div>
            <div className="mt-1 text-4xl font-bold text-white/90">{t("paused")}</div>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Btn variant="primary" onClick={() => setPauseOpen(false)}>{t("resume")}</Btn>
              <Btn variant="ghost" onClick={quit}>💾 {t("save_quit")}</Btn>
              <Btn variant="danger" onClick={restart}>{tc("ch2_restart")}</Btn>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={goFullscreen} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/20">
                📺 {t("fullscreen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {ended === "over" && state && (
        <div className="anim-fade absolute inset-0 z-30 flex items-center justify-center px-6">
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 40%, rgba(70,40,150,0.3), rgba(4,6,14,0.96))" }} />
          <div className="relative z-10 w-full max-w-md text-center">
            <div className="text-5xl font-black text-rose-300 sm:text-7xl">{t("you_died")}</div>
            <p className="mt-3 text-sm text-white/70 sm:text-base">{tc("void_below")}</p>
            <div className="mx-auto mt-7 grid max-w-xs grid-cols-2 gap-3 text-left">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/45">{t("day_reached")}</div>
                <div className="text-xl font-bold text-cyan-100">{state.dayCount}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/45">{t("quests")}</div>
                <div className="text-xl font-bold text-cyan-100">{state.questIndex + 11}/22</div>
              </div>
            </div>
            <div className="mt-8 flex justify-center gap-3">
              <Btn variant="primary" onClick={respawn}>▶ {tc("ch2_continue")}</Btn>
              <Btn variant="ghost" onClick={quit}>{t("main_menu")}</Btn>
            </div>
          </div>
        </div>
      )}

      {ended === "win" && (
        <Chapter2Ending
          onContinue={() => { setEnded(null); respawn(); }}
          onMenu={quit}
        />
      )}
    </div>
  );
}
