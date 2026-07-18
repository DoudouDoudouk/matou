export type Profile = {
  sit?: string;
  income?: string; // band id (b1..b5) or 'undisclosed'
  goal?: string | string[];
  conf?: number;
};

export type QuizOpt = [emoji: string, label: string, correct?: number];
export type ReflectOpt = [emoji: string, label: string];

export type QuizItem = {
  kind: "quiz";
  type: "single";
  q: string;
  opts: QuizOpt[];
  fb?: string;
};

export type ReflectItem = {
  kind: "reflect";
  type: "single" | "multi";
  q: string | ((p: Profile) => string);
  opts: ReflectOpt[];
  llm?: boolean;
};

export type ToolItem = { kind: "tool" };

export type Item = QuizItem | ReflectItem | ToolItem;

export type Level = { id: string; title: string; items: Item[]; tool?: boolean };

export type Theme = {
  id: string;
  name: string;
  emoji: string;
  ic: "wallet" | "budget" | "tax" | "invest";
  color: string;
  soft: string;
  prereq: string | null;
  disc: boolean;
  levels: Level[];
};

export const RATE = 0.218;

export const THEMES: Theme[] = [
  {
    id: "revenu",
    name: "Revenus",
    emoji: "💶",
    ic: "wallet",
    color: "#FF6FB0",
    soft: "#FFE1EF",
    prereq: null,
    disc: false,
    levels: [
      {
        id: "r1",
        title: "Brut & net",
        items: [
          {
            kind: "quiz",
            type: "single",
            q: "Ton salaire net, c'est…",
            opts: [
              ["💸", "Avant les cotisations", 0],
              ["✅", "Ce qui arrive sur ton compte", 1],
              ["🏛️", "L'impôt uniquement", 0],
            ],
            fb: "Le net = ce que tu touches vraiment, après les cotisations.",
          },
          {
            kind: "quiz",
            type: "single",
            q: "Les cotisations sociales financent surtout…",
            opts: [
              ["🏥", "Retraite, santé, chômage", 1],
              ["🎁", "Rien du tout", 0],
              ["🏢", "L'employeur seulement", 0],
            ],
            fb: "Elles financent ta protection sociale : retraite, santé, chômage.",
          },
          {
            kind: "reflect",
            type: "single",
            llm: true,
            q: (p) =>
              `Sur ${p.income ? bandLabel(p.income) : "ton salaire"}, quelle part penses-tu pouvoir mettre de côté ?`,
            opts: [
              ["🙂", "~10 %"],
              ["😀", "~20 %"],
              ["🤑", "~30 %"],
              ["🤷", "Aide-moi"],
            ],
          },
          {
            kind: "quiz",
            type: "single",
            q: "Sur un salaire brut, environ combien part en cotisations (salarié) ?",
            opts: [
              ["🔟", "~10 %", 0],
              ["✅", "~22 %", 1],
              ["5️⃣", "~50 %", 0],
            ],
            fb: "Environ 22 % du brut pour un salarié non-cadre.",
          },
        ],
      },
      { id: "r2", title: "Simu brut→net", tool: true, items: [{ kind: "tool" }] },
    ],
  },
  {
    id: "budget",
    name: "Budget",
    emoji: "🌿",
    ic: "budget",
    color: "#12BCB0",
    soft: "#D3F6F1",
    prereq: null,
    disc: false,
    levels: [
      {
        id: "b1",
        title: "La règle 50/30/20",
        items: [
          {
            kind: "quiz",
            type: "single",
            q: "La règle 50/30/20 répartit ton budget entre…",
            opts: [
              ["🏠", "Besoins / Envies / Épargne", 1],
              ["🧾", "Impôts / Loyer / Sorties", 0],
              ["🎰", "Au hasard", 0],
            ],
            fb: "50 % besoins, 30 % envies, 20 % épargne — un repère, pas une règle absolue.",
          },
          {
            kind: "quiz",
            type: "single",
            q: "Un fonds d'urgence idéal couvre environ…",
            opts: [
              ["1️⃣", "1 jour", 0],
              ["🛡️", "3 mois de dépenses", 1],
              ["🏦", "10 ans", 0],
            ],
            fb: "Vise ~3 mois de dépenses pour absorber les imprévus.",
          },
          {
            kind: "reflect",
            type: "single",
            llm: true,
            q: () => `Vu ton objectif, on attaque quoi d'abord dans ton budget ?`,
            opts: [
              ["💥", "Le plus gros poste"],
              ["✅", "Le plus facile"],
              ["🔁", "Le plus fréquent"],
              ["🤔", "Choisis pour moi"],
            ],
          },
          {
            kind: "reflect",
            type: "multi",
            q: "Où ça dérape le plus pour toi ? (plusieurs)",
            opts: [
              ["🛒", "Courses"],
              ["🍕", "Sorties"],
              ["📱", "Abonnements"],
              ["🛍️", "Shopping"],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "impots",
    name: "Impôts",
    emoji: "⛰️",
    ic: "tax",
    color: "#F5A524",
    soft: "#FFEFCF",
    prereq: "revenu",
    disc: true,
    levels: [
      {
        id: "i1",
        title: "Les bases",
        items: [
          {
            kind: "quiz",
            type: "single",
            q: "Le prélèvement à la source, c'est…",
            opts: [
              ["📅", "L'impôt prélevé chaque mois", 1],
              ["🎟️", "Une taxe sur les tickets", 0],
              ["🚫", "Rien d'officiel", 0],
            ],
            fb: "C'est ton impôt sur le revenu, prélevé directement chaque mois.",
          },
          {
            kind: "quiz",
            type: "single",
            q: "En France, l'impôt sur le revenu est…",
            opts: [
              ["📈", "Progressif, par tranches", 1],
              ["➖", "Un montant fixe pour tous", 0],
              ["🎲", "Aléatoire", 0],
            ],
            fb: "Progressif : plus le revenu monte, plus le taux des tranches hautes s'applique.",
          },
          {
            kind: "reflect",
            type: "single",
            llm: true,
            q: () => `Vu ta situation, tu veux qu'on regarde ce qui te concerne côté impôts ?`,
            opts: [
              ["👍", "Oui, carrément"],
              ["🧾", "Explique d'abord"],
              ["🙅", "Pas maintenant"],
            ],
          },
        ],
      },
    ],
  },
  {
    id: "investissement",
    name: "Investir",
    emoji: "🏔️",
    ic: "invest",
    color: "#8B7CF6",
    soft: "#EAE4FF",
    prereq: "budget",
    disc: true,
    levels: [
      {
        id: "v1",
        title: "Premiers pas",
        items: [
          {
            kind: "quiz",
            type: "single",
            q: "Le Livret A rapporte (ordre d'idée, 2026)…",
            opts: [
              ["📉", "~ -5 %", 0],
              ["🏦", "~ 3 %", 1],
              ["🚀", "~ 20 %", 0],
            ],
            fb: "Autour de 3 % — sans risque et disponible. Un bon point de départ.",
          },
          {
            kind: "quiz",
            type: "single",
            q: "Les intérêts composés, c'est…",
            opts: [
              ["🌱", "Gagner aussi sur ses gains", 1],
              ["🔥", "Tout perdre", 0],
              ["🐌", "Rien de spécial", 0],
            ],
            fb: "Tes intérêts génèrent à leur tour des intérêts — l'effet boule de neige.",
          },
          {
            kind: "reflect",
            type: "single",
            llm: true,
            q: () => `Avant d'investir, tu vises plutôt… ?`,
            opts: [
              ["🛡️", "La sécurité"],
              ["⚖️", "L'équilibre"],
              ["🚀", "La performance"],
            ],
          },
          {
            kind: "quiz",
            type: "single",
            q: "Avant d'investir, on conseille surtout d'avoir…",
            opts: [
              ["🛡️", "Un fonds d'urgence", 1],
              ["🚗", "Une voiture neuve", 0],
              ["🎮", "La dernière console", 0],
            ],
            fb: "D'abord le fonds d'urgence : on n'investit que ce qu'on peut immobiliser.",
          },
        ],
      },
    ],
  },
];

export const DISCLAIMER =
  "Matou éduque, ne conseille pas. À toi de vérifier avant toute décision qui engage ton argent.";

export const BANDS: [string, string][] = [
  ["b1", "< 1 200 €"],
  ["b2", "1 200 – 1 800 €"],
  ["b3", "1 800 – 2 600 €"],
  ["b4", "2 600 – 3 800 €"],
  ["b5", "> 3 800 €"],
];
export const BAND_MID: Record<string, number> = { b1: 1000, b2: 1500, b3: 2100, b4: 3100, b5: 4500 };

export function bandLabel(id?: string) {
  const b = BANDS.find((x) => x[0] === id);
  return b ? b[1] : id ?? "";
}

export function eur(n: number) {
  return Math.round(n).toLocaleString("fr-FR") + " €";
}

export type OnbQuestion = {
  id: keyof Profile;
  q: string;
  opts?: [string, string][];
  vals?: string[];
  multi?: boolean;
  scale?: boolean;
  lo?: string;
  hi?: string;
  skip?: boolean;
};

export const ONB: OnbQuestion[] = [
  {
    id: "sit",
    q: "Tu es dans quelle situation ?",
    opts: [
      ["🎓", "Étudiant·e"],
      ["✨", "Premier salaire"],
      ["💼", "En poste"],
      ["🚀", "Freelance"],
      ["🔎", "Entre deux"],
    ],
  },
  {
    id: "income",
    q: "Tes revenus mensuels, plutôt ? (bandes, jamais le montant exact)",
    opts: BANDS.map((b) => ["💶", b[1]] as [string, string]),
    vals: BANDS.map((b) => b[0]),
    skip: true,
  },
  {
    id: "goal",
    q: "Ton objectif n°1 ?",
    multi: true,
    opts: [
      ["💰", "Mettre de côté"],
      ["🧾", "Payer moins d'impôts"],
      ["📈", "Investir"],
      ["📊", "Gérer mes dépenses"],
      ["🧠", "Comprendre ma paie"],
    ],
  },
  { id: "conf", q: "À l'aise avec l'argent ?", scale: true, lo: "Pas du tout", hi: "Très" },
];

export type AppState = {
  onboarded: boolean;
  profile: Profile;
  stats: { xp: number; coins: number; streak: number };
  done: Record<string, Record<string, boolean>>;
  trophies: Record<string, boolean>;
};

export const STORAGE_KEY = "matou-v1";

export function freshState(): AppState {
  return { onboarded: false, profile: {}, stats: { xp: 0, coins: 0, streak: 1 }, done: {}, trophies: {} };
}

export function levelDone(s: AppState, themeId: string, levelId: string) {
  return !!s.done[themeId]?.[levelId];
}

export function themeUnlocked(s: AppState, t: Theme) {
  return !t.prereq || !!s.trophies[t.prereq];
}

export function themeProgress(s: AppState, t: Theme) {
  const d = t.levels.filter((l) => levelDone(s, t.id, l.id)).length;
  return { d, tot: t.levels.length, pc: Math.round((d / t.levels.length) * 100) };
}

export function currentLevelIdx(s: AppState, t: Theme) {
  for (let i = 0; i < t.levels.length; i++) if (!levelDone(s, t.id, t.levels[i].id)) return i;
  return -1;
}

export function playerLevel(s: AppState) {
  return Math.floor(s.stats.xp / 300) + 1;
}
