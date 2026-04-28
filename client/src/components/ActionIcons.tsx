import { useId } from "react";

interface IconProps {
  className?: string;
}

export function CameraIcon({ className }: IconProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}-ci-body`} x1="8" y1="18" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="55%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <radialGradient id={`${uid}-ci-lens-bg`} cx="45%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#f0fdf4" />
          <stop offset="55%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </radialGradient>
        <radialGradient id={`${uid}-ci-pupil`} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={`${uid}-ci-shine`} x1="8" y1="20" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Body */}
      <rect x="5" y="21" width="54" height="34" rx="7" fill={`url(#${uid}-ci-body)`} />
      {/* Viewfinder notch */}
      <path d="M21 21 L21 16 Q21 13 24 13 L40 13 Q43 13 43 16 L43 21 Z" fill="#15803d" />
      {/* Flash */}
      <rect x="8" y="14" width="9" height="7" rx="3.5" fill="#22c55e" />
      {/* Lens outer halo */}
      <circle cx="32" cy="38" r="13" fill={`url(#${uid}-ci-lens-bg)`} />
      {/* Lens chrome ring */}
      <circle cx="32" cy="38" r="10.5" fill="none" stroke="#86efac" strokeWidth="1.5" />
      {/* Lens inner ring */}
      <circle cx="32" cy="38" r="8.5" fill="#a7f3d0" />
      {/* Pupil */}
      <circle cx="32" cy="38" r="6.5" fill={`url(#${uid}-ci-pupil)`} />
      {/* Catchlight */}
      <circle cx="29.5" cy="35.5" r="2" fill="white" opacity="0.5" />
      <circle cx="35" cy="34.5" r="0.9" fill="white" opacity="0.3" />
      {/* Top-left shine */}
      <rect x="5" y="21" width="54" height="14" rx="7" fill={`url(#${uid}-ci-shine)`} />
      {/* Status dot */}
      <circle cx="52" cy="27" r="2.5" fill="#86efac" />
      <circle cx="52" cy="27" r="1.2" fill="#f0fdf4" />
    </svg>
  );
}

export function SMSIcon({ className }: IconProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}-sms-body`} x1="6" y1="10" x2="58" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id={`${uid}-sms-shine`} x1="6" y1="10" x2="30" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Bubble body */}
      <path d="M8 12 Q8 8 12 8 L52 8 Q56 8 56 12 L56 40 Q56 44 52 44 L22 44 L12 54 L14 44 L12 44 Q8 44 8 40 Z" fill={`url(#${uid}-sms-body)`} />
      {/* Top shine */}
      <path d="M8 12 Q8 8 12 8 L52 8 Q56 8 56 12 L56 22 Q30 22 8 22 Z" fill={`url(#${uid}-sms-shine)`} />
      {/* Message dots */}
      <circle cx="22" cy="26" r="3.5" fill="white" opacity="0.95" />
      <circle cx="32" cy="26" r="3.5" fill="white" opacity="0.95" />
      <circle cx="42" cy="26" r="3.5" fill="white" opacity="0.95" />
      {/* Subtle inner lines */}
      <line x1="16" y1="17" x2="48" y2="17" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.22" />
    </svg>
  );
}

export function EmailIcon({ className }: IconProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}-em-body`} x1="6" y1="14" x2="58" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id={`${uid}-em-flap`} x1="6" y1="14" x2="58" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="55%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <linearGradient id={`${uid}-em-shine`} x1="6" y1="14" x2="32" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Envelope body — white */}
      <rect x="6" y="14" width="52" height="38" rx="6" fill={`url(#${uid}-em-body)`} stroke="#e2e8f0" strokeWidth="1" />
      {/* Flap fold — red V */}
      <path d="M6 14 L32 34 L58 14 Z" fill={`url(#${uid}-em-flap)`} />
      {/* Shine on flap */}
      <path d="M6 14 L32 34 L58 14 Z" fill={`url(#${uid}-em-shine)`} />
      {/* Red ruled lines on body */}
      <line x1="16" y1="38" x2="48" y2="38" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" opacity="0.30" />
      <line x1="16" y1="43" x2="42" y2="43" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" opacity="0.20" />
      {/* Seal circle at crease point */}
      <circle cx="32" cy="34" r="3.5" fill="#dc2626" opacity="0.20" />
    </svg>
  );
}

export function MoreDotsIcon({ className }: IconProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`${uid}-md-dot`} cx="40%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="55%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <radialGradient id={`${uid}-md-shine`} cx="40%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="32" r="7.5" fill={`url(#${uid}-md-dot)`} />
      <circle cx="16" cy="32" r="7.5" fill={`url(#${uid}-md-shine)`} />
      <circle cx="32" cy="32" r="7.5" fill={`url(#${uid}-md-dot)`} />
      <circle cx="32" cy="32" r="7.5" fill={`url(#${uid}-md-shine)`} />
      <circle cx="48" cy="32" r="7.5" fill={`url(#${uid}-md-dot)`} />
      <circle cx="48" cy="32" r="7.5" fill={`url(#${uid}-md-shine)`} />
    </svg>
  );
}

export function SpeechToQuoteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="stq-mic" x1="24" y1="6" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>
        <linearGradient id="stq-stand" x1="28" y1="38" x2="36" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="stq-shine" x1="24" y1="6" x2="30" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Mic body capsule */}
      <rect x="22" y="6" width="20" height="34" rx="10" fill="url(#stq-mic)" />
      {/* Mic shine */}
      <rect x="22" y="6" width="20" height="18" rx="10" fill="url(#stq-shine)" />
      {/* Mic grill lines */}
      <line x1="26" y1="16" x2="38" y2="16" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      <line x1="26" y1="21" x2="38" y2="21" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      <line x1="26" y1="26" x2="38" y2="26" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      {/* Arm arc */}
      <path d="M14 28 Q14 48 32 48 Q50 48 50 28" fill="none" stroke="url(#stq-stand)" strokeWidth="3" strokeLinecap="round" />
      {/* Stand */}
      <line x1="32" y1="48" x2="32" y2="58" stroke="url(#stq-stand)" strokeWidth="3" strokeLinecap="round" />
      <line x1="22" y1="58" x2="42" y2="58" stroke="url(#stq-stand)" strokeWidth="3" strokeLinecap="round" />
      {/* Sound waves */}
      <path d="M8 22 Q6 29 8 36" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M4 18 Q1 29 4 40" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M56 22 Q58 29 56 36" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path d="M60 18 Q63 29 60 40" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

export function ScheduleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sc-header" x1="6" y1="8" x2="58" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="55%" stopColor="#4338ca" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
        <linearGradient id="sc-body" x1="6" y1="24" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8f9ff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
      {/* Calendar body */}
      <rect x="6" y="14" width="52" height="44" rx="7" fill="url(#sc-body)" />
      {/* Header bar */}
      <rect x="6" y="14" width="52" height="20" rx="7" fill="url(#sc-header)" />
      <rect x="6" y="25" width="52" height="9" fill="url(#sc-header)" />
      {/* Binding rings */}
      <rect x="18" y="8" width="6" height="14" rx="3" fill="#6366f1" />
      <rect x="40" y="8" width="6" height="14" rx="3" fill="#6366f1" />
      {/* Header text lines */}
      <rect x="16" y="19" width="20" height="3" rx="1.5" fill="white" opacity="0.8" />
      {/* Date grid — row 1 */}
      <circle cx="17" cy="42" r="4" fill="#4338ca" />
      <circle cx="17" cy="42" r="4" opacity="0.0" />
      <text x="17" y="45.5" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="bold">1</text>
      <circle cx="29" cy="42" r="4" fill="#e0e7ff" />
      <text x="29" y="45.5" textAnchor="middle" fontSize="5.5" fill="#4338ca" fontWeight="bold">2</text>
      <circle cx="41" cy="42" r="4" fill="#e0e7ff" />
      <text x="41" y="45.5" textAnchor="middle" fontSize="5.5" fill="#4338ca" fontWeight="bold">3</text>
      <circle cx="53" cy="42" r="4" fill="#e0e7ff" />
      <text x="53" y="45.5" textAnchor="middle" fontSize="5.5" fill="#4338ca" fontWeight="bold">4</text>
      {/* Date grid — row 2 */}
      <circle cx="17" cy="52" r="4" fill="#e0e7ff" />
      <text x="17" y="55.5" textAnchor="middle" fontSize="5.5" fill="#4338ca" fontWeight="bold">5</text>
      <circle cx="29" cy="52" r="4.5" fill="#f59e0b" />
      <text x="29" y="55.5" textAnchor="middle" fontSize="5.5" fill="white" fontWeight="bold">6</text>
      <circle cx="41" cy="52" r="4" fill="#e0e7ff" />
      <text x="41" y="55.5" textAnchor="middle" fontSize="5.5" fill="#4338ca" fontWeight="bold">7</text>
    </svg>
  );
}

export function CallIcon({ className }: IconProps) {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}-call-bg`} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="55%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <linearGradient id={`${uid}-call-shine`} x1="4" y1="4" x2="32" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* iOS-style rounded square background */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill={`url(#${uid}-call-bg)`} />
      {/* Shine overlay */}
      <rect x="4" y="4" width="56" height="28" rx="14" fill={`url(#${uid}-call-shine)`} />
      {/* White phone handset — classic telephone receiver path */}
      <path
        d="M20 17 C18 17 16 19 16 21 L16 26 C16 27.5 17 28.5 18.5 29 C22 30 25.5 31.5 28.5 34.5 C31.5 37.5 33 41 34 44.5 C34.5 46 35.5 47 37 47 L42 47 C44 47 46 45 46 43 L46 38 C46 36.5 45 35.5 43.5 35 C41 34.5 38.5 33.5 36.5 32"
        fill="none"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function QuoteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="qt-paper" x1="14" y1="4" x2="50" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id="qt-header" x1="14" y1="4" x2="50" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="qt-curl" x1="14" y1="50" x2="50" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      {/* Paper body */}
      <rect x="13" y="4" width="38" height="54" rx="5" fill="url(#qt-paper)" />
      {/* Header stripe */}
      <rect x="13" y="4" width="38" height="16" rx="5" fill="url(#qt-header)" />
      <rect x="13" y="14" width="38" height="6" fill="url(#qt-header)" />
      {/* Dollar sign */}
      <text x="32" y="18" textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">$</text>
      {/* Ruled lines */}
      <line x1="20" y1="28" x2="44" y2="28" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="20" y1="34" x2="44" y2="34" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="20" y1="40" x2="44" y2="40" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="20" y1="46" x2="36" y2="46" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      {/* Amount box */}
      <rect x="34" y="42" width="14" height="10" rx="2" fill="#fbbf24" opacity="0.5" />
      <text x="41" y="49.5" textAnchor="middle" fontSize="6" fill="#78350f" fontWeight="bold">850</text>
      {/* Curl at bottom */}
      <path d="M13 55 Q13 60 18 60 L46 60 Q51 60 51 55 L51 58 Q51 63 46 63 Q27 63 18 63 Q13 63 13 58 Z" fill="url(#qt-curl)" opacity="0.8" />
    </svg>
  );
}

export function InvoiceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="inv-card" x1="4" y1="14" x2="60" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="inv-chip" x1="10" y1="24" x2="26" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="inv-stripe" x1="4" y1="16" x2="60" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="inv-shine" x1="4" y1="14" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Card body */}
      <rect x="4" y="14" width="56" height="36" rx="7" fill="url(#inv-card)" />
      {/* Dark stripe */}
      <rect x="4" y="22" width="56" height="10" fill="url(#inv-stripe)" />
      {/* Chip */}
      <rect x="10" y="34" width="16" height="12" rx="3" fill="url(#inv-chip)" />
      <line x1="10" y1="39" x2="26" y2="39" stroke="#92400e" strokeWidth="0.8" opacity="0.6" />
      <line x1="10" y1="42" x2="26" y2="42" stroke="#92400e" strokeWidth="0.8" opacity="0.6" />
      <line x1="18" y1="34" x2="18" y2="46" stroke="#92400e" strokeWidth="0.8" opacity="0.6" />
      {/* Number dots */}
      <circle cx="34" cy="44" r="2" fill="white" opacity="0.5" />
      <circle cx="40" cy="44" r="2" fill="white" opacity="0.5" />
      <circle cx="46" cy="44" r="2" fill="white" opacity="0.5" />
      <circle cx="52" cy="44" r="2" fill="white" opacity="0.5" />
      {/* NFC symbol */}
      <path d="M46 35 Q50 40 46 45" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M49 32 Q55 40 49 48" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Shine */}
      <rect x="4" y="14" width="56" height="14" rx="7" fill="url(#inv-shine)" />
    </svg>
  );
}

export function ProposalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pr-board" x1="8" y1="6" x2="56" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef2f2" />
          <stop offset="100%" stopColor="#fce7f3" />
        </linearGradient>
        <linearGradient id="pr-frame" x1="8" y1="6" x2="56" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="pr-bar1" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
        <linearGradient id="pr-bar2" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <linearGradient id="pr-bar3" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#fda4af" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      {/* Easel legs */}
      <line x1="20" y1="52" x2="14" y2="62" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" />
      <line x1="44" y1="52" x2="50" y2="62" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" />
      <line x1="18" y1="58" x2="46" y2="58" stroke="#fda4af" strokeWidth="1.5" strokeLinecap="round" />
      {/* Board frame */}
      <rect x="8" y="6" width="48" height="48" rx="5" fill="url(#pr-frame)" />
      {/* Board face */}
      <rect x="11" y="10" width="42" height="41" rx="3" fill="url(#pr-board)" />
      {/* Chart grid lines */}
      <line x1="17" y1="43" x2="47" y2="43" stroke="#fda4af" strokeWidth="0.8" opacity="0.6" />
      <line x1="17" y1="37" x2="47" y2="37" stroke="#fda4af" strokeWidth="0.8" opacity="0.4" />
      <line x1="17" y1="31" x2="47" y2="31" stroke="#fda4af" strokeWidth="0.8" opacity="0.3" />
      {/* Bar 1 */}
      <rect x="18" y="33" width="7" height="10" rx="2" fill="#fb7185" />
      {/* Bar 2 */}
      <rect x="28.5" y="25" width="7" height="18" rx="2" fill="#e11d48" />
      {/* Bar 3 */}
      <rect x="39" y="30" width="7" height="13" rx="2" fill="#fda4af" />
      {/* Heading line */}
      <rect x="16" y="14" width="24" height="3" rx="1.5" fill="#fda4af" opacity="0.7" />
      {/* Top hook */}
      <rect x="29" y="4" width="6" height="8" rx="3" fill="#e11d48" />
    </svg>
  );
}

export function TimeTrackingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="tt-face" cx="45%" cy="35%" r="62%">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="100%" stopColor="#ffedd5" />
        </radialGradient>
        <linearGradient id="tt-ring" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="55%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id="tt-hand-h" x1="32" y1="32" x2="24" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id="tt-hand-m" x1="32" y1="32" x2="46" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="32" cy="34" r="26" fill="url(#tt-ring)" />
      {/* Face */}
      <circle cx="32" cy="34" r="22" fill="url(#tt-face)" />
      {/* Tick marks */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        const isMajor = i % 3 === 0;
        const inner = isMajor ? 16 : 18;
        const outer = 21;
        const x1 = 32 + Math.sin(r) * inner;
        const y1 = 34 - Math.cos(r) * inner;
        const x2 = 32 + Math.sin(r) * outer;
        const y2 = 34 - Math.cos(r) * outer;
        return (
          <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isMajor ? "#ea580c" : "#fdba74"}
            strokeWidth={isMajor ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      {/* Hour hand */}
      <line x1="32" y1="34" x2="25" y2="22" stroke="url(#tt-hand-h)" strokeWidth="3" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1="32" y1="34" x2="44" y2="18" stroke="url(#tt-hand-m)" strokeWidth="2" strokeLinecap="round" />
      {/* Center cap */}
      <circle cx="32" cy="34" r="3" fill="#ea580c" />
      <circle cx="32" cy="34" r="1.5" fill="white" />
      {/* Crown nub */}
      <rect x="29" y="6" width="6" height="5" rx="2" fill="url(#tt-ring)" />
    </svg>
  );
}

export function ProfitTrackerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pt-bg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e0f7fa" />
          <stop offset="100%" stopColor="#b2ebf2" />
        </linearGradient>
        <linearGradient id="pt-chart" x1="8" y1="50" x2="56" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#164e63" />
        </linearGradient>
        <linearGradient id="pt-fill" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Card background */}
      <rect x="4" y="8" width="56" height="48" rx="8" fill="url(#pt-bg)" />
      {/* Grid lines */}
      <line x1="12" y1="48" x2="54" y2="48" stroke="#a5f3fc" strokeWidth="1" />
      <line x1="12" y1="40" x2="54" y2="40" stroke="#a5f3fc" strokeWidth="0.8" opacity="0.7" />
      <line x1="12" y1="32" x2="54" y2="32" stroke="#a5f3fc" strokeWidth="0.8" opacity="0.5" />
      <line x1="12" y1="24" x2="54" y2="24" stroke="#a5f3fc" strokeWidth="0.8" opacity="0.3" />
      {/* Filled area under line */}
      <path d="M12 46 L22 40 L30 35 L38 28 L48 20 L54 15 L54 48 L12 48 Z" fill="url(#pt-fill)" />
      {/* Trend line */}
      <path d="M12 46 L22 40 L30 35 L38 28 L48 20 L54 15" fill="none" stroke="url(#pt-chart)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Data dots */}
      <circle cx="22" cy="40" r="3" fill="#0891b2" />
      <circle cx="30" cy="35" r="3" fill="#0891b2" />
      <circle cx="38" cy="28" r="3" fill="#0891b2" />
      <circle cx="48" cy="20" r="3" fill="#0891b2" />
      {/* Arrow head */}
      <path d="M49 11 L58 14 L54 14 L57 20" fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dollar badge */}
      <circle cx="16" cy="18" r="8" fill="#0891b2" />
      <text x="16" y="21.5" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">$</text>
    </svg>
  );
}

export function QueueJobIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="qj-bg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5f3ff" />
          <stop offset="100%" stopColor="#ede9fe" />
        </linearGradient>
        <linearGradient id="qj-num1" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="qj-num2" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id="qj-num3" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* Card */}
      <rect x="4" y="8" width="56" height="48" rx="8" fill="url(#qj-bg)" />
      {/* Row 1 */}
      <circle cx="17" cy="22" r="7" fill="url(#qj-num1)" />
      <text x="17" y="25.5" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">1</text>
      <rect x="28" y="19" width="24" height="4" rx="2" fill="#a78bfa" opacity="0.6" />
      <rect x="28" y="24" width="16" height="2.5" rx="1.25" fill="#c4b5fd" opacity="0.5" />
      {/* Row 2 */}
      <circle cx="17" cy="37" r="7" fill="url(#qj-num2)" />
      <text x="17" y="40.5" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">2</text>
      <rect x="28" y="34" width="20" height="4" rx="2" fill="#8b5cf6" opacity="0.6" />
      <rect x="28" y="39" width="28" height="2.5" rx="1.25" fill="#c4b5fd" opacity="0.5" />
      {/* Row 3 */}
      <circle cx="17" cy="52" r="7" fill="url(#qj-num3)" />
      <text x="17" y="55.5" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">3</text>
      <rect x="28" y="49" width="28" height="4" rx="2" fill="#c4b5fd" opacity="0.6" />
      <rect x="28" y="54" width="18" height="2.5" rx="1.25" fill="#ddd6fe" opacity="0.5" />
    </svg>
  );
}

export function SendToXeroIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sx-page" x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="sx-badge" x1="36" y1="36" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id="sx-fold" x1="40" y1="4" x2="56" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      {/* Page body */}
      <path d="M10 4 L44 4 L56 16 L56 58 Q56 61 53 61 L11 61 Q8 61 8 58 L8 7 Q8 4 10 4 Z" fill="url(#sx-page)" />
      {/* Fold corner */}
      <path d="M44 4 L56 16 L44 16 Z" fill="url(#sx-fold)" />
      {/* Text lines */}
      <rect x="15" y="22" width="28" height="3" rx="1.5" fill="#94a3b8" opacity="0.7" />
      <rect x="15" y="29" width="22" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.5" />
      <rect x="15" y="35" width="26" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.4" />
      <rect x="15" y="41" width="18" height="2.5" rx="1.25" fill="#94a3b8" opacity="0.35" />
      {/* Green tick badge */}
      <circle cx="46" cy="48" r="12" fill="url(#sx-badge)" />
      <path d="M40 48 L44 52 L52 44" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResendXeroIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rx-arrow" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="rx-doc" x1="22" y1="20" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      {/* Rotate arrow — full thick arc */}
      <path d="M32 10 A22 22 0 1 1 12 38" fill="none" stroke="url(#rx-arrow)" strokeWidth="8" strokeLinecap="round" />
      {/* Arrow head at start */}
      <path d="M28 4 L32 10 L36 4" fill="none" stroke="url(#rx-arrow)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Document in center */}
      <rect x="22" y="20" width="20" height="24" rx="3" fill="url(#rx-doc)" />
      <line x1="26" y1="27" x2="38" y2="27" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="26" y1="32" x2="38" y2="32" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="26" y1="37" x2="34" y2="37" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function RequestReviewIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rr-star" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="45%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>
        <radialGradient id="rr-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rr-shine" x1="18" y1="8" x2="30" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Outer glow */}
      <circle cx="32" cy="34" r="28" fill="url(#rr-glow)" />
      {/* Star shape */}
      <path d="M32 6 L37.5 22 L55 22 L41 32 L46 48 L32 38 L18 48 L23 32 L9 22 L26.5 22 Z" fill="url(#rr-star)" />
      {/* Inner star highlight */}
      <path d="M32 12 L36 24 L48 24 L38 31 L42 43 L32 36 L22 43 L26 31 L16 24 L28 24 Z" fill="url(#rr-shine)" />
      {/* Center sparkle */}
      <circle cx="32" cy="30" r="5" fill="#fef08a" opacity="0.6" />
      {/* Small sparkle dots */}
      <circle cx="50" cy="14" r="2.5" fill="#fde047" opacity="0.8" />
      <circle cx="14" cy="16" r="1.8" fill="#fde047" opacity="0.6" />
      <circle cx="56" cy="38" r="1.5" fill="#facc15" opacity="0.5" />
    </svg>
  );
}
