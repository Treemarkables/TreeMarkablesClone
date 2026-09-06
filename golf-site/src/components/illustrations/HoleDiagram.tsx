// Hand-drawn-style overhead of a tree-lined hole. Decorative, sits beside
// the scorecard; swap for real aerial photography when the club has some.

function Tree({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#28654A" opacity="0.9" />
      <circle cx={x - r * 0.4} cy={y - r * 0.35} r={r * 0.55} fill="#3D7D5F" />
    </g>
  );
}

export default function HoleDiagram({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 560"
      className={className}
      role="img"
      aria-label="Stylised overhead drawing of a tree-lined par 4 with a dogleg to the right"
    >
      {/* rough */}
      <rect x="0" y="0" width="420" height="560" rx="24" fill="#123527" />
      <rect x="10" y="10" width="400" height="540" rx="18" fill="none" stroke="#C9A227" strokeOpacity="0.35" strokeWidth="1.5" />

      {/* fairway ribbon, gentle dogleg right */}
      <path
        d="M150 520 C120 420 130 340 180 270 C230 200 280 170 300 120"
        stroke="#28654A"
        strokeWidth="92"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M150 520 C120 420 130 340 180 270 C230 200 280 170 300 120"
        stroke="#3D7D5F"
        strokeWidth="70"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* mow lines */}
      <path d="M150 500 C128 420 138 348 184 282" stroke="#5E967B" strokeWidth="2" opacity="0.35" fill="none" />
      <path d="M170 505 C148 425 158 352 202 288" stroke="#5E967B" strokeWidth="2" opacity="0.25" fill="none" />

      {/* green + fringe */}
      <ellipse cx="308" cy="102" rx="52" ry="40" fill="#5E967B" opacity="0.6" />
      <ellipse cx="308" cy="102" rx="40" ry="30" fill="#8AB39E" />

      {/* bunkers */}
      <ellipse cx="252" cy="128" rx="16" ry="10" fill="#F4EDDC" />
      <ellipse cx="352" cy="132" rx="13" ry="8" fill="#F4EDDC" />
      <ellipse cx="205" cy="330" rx="15" ry="9" fill="#F4EDDC" opacity="0.9" />

      {/* trees down both sides */}
      <Tree x={70} y={470} r={13} />
      <Tree x={52} y={392} r={11} />
      <Tree x={76} y={318} r={14} />
      <Tree x={98} y={240} r={11} />
      <Tree x={140} y={170} r={13} />
      <Tree x={196} y={112} r={11} />
      <Tree x={248} y={62} r={12} />
      <Tree x={238} y={472} r={12} />
      <Tree x={262} y={396} r={14} />
      <Tree x={282} y={312} r={12} />
      <Tree x={330} y={238} r={13} />
      <Tree x={368} y={180} r={11} />
      <Tree x={372} y={62} r={12} />

      {/* tee blocks */}
      <rect x="134" y="516" width="34" height="12" rx="6" fill="#C9A227" />

      {/* shot line */}
      <path
        d="M151 512 C140 420 150 340 196 275 C240 212 284 172 305 112"
        stroke="#FAF6EB"
        strokeWidth="2"
        strokeDasharray="2 8"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* flag */}
      <line x1="306" y1="72" x2="306" y2="104" stroke="#FAF6EB" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M307 73 L330 79 L307 86 Z" fill="#C9A227" />

      {/* caption plate */}
      <rect x="26" y="26" width="112" height="46" rx="8" fill="#0B2117" opacity="0.75" />
      <text x="40" y="46" fill="#FAF6EB" fontFamily="Archivo, sans-serif" fontSize="14" fontWeight="600">
        Hole 10
      </text>
      <text x="40" y="63" fill="#C9A227" fontFamily="Archivo, sans-serif" fontSize="11" fontWeight="600" letterSpacing="1">
        PAR 4 · INDEX 1
      </text>
    </svg>
  );
}
