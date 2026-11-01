import { Check, Lock, TrendingUp } from "lucide-react";
import { useCopy } from "../verify/copy.js";
import { CountUp } from "./CountUp.js";
import { ModelA, ModelB, ModelFigure } from "./models.js";

/* ---------- Desenho do globo (valores calculados uma só vez) ---------- */
const CX = 280;
const CY = 418;
const R = 206;

const PARALLELS = [-150, -90, -30, 30, 90, 150].map((y) => ({ y: CY + y, rx: Math.sqrt(R * R - y * y) }));

/** Continentes aproximados (elipses): o padrão de pontos só aparece dentro destas formas. */
const LAND: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [205, 350, 64, 44, -20], [168, 298, 22, 12, 0], [252, 483, 24, 52, 15], [303, 324, 28, 19, -8],
  [320, 426, 40, 62, 5], [398, 338, 82, 48, 8], [392, 410, 18, 26, 0], [424, 500, 34, 19, 0], [350, 300, 14, 8, 0],
];

/** Negociantes: pontos que pulsam sobre o globo. */
const TRADERS: ReadonlyArray<readonly [number, number]> = [
  [190, 338], [250, 308], [330, 330], [395, 380], [432, 448], [372, 498], [300, 540], [222, 518],
  [160, 448], [212, 408], [300, 403], [352, 430], [262, 476], [402, 310],
];

const ARCS = [
  "M190,338 Q270,240 330,330", "M330,330 Q424,276 432,448", "M160,448 Q250,370 300,403",
  "M222,518 Q300,446 372,498", "M250,308 Q340,228 395,380", "M300,540 Q400,498 432,448",
];

const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [60, 60, 1.6], [500, 48, 1.4], [520, 150, 1.8], [34, 170, 1.3], [470, 230, 1.2], [90, 250, 1.5], [300, 24, 1.2],
];

/**
 * Cartão principal da página: globo de pontos com negociantes a pulsar, ligações animadas,
 * a frase de confiança (35 milhões / 23 anos) e duas modelos a sorrir com o telemóvel.
 * Só usa animações de transformação/opacidade; param com "reduzir movimento".
 */
export function HeroCard() {
  const c = useCopy();
  return (
    <div className="lp-card">
      <svg className="lp-card__bg" viewBox="0 0 560 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="lpBg" x1="0" y1="0" x2=".7" y2="1">
            <stop offset="0" stopColor="#0A1A3F" /><stop offset=".55" stopColor="#0B3399" /><stop offset="1" stopColor="#175BFF" />
          </linearGradient>
          <radialGradient id="lpGlobe" cx=".42" cy=".35" r=".8">
            <stop offset="0" stopColor="#3C82FF" stopOpacity=".85" /><stop offset=".6" stopColor="#1346C9" stopOpacity=".7" /><stop offset="1" stopColor="#0A2A86" stopOpacity=".85" />
          </radialGradient>
          <radialGradient id="lpGlow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#6FB1FF" stopOpacity=".55" /><stop offset="1" stopColor="#6FB1FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lpGold" cx=".5" cy="1" r=".7">
            <stop offset="0" stopColor="#FFD447" stopOpacity=".45" /><stop offset="1" stopColor="#FFD447" stopOpacity="0" />
          </radialGradient>
          <pattern id="lpDots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.7" fill="#B9D6FF" /></pattern>
          <clipPath id="lpGlobeClip"><circle cx={CX} cy={CY} r={R} /></clipPath>
          <clipPath id="lpLand">
            {LAND.map(([x, y, rx, ry, rot]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${rot} ${x} ${y})`} />)}
          </clipPath>
        </defs>
        <rect width="560" height="660" fill="url(#lpBg)" />
        <circle cx={CX} cy={CY} r="320" fill="url(#lpGlow)" />
        {STARS.map(([x, y, s], i) => <circle key={`${x}-${y}`} className="lp-star" cx={x} cy={y} r={s} fill="#fff" style={{ animationDelay: `-${(i * 0.7).toFixed(1)}s` }} />)}
        <g className="lp-ring">
          <circle cx={CX} cy={CY} r="240" fill="none" stroke="#fff" strokeOpacity=".22" strokeDasharray="2 9" strokeLinecap="round" />
          <circle cx={CX} cy={CY - 240} r="14" fill="#FFD447" fillOpacity=".25" />
          <circle cx={CX} cy={CY - 240} r="7" fill="#FFD447" />
        </g>
        <circle cx={CX} cy={CY} r={R} fill="url(#lpGlobe)" />
        <g clipPath="url(#lpGlobeClip)">
          <g clipPath="url(#lpLand)" className="lp-land"><rect x="60" y="180" width="440" height="460" fill="url(#lpDots)" /></g>
          {PARALLELS.map((p) => <ellipse key={p.y} cx={CX} cy={p.y} rx={p.rx} ry="14" fill="none" stroke="#9CC4FF" strokeOpacity=".16" />)}
          {[0, 1, 2].map((i) => (
            <ellipse key={i} className="lp-mer" cx={CX} cy={CY} rx={R} ry={R} fill="none" stroke="#9CC4FF" strokeOpacity=".3" style={{ animationDelay: `-${i * 3}s` }} />
          ))}
          {ARCS.map((d, i) => (
            <path key={d} className="lp-arc" d={d} fill="none" stroke="#FFD447" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 10" style={{ animationDelay: `-${(i * 0.9).toFixed(1)}s` }} />
          ))}
          {TRADERS.map(([x, y], i) => (
            <g key={`${x}-${y}`}>
              <circle className="lp-ping" cx={x} cy={y} r="9" fill="none" stroke="#FFD447" strokeWidth="1.6" style={{ animationDelay: `-${((i * 0.37) % 3).toFixed(2)}s` }} />
              <circle cx={x} cy={y} r="4.2" fill="#FFD447" />
              <circle cx={x} cy={y} r="1.7" fill="#fff" />
            </g>
          ))}
        </g>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
        <rect x="0" y="480" width="560" height="180" fill="url(#lpGold)" />
      </svg>

      <div className="lp-card__text">
        <span className="lp-card__kicker">{c("lp.cardKicker")}</span>
        <p className="lp-card__big"><span className="lp-card__num"><CountUp to={35} /></span> <span className="lp-card__unit">{c("lp.cardMillions")}</span></p>
        <p className="lp-card__tail">{c("lp.cardTail")}</p>
        <span className="lp-card__years"><Check size={14} aria-hidden="true" />{c("lp.opYears", { n: "23" })}</span>
      </div>

      <div className="lp-card__people">
        <ModelFigure photo="/welcome/model-a.webp" alt={c("lp.altA")} className="lp-model--a"><ModelA /></ModelFigure>
        <ModelFigure photo="/welcome/model-b.webp" alt={c("lp.altB")} className="lp-model--b"><ModelB /></ModelFigure>
      </div>

      <span className="lp-chip lp-chip--1"><i className="lp-chip__ico lp-chip__ico--green"><Check size={13} aria-hidden="true" /></i>{c("lp.chipVerified")}</span>
      <span className="lp-chip lp-chip--2"><i className="lp-chip__ico lp-chip__ico--blue"><TrendingUp size={13} aria-hidden="true" /></i>{c("lp.chipBalance")}</span>
      <span className="lp-chip lp-chip--3"><i className="lp-chip__ico lp-chip__ico--gold"><Lock size={12} aria-hidden="true" /></i>{c("lp.chipSecure")}</span>
    </div>
  );
}
