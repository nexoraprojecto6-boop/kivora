import { useState, type ReactNode } from "react";

/*
 * Modelos desenhados em SVG (ilustração vetorial, sem ficheiros externos).
 * Para usar fotografias reais, coloque recortes com fundo transparente (PNG/WebP, proporção 4:5, ~900×1125)
 * em apps/web/public/welcome/model-a.webp e model-b.webp: a página usa-os automaticamente.
 */

export function ModelA() {
  return (
    <svg viewBox="0 0 260 340" className="lp-model__art" aria-hidden="true" focusable="false">
      <defs>
          <linearGradient id="scrA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5B9BFF"/><stop offset="1" stopColor="#1B3FBF"/></linearGradient>
          <linearGradient id="hairA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8A5530"/><stop offset="1" stopColor="#5A3419"/></linearGradient>
          <linearGradient id="jacketA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A78FF"/><stop offset="1" stopColor="#2255D6"/></linearGradient>
          <radialGradient id="cheekA"><stop offset="0" stopColor="#FF8A8A" stopOpacity=".55"/><stop offset="1" stopColor="#FF8A8A" stopOpacity="0"/></radialGradient>
        </defs>
        {/* cabelo atrás */}
        <path d="M84 96 C70 40 196 34 178 100 C196 150 204 214 188 262 L72 262 C56 214 66 150 84 96Z" fill="url(#hairA)"/>
        {/* tronco: t-shirt + casaco */}
        <g transform="translate(0 -12)"><path d="M26 352 C26 274 70 238 130 238 C190 238 234 274 234 352Z" fill="url(#jacketA)"/>
        <path d="M104 238 L130 308 L156 238 C146 244 114 244 104 238Z" fill="#fff"/>
        <path d="M104 238 L90 244 L118 312 L130 308Z" fill="#2B63E8"/>
        <path d="M156 238 L170 244 L142 312 L130 308Z" fill="#2B63E8"/>
        <path d="M130 308 L130 352" stroke="#1B45B5" strokeWidth="2" opacity=".5"/></g>
        {/* pescoço */}
        <path d="M110 160 H150 V204 C140 216 120 216 110 204Z" fill="#E6B392"/>
        <path d="M110 176 C122 190 138 190 150 176 V190 C140 202 120 202 110 190Z" fill="#D49C7A" opacity=".5"/>
        {/* cabeça */}
        <ellipse cx="130" cy="118" rx="43" ry="51" fill="#F6CFB4"/>
        <ellipse cx="88" cy="124" rx="6" ry="10" fill="#F0BFA0"/>
        <ellipse cx="172" cy="124" rx="6" ry="10" fill="#F0BFA0"/>
        {/* franja */}
        <path d="M84 104 C80 54 170 36 178 100 C170 78 148 66 126 70 C112 84 96 98 84 104Z" fill="url(#hairA)"/>
        <path d="M96 70 C118 56 150 58 170 78" stroke="#A8693C" strokeWidth="3" fill="none" opacity=".5" strokeLinecap="round"/>
        {/* rosto */}
        <ellipse cx="102" cy="138" rx="14" ry="9" fill="url(#cheekA)"/>
        <ellipse cx="158" cy="138" rx="14" ry="9" fill="url(#cheekA)"/>
        <path d="M100 106 Q108 100 117 105" stroke="#5A3419" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
        <path d="M143 105 Q152 100 160 106" stroke="#5A3419" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
        <ellipse cx="108.500" cy="118" rx="5.200" ry="6" fill="#2E211B"/>
        <ellipse cx="151.500" cy="118" rx="5.200" ry="6" fill="#2E211B"/>
        <circle cx="110.500" cy="116" r="1.800" fill="#fff"/>
        <circle cx="153.500" cy="116" r="1.800" fill="#fff"/>
        <path d="M130 120 C127 130 126 134 132 135" stroke="#D49C7A" strokeWidth="2.600" fill="none" strokeLinecap="round"/>
        <path d="M110 144 Q130 166 150 144 Q130 150 110 144Z" fill="#B63A55"/>
        <path d="M113 145.500 Q130 154 147 145.500 Q130 149 113 145.500Z" fill="#fff"/>
        {/* antebraço + telefone */}
        <path d="M218 340 C226 304 208 284 190 274 L166 304 C176 318 180 330 178 340Z" fill="#4A86FF"/><path d="M184 286 L196 276 L206 286 L192 298Z" fill="#fff"/>
        <path d="M176 280 L190 270 C197 274 199 282 193 288 L182 298Z" fill="#F0BFA0"/>
        <g transform="rotate(-9 168 258)">
          <rect x="148" y="214" width="44" height="80" rx="9" fill="#0E1A33"/>
          <rect x="151" y="218" width="38" height="72" rx="6.500" fill="url(#scrA)"/>
          <rect x="162" y="220" width="16" height="3.600" rx="1.800" fill="#0E1A33"/>
          <polyline points="156,274 163,262 169,267 176,252 184,246" fill="none" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="184" cy="246" r="3" fill="#FFD447"/>
          <rect x="156" y="228" width="26" height="6" rx="3" fill="#fff" opacity=".85"/>
          <rect x="156" y="238" width="16" height="4" rx="2" fill="#fff" opacity=".5"/>
          {/* dedos */}
          <rect x="186" y="258" width="14" height="10" rx="5" fill="#F6CFB4"/>
          <rect x="187" y="268" width="14" height="10" rx="5" fill="#F1C3A5"/>
          <rect x="186" y="278" width="13" height="9" rx="4.500" fill="#F6CFB4"/>
          <rect x="144" y="262" width="13" height="20" rx="6.500" fill="#F6CFB4"/>
        </g>
    </svg>
  );
}

export function ModelB() {
  return (
    <svg viewBox="0 0 260 340" className="lp-model__art" aria-hidden="true" focusable="false">
      <defs>
          <linearGradient id="scrB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3DDC97"/><stop offset="1" stopColor="#0B8F5A"/></linearGradient>
          <linearGradient id="topB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD447"/><stop offset="1" stopColor="#F5A623"/></linearGradient>
          <linearGradient id="skinB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9A6644"/><stop offset="1" stopColor="#7C4D31"/></linearGradient>
          <radialGradient id="cheekB"><stop offset="0" stopColor="#FF9B6B" stopOpacity=".5"/><stop offset="1" stopColor="#FF9B6B" stopOpacity="0"/></radialGradient>
        </defs>
        {/* mochila atrás */}
        <rect x="62" y="206" width="136" height="110" rx="30" fill="#0F2A55"/>
        <rect x="104" y="194" width="52" height="22" rx="11" fill="none" stroke="#0F2A55" strokeWidth="7"/>
        <rect x="78" y="230" width="104" height="40" rx="14" fill="#173B73"/>
        {/* cabelo afro (atrás) */}
        <g fill="#1B1411">
          <circle cx="130" cy="92" r="62"/>
          <circle cx="82" cy="104" r="30"/><circle cx="178" cy="104" r="30"/>
          <circle cx="92" cy="58" r="28"/><circle cx="168" cy="58" r="28"/><circle cx="130" cy="40" r="28"/>
          <circle cx="74" cy="136" r="22"/><circle cx="186" cy="136" r="22"/>
        </g>
        <g fill="none" stroke="#3A2C24" strokeWidth="3" strokeLinecap="round" opacity=".7">
          <path d="M96 40 q8 -8 16 0"/><path d="M142 30 q10 -8 18 0"/><path d="M62 90 q-4 10 2 18"/><path d="M198 88 q4 10 -2 18"/><path d="M118 52 q8 -6 14 0"/>
        </g>
        {/* tronco: hoodie amarelo */}
        <g transform="translate(0 -12)">
          <path d="M24 352 C24 274 68 238 130 238 C192 238 236 274 236 352Z" fill="url(#topB)"/>
          <path d="M104 238 C112 262 148 262 156 238 C146 232 114 232 104 238Z" fill="#E8961A"/>
          <path d="M120 250 L118 284 M140 250 L142 284" stroke="#fff" strokeWidth="3.200" strokeLinecap="round"/>
          {/* alças da mochila */}
          <path d="M84 246 C78 280 82 316 86 352 H108 C104 316 104 284 106 244Z" fill="#14233B"/>
          <path d="M176 246 C182 280 178 316 174 352 H152 C156 316 156 284 154 244Z" fill="#14233B"/>
          <path d="M92 262 C90 290 92 320 94 346" stroke="#2D4A7C" strokeWidth="2" fill="none" strokeDasharray="5 5"/>
          <path d="M168 262 C170 290 168 320 166 346" stroke="#2D4A7C" strokeWidth="2" fill="none" strokeDasharray="5 5"/>
        </g>
        {/* pescoço */}
        <path d="M110 160 H150 V204 C140 216 120 216 110 204Z" fill="#8A5636"/>
        <path d="M110 176 C122 190 138 190 150 176 V190 C140 202 120 202 110 190Z" fill="#6E4229" opacity=".6"/>
        {/* cabeça */}
        <ellipse cx="130" cy="118" rx="43" ry="51" fill="url(#skinB)"/>
        <ellipse cx="88" cy="124" rx="6" ry="10" fill="#8A5636"/>
        <ellipse cx="172" cy="124" rx="6" ry="10" fill="#8A5636"/>
        <circle cx="86" cy="138" r="5.500" fill="none" stroke="#FFD447" strokeWidth="2.200"/>
        <circle cx="174" cy="138" r="5.500" fill="none" stroke="#FFD447" strokeWidth="2.200"/>
        {/* franja de cabelo */}
        <path d="M82 104 C78 54 182 54 178 104 C168 82 150 74 130 74 C110 74 92 82 82 104Z" fill="#1B1411"/>
        <circle cx="98" cy="78" r="12" fill="#1B1411"/><circle cx="162" cy="78" r="12" fill="#1B1411"/><circle cx="130" cy="68" r="14" fill="#1B1411"/>
        {/* rosto */}
        <ellipse cx="102" cy="138" rx="14" ry="9" fill="url(#cheekB)"/>
        <ellipse cx="158" cy="138" rx="14" ry="9" fill="url(#cheekB)"/>
        <path d="M100 105 Q108 99 117 104" stroke="#1B1411" strokeWidth="3.400" fill="none" strokeLinecap="round"/>
        <path d="M143 104 Q152 99 160 105" stroke="#1B1411" strokeWidth="3.400" fill="none" strokeLinecap="round"/>
        <ellipse cx="108.500" cy="118" rx="5.200" ry="6" fill="#1A120E"/>
        <ellipse cx="151.500" cy="118" rx="5.200" ry="6" fill="#1A120E"/>
        <circle cx="110.500" cy="116" r="1.800" fill="#fff"/>
        <circle cx="153.500" cy="116" r="1.800" fill="#fff"/>
        <path d="M130 120 C126 130 125 134 132 135" stroke="#6E4229" strokeWidth="2.800" fill="none" strokeLinecap="round"/>
        <path d="M109 144 Q130 168 151 144 Q130 150 109 144Z" fill="#6B2530"/>
        <path d="M112 145.500 Q130 155 148 145.500 Q130 149 112 145.500Z" fill="#fff"/>
        {/* antebraço + telefone (lado esquerdo) */}
        <path d="M42 340 C34 304 52 284 70 274 L94 304 C84 318 80 330 82 340Z" fill="#FFC93C"/>
        <path d="M76 286 L64 276 L54 286 L68 298Z" fill="#fff"/>
        <g transform="rotate(9 92 258)">
          <rect x="68" y="214" width="44" height="80" rx="9" fill="#0E1A33"/>
          <rect x="71" y="218" width="38" height="72" rx="6.500" fill="url(#scrB)"/>
          <rect x="82" y="220" width="16" height="3.600" rx="1.800" fill="#0E1A33"/>
          <circle cx="90" cy="248" r="13" fill="#fff"/>
          <polyline points="83,248 88,254 98,242" fill="none" stroke="#0B8F5A" strokeWidth="3.600" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="77" y="268" width="26" height="5" rx="2.500" fill="#fff" opacity=".85"/>
          <rect x="81" y="277" width="18" height="4" rx="2" fill="#fff" opacity=".5"/>
          <rect x="60" y="258" width="14" height="10" rx="5" fill="#8A5636"/>
          <rect x="59" y="268" width="14" height="10" rx="5" fill="#7C4D31"/>
          <rect x="60" y="278" width="13" height="9" rx="4.500" fill="#8A5636"/>
          <rect x="103" y="262" width="13" height="20" rx="6.500" fill="#8A5636"/>
        </g>
    </svg>
  );
}

/** Mostra a fotografia se existir; enquanto não houver (ou falhar), fica a ilustração. */
export function ModelFigure({ photo, alt, className, children }: { photo: string; alt: string; className: string; children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`lp-model ${className}${loaded ? " lp-model--photo" : ""}`}>
      {children}
      <img className="lp-model__photo" src={photo} alt={loaded ? alt : ""} loading="eager" decoding="async" onLoad={() => setLoaded(true)} onError={() => setLoaded(false)} />
    </div>
  );
}
