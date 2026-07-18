"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Cat, Flag, MistralBadge, Confetti } from "@/components/Icons";
import {
  AppState,
  BANDS,
  BAND_MID,
  DISCLAIMER,
  Item,
  ONB,
  Profile,
  RATE,
  STORAGE_KEY,
  Theme,
  bandLabel,
  currentLevelIdx,
  eur,
  freshState,
  levelDone,
  playerLevel,
  themeProgress,
  themeUnlocked,
  THEMES,
} from "@/lib/content";

type Nav = { view: "map" | "lesson" | "profile"; t?: string; l?: string };

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...freshState(), ...JSON.parse(raw) } : freshState();
  } catch {
    return freshState();
  }
}

function TopBar({ state, onProfile }: { state: AppState; onProfile: () => void }) {
  const pc = Math.round(((state.stats.xp % 300) / 300) * 100);
  return (
    <div className="topbar">
      <div className="wordmark">
        <span className="dot">🐱</span>Matou <Flag />
      </div>
      <div className="sp"></div>
      <span className="chip flame">
        <Icon name="flame" size={15} /> {state.stats.streak}
      </span>
      <span className="chip coin">
        <Icon name="coin" size={15} /> {state.stats.coins}
      </span>
      <div className="ring lvl" style={{ ["--p" as string]: pc }} onClick={onProfile} role="button">
        <b>N{playerLevel(state)}</b>
      </div>
    </div>
  );
}

/* ============ ONBOARDING ============ */
function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(-1);
  const [tmpMulti, setTmpMulti] = useState<number[]>([]);
  const [tmpScale, setTmpScale] = useState<number | null>(null);
  const draft = useRef<Profile>({});

  if (step === -1) {
    return (
      <div className="center">
        <span className="pill" style={{ alignSelf: "center" }}>
          🧭 Faisons connaissance
        </span>
        <Cat size={116} />
        <h1>
          Apprends l&rsquo;argent,
          <br />
          <em>un geste par jour.</em>
        </h1>
        <p>
          Pas un quiz figé : Matou te pose des questions, puis <b>génère ta leçon en direct avec Mistral</b>. Une app
          qui s&rsquo;adapte à toi.
        </p>
        <button
          className="btn"
          onClick={() => {
            setStep(0);
            setTmpMulti([]);
            setTmpScale(null);
          }}
        >
          Commencer <Icon name="play" size={18} />
        </button>
        <div className="rgpd" style={{ maxWidth: "34ch" }}>
          🔒 Tes réponses restent sur ton appareil. {DISCLAIMER}
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 12,
            color: "var(--faint)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "center",
            fontWeight: 700,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Propulsé par <MistralBadge />
          </span>
          <span>🐱 Duolingo de la finance · démo</span>
        </div>
      </div>
    );
  }

  const q = ONB[step];
  const n = ONB.length;

  function advance() {
    if (step < n - 1) {
      setStep(step + 1);
      setTmpMulti([]);
      setTmpScale(null);
    } else {
      onDone(draft.current);
    }
  }

  function pickSingle(i: number, skip = false) {
    if (skip) {
      draft.current[q.id] = "undisclosed" as never;
    } else {
      const val = q.vals ? q.vals[i] : q.opts![i][1];
      (draft.current as Record<string, unknown>)[q.id] = val;
    }
    advance();
  }

  function toggleMulti(i: number) {
    setTmpMulti((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  function confirmMulti() {
    (draft.current as Record<string, unknown>)[q.id] = tmpMulti.map((i) => q.opts![i][1]);
    advance();
  }

  function confirmScale() {
    (draft.current as Record<string, unknown>)[q.id] = tmpScale;
    advance();
  }

  const needBtn = q.scale || q.multi;

  return (
    <div className="view" style={{ paddingTop: 22 }}>
      <div className="qhead">
        <Cat size={44} />
        <div className="who">
          <span className="d"></span>Matou
        </div>
        <div className="qcount">
          {step + 1}/{n}
        </div>
      </div>
      <div className="qbubble">{q.q}</div>
      <div>
        {q.scale ? (
          <>
            <div className="scale">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`s ${tmpScale !== null && i <= tmpScale ? "sel" : ""}`} onClick={() => setTmpScale(i)}>
                  {i}
                </div>
              ))}
            </div>
            <div className="scalelab">
              <span>{q.lo}</span>
              <span>{q.hi}</span>
            </div>
          </>
        ) : (
          q.opts!.map((o, i) => (
            <button
              key={i}
              className={`qopt ${q.multi && tmpMulti.includes(i) ? "sel" : ""}`}
              onClick={() => (q.multi ? toggleMulti(i) : pickSingle(i))}
            >
              <span className="e">{o[0]}</span>
              <span>{o[1]}</span>
              <span className="chk">
                <Icon name="check" size={14} />
              </span>
            </button>
          ))
        )}
      </div>
      {q.skip && (
        <>
          <button className="linkbtn" style={{ margin: "2px 0 12px" }} onClick={() => pickSingle(-1, true)}>
            Je préfère ne pas dire
          </button>
          <br />
        </>
      )}
      {needBtn && (
        <button
          className="btn block"
          disabled={q.multi ? tmpMulti.length === 0 : tmpScale === null}
          onClick={q.multi ? confirmMulti : confirmScale}
        >
          Continuer <Icon name="arrow" size={18} />
        </button>
      )}
    </div>
  );
}

/* ============ MAP ============ */
function poly(pts: [number, number][]) {
  return "M " + pts.map((p) => p[0] + " " + p[1]).join(" L ");
}

function MountainBlock({ t, state, onOpen }: { t: Theme; state: AppState; onOpen: (l: string) => void }) {
  const active = themeUnlocked(state, t);
  const k = t.levels.length;
  const H = 190 + k * 118;
  const top = 100,
    base = H - 92;
  const xs = [36, 64, 34, 66];
  const curIdx = currentLevelIdx(state, t);
  const pts: [number, number][] = t.levels.map((_, i) => [i === k - 1 ? 50 : xs[i % 4], base - (base - top) * (i / Math.max(1, k - 1))]);
  const { d, tot, pc } = themeProgress(state, t);
  const prereqTheme = THEMES.find((x) => x.id === t.prereq);

  return (
    <div className={`mtn ${active ? "" : "lock"}`} style={{ ["--accent" as string]: t.color, ["--accent-s" as string]: t.soft, height: H }}>
      <svg className="silo" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
        <polygon points={`0,${H} 26,${top + 120} 50,${top - 6} 74,${top + 120} 100,${H}`} fill={t.soft} />
        <polygon points={`0,${H} 40,${base - 40} 50,${top - 6} 60,${base - 40} 100,${H}`} fill={t.color} fillOpacity={0.14} />
        <polygon points={`42,${top + 70} 50,${top - 6} 58,${top + 70}`} fill="#fff" fillOpacity={0.85} />
        <path
          d={poly(pts)}
          fill="none"
          stroke={active ? "rgba(140,110,200,.28)" : "rgba(140,110,200,.13)"}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={active ? undefined : "3 5"}
        />
      </svg>
      <span className="flagtop" style={{ top: top - 14 }}>
        🚩
      </span>
      {state.trophies[t.id] && <span className="tro">🏆</span>}
      {t.levels.map((l, i) => {
        const done = levelDone(state, t.id, l.id);
        const cur = active && i === curIdx;
        const st = done ? "done" : cur ? "cur" : "lock";
        const boss = i === k - 1;
        const ic = done ? "check" : st === "lock" ? "lock" : l.tool ? "star" : boss ? "trophy" : t.ic;
        const clickable = active && (done || cur);
        return (
          <div
            key={l.id}
            className={`nd ${st} ${boss ? "boss" : ""}`}
            style={{ left: `${pts[i][0]}%`, top: pts[i][1] }}
            onClick={clickable ? () => onOpen(l.id) : undefined}
          >
            <div className="b">
              <Icon name={ic as never} size={boss ? 32 : 26} />
              {cur && (
                <span className="catn">
                  <Cat size={44} />
                </span>
              )}
            </div>
            <div className="lb">{l.title}</div>
          </div>
        );
      })}
      <div className="base">
        <span className="em">{t.emoji}</span>
        <div className="bt">
          <h3>{t.name}</h3>
          <div className="p">{active ? `${d}/${tot} niveaux` : "Sommet verrouillé"}</div>
        </div>
        <span className="st">{active ? (state.trophies[t.id] ? "🏆" : "▲ " + pc + "%") : "🔒 " + (prereqTheme?.name || "")}</span>
      </div>
    </div>
  );
}

function MapView({ state, onOpenLesson, onOpenProfile }: { state: AppState; onOpenLesson: (t: string, l: string) => void; onOpenProfile: () => void }) {
  return (
    <>
      <TopBar state={state} onProfile={onOpenProfile} />
      <div className="view">
        <div className="hero">
          <div className="t">
            <div className="kick">Ton ascension</div>
            <h2>Bonjour 👋</h2>
            <div className="bar" style={{ ["--accent" as string]: "var(--pink)" }}>
              <span style={{ width: `${((state.stats.xp % 300) / 300) * 100}%` }}></span>
            </div>
          </div>
          <div>
            <Cat size={72} />
          </div>
        </div>
        {THEMES.map((t, i) => {
          const nx = THEMES[i + 1];
          return (
            <div key={t.id}>
              <MountainBlock t={t} state={state} onOpen={(l) => onOpenLesson(t.id, l)} />
              {i < THEMES.length - 1 && (
                <div className="valley">
                  <span className="lk">
                    {themeUnlocked(state, nx) ? (
                      <>⛰️ Montagne débloquée : {nx.name}</>
                    ) : (
                      <>
                        <Icon name="lock" size={13} /> {nx.name} — gagne le trophée{" "}
                        {THEMES.find((x) => x.id === nx.prereq)?.name || ""}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <div className="foot">
          Fait avec <span className="h">❤</span> en FRANCE <Flag /> · Propulsé par <MistralBadge />
        </div>
      </div>
    </>
  );
}

/* ============ LESSON ============ */
type GeneratedQ = {
  type: "reflect" | "quiz";
  q: string;
  opts: { emoji: string; label: string; value: string; correct?: boolean }[];
  fb?: string;
} | null;

function ToolBody({ t, profile, onDone }: { t: Theme; profile: Profile; onDone: () => void }) {
  const gross0 = profile.income ? BAND_MID[profile.income] ?? 2100 : 2100;
  const [monthly, setMonthly] = useState(gross0);
  const net = Math.round(monthly * (1 - RATE));
  const cot = monthly - net;
  const MIN = 1200,
    MAX = 10000,
    AMIN = MIN * 12,
    AMAX = MAX * 12;
  const yearly = monthly * 12;

  return (
    <>
      <div className="qhead" style={{ marginTop: 4 }}>
        <Cat size={42} />
        <div className="who">
          <span className="d"></span>Outil · brut→net
        </div>
      </div>
      <div className="qbubble">Calcule ton net réel — glisse ton salaire brut.</div>
      <div className="slwrap">
        <div className="lab">
          <span className="t">Salaire annuel brut</span>
          <span className="v">
            <input
              type="number"
              className="salin"
              value={yearly}
              min={AMIN}
              max={AMAX}
              step={600}
              onChange={(e) => setMonthly(Math.round((+e.target.value || 0) / 12))}
              aria-label="Salaire annuel brut"
            />{" "}
            €
          </span>
        </div>
        <input
          type="range"
          min={AMIN}
          max={AMAX}
          step={600}
          value={Math.min(AMAX, Math.max(AMIN, yearly))}
          style={{ ["--fill" as string]: `${((Math.min(AMAX, Math.max(AMIN, yearly)) - AMIN) / (AMAX - AMIN)) * 100}%` }}
          onChange={(e) => setMonthly(Math.round(+e.target.value / 12))}
        />
        <div className="lab" style={{ marginTop: 14 }}>
          <span className="t">Salaire mensuel brut</span>
          <span className="v">
            <input
              type="number"
              className="salin small"
              value={monthly}
              min={MIN}
              max={MAX}
              step={50}
              onChange={(e) => setMonthly(+e.target.value || 0)}
              aria-label="Salaire mensuel brut"
            />{" "}
            €
          </span>
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={50}
          value={Math.min(MAX, Math.max(MIN, monthly))}
          style={{ ["--fill" as string]: `${((Math.min(MAX, Math.max(MIN, monthly)) - MIN) / (MAX - MIN)) * 100}%` }}
          onChange={(e) => setMonthly(+e.target.value)}
        />
      </div>
      <div className="result">
        <div style={{ fontSize: 13, color: "var(--sub)", fontWeight: 700 }}>Net dans ta poche / mois</div>
        <div className="net">{eur(net)}</div>
        <div className="row cot">
          <span>− Cotisations (−21,8 %)</span>
          <span className="v">−{eur(cot)}</span>
        </div>
        <div className="row">
          <span>= Net réel</span>
          <span className="v">{eur(net)}</span>
        </div>
      </div>
      <div className="rgpd">💡 Ton chiffre reste ici, il n&rsquo;est pas enregistré (on ne garde qu&rsquo;une bande).</div>
      <div className="spacer"></div>
      <button className="btn block" onClick={onDone}>
        J&rsquo;ai compris <Icon name="check" size={18} />
      </button>
    </>
  );
}

function Lesson({
  theme,
  levelId,
  profile,
  onExit,
  onFinish,
}: {
  theme: Theme;
  levelId: string;
  profile: Profile;
  onExit: () => void;
  onFinish: (correct: number, total: number) => void;
}) {
  const level = theme.levels.find((x) => x.id === levelId)!;
  const items = level.items;
  const total = items.length;

  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [sel, setSel] = useState<number | number[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [gen, setGen] = useState<GeneratedQ>(null);
  const fetchedFor = useRef<number>(-1);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme.color);
    document.documentElement.style.setProperty("--accent-s", theme.soft);
  }, [theme]);

  const it = items[i];

  useEffect(() => {
    setSel(null);
    setRevealed(false);
    setGen(null);
    if (it.kind === "reflect" && it.llm && fetchedFor.current !== i) {
      fetchedFor.current = i;
      setThinking(true);
      const start = Date.now();
      const minWait = 1100;
      fetch("/api/generate-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: theme.id, profile, answers: {}, locale: "fr-FR" }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((data) => {
          const elapsed = Date.now() - start;
          const wait = Math.max(0, minWait - elapsed);
          setTimeout(() => {
            if (data && data.q && Array.isArray(data.opts)) setGen({ ...data, type: data.type === "quiz" ? "quiz" : "reflect" });
            setThinking(false);
          }, wait);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, theme.id]);

  function pick(idx: number) {
    if (it.kind === "tool" || revealed) return;
    if (it.type === "multi") {
      setSel((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.includes(idx) ? arr.filter((x) => x !== idx) : [...arr, idx];
      });
      return;
    }
    setSel(idx);
    const effKind = gen ? gen.type : it.kind;
    if (effKind === "reflect") {
      setRevealed(true);
      setCorrect((c) => c + 1);
    }
  }

  function reveal() {
    setRevealed(true);
    const effKind = gen ? gen.type : it.kind;
    if (effKind === "quiz") {
      const ok = gen ? gen.opts[sel as number]?.correct : it.kind === "quiz" ? it.opts[sel as number]?.[2] : undefined;
      if (ok) setCorrect((c) => c + 1);
    } else {
      setCorrect((c) => c + 1);
    }
  }

  function next() {
    if (i < total - 1) {
      setI(i + 1);
    } else {
      onFinish(correct, total);
    }
  }

  const head = (
    <div className="lprog">
      <div className="x" onClick={onExit}>
        <Icon name="back" size={18} />
      </div>
      <div className="bar" style={{ ["--accent" as string]: theme.color }}>
        <span style={{ width: `${(i / total) * 100}%` }}></span>
      </div>
      <div className="hp">
        <Icon name="star" size={15} /> {correct}/{total}
      </div>
    </div>
  );

  if (it.kind === "tool") {
    return (
      <>
        {head}
        <div className="lwrap">
          <ToolBody t={theme} profile={profile} onDone={() => onFinish(total, total)} />
        </div>
      </>
    );
  }

  if (thinking) {
    return (
      <>
        {head}
        <div className="lwrap">
          <div className="center" style={{ minHeight: "auto", padding: "30px 0" }}>
            <span
              className="pill llm"
              style={{ alignSelf: "center", background: "linear-gradient(135deg,#EAE4FF,#FFE1EF)", color: "#7C3AED" }}
            >
              ✨ Matou réfléchit…
            </span>
            <Cat size={100} />
            <h1 style={{ fontSize: 22 }}>Une question rien que pour toi</h1>
            <p>Matou lit tes réponses…</p>
            <div className="tdots">
              <i></i>
              <i></i>
              <i></i>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isLLM = it.kind === "reflect" && it.llm;
  const effKind = gen ? gen.type : it.kind;
  const qtext = gen ? gen.q : typeof it.q === "function" ? it.q(profile) : it.q;
  const qfb = gen ? gen.fb : it.kind === "quiz" ? it.fb : undefined;
  const opts: [string, string, number?][] = gen
    ? gen.opts.map((o) => [o.emoji, o.label, o.correct ? 1 : 0])
    : it.opts;

  const selArr = Array.isArray(sel) ? sel : [];
  const showDisc = theme.disc && i === 0;

  return (
    <>
      {head}
      <div className="lwrap">
        {showDisc && (
          <div className="disc">
            <Icon name="info" size={16} /> {DISCLAIMER}
          </div>
        )}
        <div className={isLLM ? "llmq" : ""}>
          <div className="qhead" style={{ marginTop: 4 }}>
            <Cat size={42} />
            {isLLM ? (
              <div className="who llm">✨ Générée par Mistral · pour toi</div>
            ) : (
              <div className="who">
                <span className="d"></span>Niveau · {theme.name}
              </div>
            )}
            <div className="qcount">
              {i + 1}/{total}
            </div>
          </div>
          <div className="qbubble">{qtext}</div>
          {opts.map((o, oi) => {
            let cls = "qopt";
            if (revealed) {
              if (effKind === "quiz") {
                if (o[2]) cls += " good";
                else if (sel === oi) cls += " bad";
                else cls += " dim";
              } else if (it.type === "multi" ? selArr.includes(oi) : sel === oi) cls += " sel";
            } else if (it.type === "multi" ? selArr.includes(oi) : sel === oi) cls += " sel";
            return (
              <button key={oi} className={cls} onClick={revealed ? undefined : () => pick(oi)}>
                <span className="e">{o[0]}</span>
                <span>{o[1]}</span>
                <span className="chk">
                  <Icon name="check" size={14} />
                </span>
              </button>
            );
          })}
          <div className="spacer"></div>
          {revealed ? (
            <>
              {effKind === "quiz" && (
                <div className={`feedback ${opts[sel as number]?.[2] ? "ok" : "no"}`}>
                  {opts[sel as number]?.[2] ? "✅ Bien vu !" : "💡 "}
                  {qfb || ""}
                </div>
              )}
              <button className="btn block" onClick={next}>
                {i < total - 1 ? "Continuer" : "Terminer"} <Icon name="arrow" size={18} />
              </button>
            </>
          ) : (
            <button
              className="btn block"
              disabled={it.type === "multi" ? selArr.length === 0 : sel == null}
              onClick={reveal}
            >
              Valider
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ============ PROFILE ============ */
function ProfileView({ state, onBack, onReset }: { state: AppState; onBack: () => void; onReset: () => void }) {
  const p = state.profile;
  const trophies = THEMES.filter((t) => state.trophies[t.id]);
  const rows: [string, string][] = [
    ["Situation", p.sit || "—"],
    ["Revenus (bande)", p.income ? (p.income === "undisclosed" ? "Non communiqué" : bandLabel(p.income)) : "—"],
    ["Objectif", Array.isArray(p.goal) ? p.goal.join(", ") : p.goal || "—"],
    ["À l'aise avec l'argent", p.conf ? p.conf + "/5" : "—"],
  ];
  return (
    <>
      <TopBar state={state} onProfile={() => {}} />
      <div className="view">
        <div className="center" style={{ minHeight: "auto", padding: "10px 0 4px" }}>
          <Cat size={96} />
          <h1 style={{ fontSize: 26, marginTop: 8 }}>Ton profil</h1>
        </div>
        <div className="pcard">
          <h3>🧭 Ce que Matou sait de toi</h3>
          {rows.map((r) => (
            <div className="prow" key={r[0]}>
              <span className="k">{r[0]}</span>
              <span className="v">{r[1]}</span>
            </div>
          ))}
          <div className="rgpd">🔒 Bandes uniquement, jamais tes montants exacts. Tout reste sur ton appareil. {DISCLAIMER}</div>
        </div>
        <div className="pcard">
          <h3>
            🏆 Trophées <span style={{ color: "var(--faint)", fontWeight: 600, fontSize: 13 }}>{trophies.length}/{THEMES.length}</span>
          </h3>
          <div className="tgrid">
            {THEMES.map((t) => (
              <div className="tslot" key={t.id}>
                <div className={`tbadge ${state.trophies[t.id] ? "on" : ""}`} title={t.name}>
                  {state.trophies[t.id] ? "🏆" : t.emoji}
                </div>
                <div className="tlab">{t.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="pcard">
          <h3>📊 Progression</h3>
          {THEMES.map((t) => {
            const { d, tot } = themeProgress(state, t);
            return (
              <div className="prow" key={t.id}>
                <span className="k">
                  {t.emoji} {t.name}
                </span>
                <span className="v">{themeUnlocked(state, t) ? `${d}/${tot}` : "🔒"}</span>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center" }}>
          <button className="btn ghost" onClick={onBack}>
            <Icon name="back" size={18} /> Retour à la carte
          </button>
          <div style={{ height: 14 }}></div>
          <button
            className="linkbtn"
            onClick={() => {
              if (confirm("Tout remettre à zéro ?")) onReset();
            }}
          >
            Réinitialiser ma progression
          </button>
        </div>
        <div className="foot">
          Fait avec <span className="h">❤</span> en FRANCE <Flag /> · Propulsé par <MistralBadge />
        </div>
      </div>
    </>
  );
}

/* ============ REWARD ============ */
function Reward({
  passed,
  correct,
  total,
  need,
  newTrophy,
  themeName,
  levelTitle,
  gainedXp,
  gainedCoins,
  streak,
  onRetry,
  onBackMap,
  onContinue,
}: {
  passed: boolean;
  correct: number;
  total: number;
  need: number;
  newTrophy: boolean;
  themeName: string;
  levelTitle: string;
  gainedXp: number;
  gainedCoins: number;
  streak: number;
  onRetry: () => void;
  onBackMap: () => void;
  onContinue: () => void;
}) {
  if (!passed) {
    return (
      <div className="view">
        <div className="reward">
          <div className="em" style={{ fontSize: 52 }}>
            😺
          </div>
          <div className="pop">Presque !</div>
          <div className="sub">
            {correct}/{total} — il faut {need}/{total}. On réessaie ?
          </div>
          <button className="btn block" onClick={onRetry}>
            Réessayer <Icon name="arrow" size={18} />
          </button>
          <div style={{ height: 10 }}></div>
          <button className="btn ghost block" onClick={onBackMap}>
            Retour à la carte
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="view">
      <div className="reward">
        {newTrophy ? (
          <>
            <div className="trophybig">🏆</div>
            <div className="pop">Trophée {themeName} !</div>
            <div className="sub">Sommet conquis. +100 🪙 bonus</div>
          </>
        ) : (
          <>
            <Cat size={120} />
            <div className="pop">Bravo ! 🎉</div>
            <div className="sub">Niveau « {levelTitle} » validé.</div>
          </>
        )}
        <div className="gains">
          <div className="gpill xp">
            <div className="n">+{gainedXp}</div>
            <div className="l">XP</div>
          </div>
          <div className="gpill coin">
            <div className="n">
              +{gainedCoins}
              {newTrophy ? "+100" : ""}
            </div>
            <div className="l">PIÈCES</div>
          </div>
          <div className="gpill streak">
            <div className="n">{streak}</div>
            <div className="l">JOURS 🔥</div>
          </div>
        </div>
        <button className="btn block" onClick={onContinue}>
          Continuer l&rsquo;ascension <Icon name="arrow" size={18} />
        </button>
      </div>
    </div>
  );
}

/* ============ APP ROOT ============ */
export default function MatouApp() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AppState>(freshState);
  const [nav, setNav] = useState<Nav>({ view: "map" });
  const [rewardInfo, setRewardInfo] = useState<null | {
    themeId: string;
    levelId: string;
    correct: number;
    total: number;
  }>(null);
  const [burstKey, setBurstKey] = useState(0);
  const appRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowHint(gap > 24);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [nav, rewardInfo, mounted, state.onboarded]);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, mounted]);

  const theme = useMemo(() => THEMES.find((t) => t.id === nav.t), [nav.t]);

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="appshell">
        <div id="app" ref={appRef}>
          {children}
        </div>
        <div className={`scrollhint${showHint ? "" : " hide"}`} aria-hidden="true">
          <span className="chev">
            <Icon name="down" size={16} />
          </span>
        </div>
      </div>
    );
  }

  if (!mounted) return null;

  if (!state.onboarded) {
    return (
      <Shell>
        <Onboarding
          onDone={(p) => {
            setState((s) => ({ ...s, onboarded: true, profile: p }));
            setNav({ view: "map" });
          }}
        />
      </Shell>
    );
  }

  function finishLevel(themeId: string, levelId: string, correct: number, total: number) {
    setRewardInfo({ themeId, levelId, correct, total });
  }

  let body: React.ReactNode = null;

  if (rewardInfo) {
    const t = THEMES.find((x) => x.id === rewardInfo.themeId)!;
    const l = t.levels.find((x) => x.id === rewardInfo.levelId)!;
    const need = Math.max(1, rewardInfo.total - 1);
    const passed = rewardInfo.correct >= need;
    if (passed) {
      const firstTime = !levelDone(state, t.id, l.id);
      const nextState: AppState = JSON.parse(JSON.stringify(state));
      nextState.done[t.id] = nextState.done[t.id] || {};
      nextState.done[t.id][l.id] = true;
      let gainedXp = 0,
        gainedCoins = 0;
      if (firstTime) {
        gainedXp = 80;
        gainedCoins = 20;
        nextState.stats.xp += 80;
        nextState.stats.coins += 20;
      }
      const allDone = t.levels.every((x) => nextState.done[t.id]?.[x.id]);
      let newTrophy = false;
      if (allDone && !nextState.trophies[t.id]) {
        nextState.trophies[t.id] = true;
        newTrophy = true;
        nextState.stats.coins += 100;
      }
      if (JSON.stringify(nextState) !== JSON.stringify(state)) {
        setState(nextState);
      }
      body = (
        <Reward
          passed
          correct={rewardInfo.correct}
          total={rewardInfo.total}
          need={need}
          newTrophy={newTrophy}
          themeName={t.name}
          levelTitle={l.title}
          gainedXp={gainedXp}
          gainedCoins={gainedCoins}
          streak={nextState.stats.streak}
          onRetry={() => {}}
          onBackMap={() => {
            setRewardInfo(null);
            setNav({ view: "map" });
          }}
          onContinue={() => {
            setRewardInfo(null);
            setNav({ view: "map" });
            if (typeof window !== "undefined") setBurstKey((k) => k + 1);
          }}
        />
      );
      if (burstKey === 0) setTimeout(() => setBurstKey((k) => k + 1), 0);
    } else {
      body = (
        <Reward
          passed={false}
          correct={rewardInfo.correct}
          total={rewardInfo.total}
          need={need}
          newTrophy={false}
          themeName={t.name}
          levelTitle={l.title}
          gainedXp={0}
          gainedCoins={0}
          streak={state.stats.streak}
          onRetry={() => {
            setRewardInfo(null);
          }}
          onBackMap={() => {
            setRewardInfo(null);
            setNav({ view: "map" });
          }}
          onContinue={() => {}}
        />
      );
    }
  } else if (nav.view === "lesson" && theme && nav.l) {
    body = (
      <Lesson
        theme={theme}
        levelId={nav.l}
        profile={state.profile}
        onExit={() => setNav({ view: "map" })}
        onFinish={(correct, total) => finishLevel(theme.id, nav.l!, correct, total)}
      />
    );
  } else if (nav.view === "profile") {
    body = (
      <ProfileView
        state={state}
        onBack={() => setNav({ view: "map" })}
        onReset={() => {
          localStorage.removeItem(STORAGE_KEY);
          setState(freshState());
          setNav({ view: "map" });
        }}
      />
    );
  } else {
    body = (
      <MapView
        state={state}
        onOpenLesson={(t, l) => setNav({ view: "lesson", t, l })}
        onOpenProfile={() => setNav({ view: "profile" })}
      />
    );
  }

  return (
    <>
      <Shell>{body}</Shell>
      <Confetti burstKey={burstKey} />
    </>
  );
}
