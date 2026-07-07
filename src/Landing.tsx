import { useEffect, useRef, useState } from "react";
import sandboxBg from "./assets/sandbox-bg.jpg";
import skyBg from "./assets/bg_sky.jpg";
import atlasBg from "./assets/char_atlas.jpg";

/* scroll-reveal wrapper */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const NAV = [
  { id: "story", label: "Сюжет" },
  { id: "features", label: "Возможности" },
  { id: "world", label: "Мир" },
  { id: "gallery", label: "Галерея" },
  { id: "controls", label: "Управление" },
];

const FEATURES = [
  { icon: "⛏️", title: "Копай глубоко", text: "Долби дерево, землю и камень. Добывай уголь, медь, железо, золото и сверкающие алмазы в глубинах.", color: "from-amber-500/20 to-orange-500/5" },
  { icon: "🏗️", title: "Строй всё", text: "Возводи крепости, башни и уютные дома. Размещай блоки, факелы, стекло и создавай свой уникальный мир.", color: "from-sky-500/20 to-blue-500/5" },
  { icon: "⚒️", title: "Крафти оружие", text: "Поставь верстак и печь. Куй кирки, мечи и топоры — от дерева до могущественной стали.", color: "from-emerald-500/20 to-green-500/5" },
  { icon: "⚔️", title: "Сражайся", text: "Отбивайся от слизней днём и зомби с летучими мышами ночью. Отрабатывай удары и побеждай.", color: "from-rose-500/20 to-red-500/5" },
  { icon: "🌗", title: "Живой день и ночь", text: "Солнце встаёт и садится. Когда темнеет — выходят твари. Зажги факелы и выживи в темноте пещер.", color: "from-violet-500/20 to-purple-500/5" },
  { icon: "👑", title: "Эпичный босс", text: "Скрафти Слизневую Корону, призови Короля слизней и сразись в финальной битве за судьбу мира.", color: "from-yellow-500/20 to-amber-500/5" },
];

const STATS = [
  { v: "11", l: "Квестов" },
  { v: "17+", l: "Видов блоков" },
  { v: "∞", l: "Уникальных миров" },
  { v: "1", l: "Эпичный босс" },
];

const CONTROLS = [
  { k: "WASD / ←→", d: "Движение" },
  { k: "Space / W", d: "Прыжок" },
  { k: "ЛКМ", d: "Копать / атаковать" },
  { k: "ПКМ", d: "Поставить блок" },
  { k: "1 – 0 / колесо", d: "Выбрать предмет" },
  { k: "E", d: "Инвентарь и крафт" },
  { k: "Esc", d: "Пауза" },
  { k: "Ctrl+Win+Alt", d: "Счётчик FPS" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const motes = Array.from({ length: 18 }, () => ({ left: Math.random() * 100, delay: Math.random() * 8, dur: 8 + Math.random() * 10, size: 2 + Math.random() * 4 }));

export default function Landing({ onPlay }: { onPlay: () => void }) {
  const [navSolid, setNavSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-scroll min-h-screen w-full overflow-y-auto bg-[#070a12] text-white">
      {/* ===== NAV ===== */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${navSolid ? "glass border-b border-white/10 py-3" : "py-5"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5">
          <button onClick={() => scrollToId("top")} className="flex items-center gap-2">
            <span className="text-2xl">⛏️</span>
            <span className="title-gradient text-xl font-black tracking-wide">TERRALITE</span>
          </button>
          <div className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => scrollToId(n.id)} className="text-sm font-medium text-white/70 transition-colors hover:text-amber-200">
                {n.label}
              </button>
            ))}
          </div>
          <button
            onClick={onPlay}
            className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-5 py-2 text-sm font-bold text-[#1a1205] shadow-[0_0_20px_rgba(255,180,80,0.5)] transition-transform hover:scale-105"
          >
            ▶ Играть
          </button>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section id="top" className="relative flex h-screen min-h-[640px] items-center justify-center overflow-hidden">
        <img src={sandboxBg} alt="" className="anim-slow-zoom absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a12]/40 via-[#070a12]/50 to-[#070a12]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070a12]/80 via-transparent to-[#070a12]/80" />
        {motes.map((m, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-200"
            style={{
              left: `${m.left}%`,
              bottom: "-5%",
              width: m.size,
              height: m.size,
              opacity: 0.5,
              animation: `floatUp ${m.dur}s linear ${m.delay}s infinite`,
              boxShadow: "0 0 8px #ffd277",
            }}
          />
        ))}
        <div className="relative z-10 px-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-black/50 px-4 py-1.5 text-[11px] uppercase tracking-[0.4em] text-amber-200/90 backdrop-blur">
            ⛏ Бесплатная песочница выживания
          </div>
          <h1 className="title-gradient text-6xl font-black leading-none drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] sm:text-8xl md:text-9xl">TERRALITE</h1>
          <p className="mt-3 text-lg tracking-[0.5em] text-emerald-100 drop-shadow sm:text-2xl">REALMS UNBOUND</p>
          <p className="mx-auto mt-6 max-w-xl text-base text-white/75 sm:text-lg">
            Копай, строй, крафти и сражайся в бескрайнем процедурном мире. Добудь руду, выкуй легенду и победи Слизневого Короля.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onPlay}
              className="group rounded-2xl bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 px-10 py-4 text-lg font-black text-[#1a1205] shadow-[0_0_36px_rgba(255,170,70,0.6)] transition-all hover:scale-105 hover:shadow-[0_0_52px_rgba(255,170,70,0.9)]"
            >
              <span className="inline-flex items-center gap-2">▶ Играть бесплатно</span>
            </button>
            <button
              onClick={() => scrollToId("story")}
              className="rounded-2xl border border-white/25 bg-white/5 px-8 py-4 text-lg font-semibold text-white/90 backdrop-blur transition-colors hover:bg-white/15"
            >
              Узнать больше
            </button>
          </div>
        </div>
        <button onClick={() => scrollToId("story")} className="scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 text-3xl text-white/60">
          ↓
        </button>
      </section>

      {/* ===== STATS ===== */}
      <section className="relative border-y border-white/10 bg-[#0b0f1a] py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.l} delay={i * 80}>
              <div className="text-center">
                <div className="title-gradient text-4xl font-black sm:text-5xl">{s.v}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/50">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== STORY ===== */}
      <section id="story" className="relative overflow-hidden py-24">
        <img src={skyBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a12] via-transparent to-[#070a12]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <div className="mb-4 text-xs uppercase tracking-[0.5em] text-emerald-300/70">Пролог</div>
            <h2 className="title-gradient text-4xl font-black sm:text-5xl">Сага о последнем свете</h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-white/80 sm:text-xl">
              <p>Мир Терралайт когда-то был целым и сияющим. Но из глубин поднялся древний Слизневый Король — он поглотил свет и расколол землю на бесконечные пещеры.</p>
              <p>Ты — последний Хранитель Света. Просыпаясь на опустошённой поверхности с голыми руками, ты должен рубить, копать, ковать и строить, чтобы выжить.</p>
              <p className="text-amber-200/90">Собери Слизневую Корону, призови Короля и верни свет миру. Это твоя сага — блок за блоком, клинок за клинком.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="relative py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-center">
              <div className="mb-3 text-xs uppercase tracking-[0.5em] text-amber-300/70">Геймплей</div>
              <h2 className="text-4xl font-black text-white sm:text-5xl">Бесконечные возможности</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/60">Всё, что нужно для эпического выживания — в одной игре.</p>
            </div>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <div className={`feature-card h-full rounded-2xl border border-white/10 bg-gradient-to-br ${f.color} p-6 hover:border-amber-300/40 hover:shadow-[0_10px_40px_rgba(255,170,70,0.15)]`}>
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-black/30 text-3xl">{f.icon}</div>
                  <h3 className="text-xl font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WORLD / CHARACTERS ===== */}
      <section id="world" className="relative overflow-hidden border-y border-white/10 bg-[#0b0f1a] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <div>
                <div className="mb-3 text-xs uppercase tracking-[0.5em] text-emerald-300/70">Живой мир</div>
                <h2 className="text-4xl font-black text-white sm:text-5xl">Исследуй глубины</h2>
                <p className="mt-4 text-lg leading-relaxed text-white/70">
                  Каждый мир генерируется заново — никаких двух одинаковых прохождений. Спускайся всё глубже сквозь слои камня, находи пещеры и рудные жилы, попадай в засады тварей и раскрывай тайны древней земли.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "5 видов руды — от угля до алмаза",
                    "Процедурные пещеры и жилы",
                    "Цикл день/ночь с врагами и факелами",
                    "Атмосферное освещение как в Terraria",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-3 text-white/80">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-sm text-emerald-300">✓</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onPlay}
                  className="mt-8 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-7 py-3 font-bold text-emerald-950 shadow-[0_0_24px_rgba(80,220,120,0.4)] transition-transform hover:scale-105"
                >
                  ▶ Начать приключение
                </button>
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                <img src={atlasBg} alt="Персонажи Terralite" className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a]/80 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <div className="text-sm uppercase tracking-widest text-amber-200/80">Герои и враги</div>
                  <div className="text-lg font-bold text-white">5 уникальных персонажей</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== GALLERY ===== */}
      <section id="gallery" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-center">
              <div className="mb-3 text-xs uppercase tracking-[0.5em] text-amber-300/70">Витрина</div>
              <h2 className="text-4xl font-black text-white sm:text-5xl">Взгляни на мир</h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[sandboxBg, skyBg, atlasBg, sandboxBg, skyBg, atlasBg].map((src, i) => (
              <Reveal key={i} delay={(i % 3) * 90}>
                <div className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
                  <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTROLS ===== */}
      <section id="controls" className="border-t border-white/10 bg-[#0b0f1a] py-24">
        <div className="mx-auto max-w-3xl px-6">
          <Reveal>
            <div className="text-center">
              <div className="mb-3 text-xs uppercase tracking-[0.5em] text-emerald-300/70">Управление</div>
              <h2 className="text-4xl font-black text-white sm:text-5xl">Легко освоить</h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {CONTROLS.map((c, i) => (
              <Reveal key={c.d} delay={(i % 2) * 80}>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-5 py-3.5">
                  <span className="text-white/80">{c.d}</span>
                  <kbd className="rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-amber-200">{c.k}</kbd>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative overflow-hidden py-28">
        <img src={sandboxBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a12]/80 via-[#070a12]/70 to-[#070a12]" />
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <Reveal>
            <h2 className="title-gradient text-4xl font-black sm:text-6xl">Готов к приключению?</h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-white/75">Терралит ждёт своего героя. Войди в мир прямо сейчас — бесплатно, без загрузок.</p>
            <button
              onClick={onPlay}
              className="mt-9 rounded-2xl bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 px-12 py-5 text-xl font-black text-[#1a1205] shadow-[0_0_44px_rgba(255,170,70,0.6)] transition-all hover:scale-105"
            >
              ▶ Играть сейчас
            </button>
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/10 bg-[#05070d] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <span className="text-xl">⛏️</span>
            <span className="font-black tracking-wide text-white/90">TERRALITE: Realms Unbound</span>
          </div>
          <div className="text-sm text-white/40">Сделано с любовью к песочницам · © {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}
