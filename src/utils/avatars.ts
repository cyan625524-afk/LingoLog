// Retro Minimalist Telegraph & Typewriter Vector Avatars

export interface AvatarPreset {
  id: string;
  name: string;
  description: string;
  dataUrl: string;
}

// 1. 首席发报员 (Telegraph Operator with Headset & Morse Signals)
const svgOperator = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="12" fill="#243427"/>
  <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-dasharray="4 2"/>
  <!-- Headset band -->
  <path d="M 28 48 A 22 22 0 0 1 72 48" fill="none" stroke="#d49e3d" stroke-width="4.5" stroke-linecap="round"/>
  <!-- Headset ear cups -->
  <rect x="22" y="44" width="7" height="15" rx="3" fill="#d49e3d"/>
  <rect x="71" y="44" width="7" height="15" rx="3" fill="#d49e3d"/>
  <!-- Operator Head Silhouette -->
  <circle cx="50" cy="45" r="15" fill="#f4edd3"/>
  <!-- Glasses / Eyes band -->
  <rect x="40" y="41" width="20" height="4" rx="2" fill="#243427"/>
  <!-- Shoulders & Coat -->
  <path d="M 26 84 C 28 66 38 63 50 63 C 62 63 72 66 74 84 Z" fill="#f4edd3"/>
  <!-- Tie / Collar in brass -->
  <path d="M 46 64 L 54 64 L 52 74 L 50 78 L 48 74 Z" fill="#d49e3d"/>
  <!-- Radio signal dots on sides -->
  <circle cx="16" cy="22" r="2" fill="#d49e3d"/>
  <circle cx="23" cy="18" r="2.5" fill="#d49e3d"/>
  <circle cx="84" cy="22" r="2" fill="#d49e3d"/>
  <circle cx="77" cy="18" r="2.5" fill="#d49e3d"/>
</svg>
`.trim();

// 2. 黄铜发报电键 (Morse Telegraph Straight Key)
const svgMorseKey = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="12" fill="#243427"/>
  <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-dasharray="4 2"/>
  <!-- Wooden Base -->
  <rect x="16" y="68" width="68" height="12" rx="3" fill="#141e16" stroke="#d49e3d" stroke-width="1.5"/>
  <!-- Pivot Block -->
  <rect x="42" y="52" width="16" height="16" rx="2" fill="#d49e3d"/>
  <!-- Spring screw -->
  <rect x="47" y="44" width="6" height="8" fill="#f4edd3"/>
  <!-- Lever arm -->
  <path d="M 22 56 L 68 46 L 72 47 L 22 58 Z" fill="#d49e3d"/>
  <!-- Knob -->
  <ellipse cx="22" cy="54" rx="8" ry="4" fill="#f4edd3"/>
  <rect x="20" y="55" width="4" height="6" fill="#141e16"/>
  <!-- Contact Spark / Telegraph Dot-Dash -->
  <circle cx="68" cy="62" r="3" fill="#f4edd3"/>
  <line x1="74" y1="62" x2="82" y2="62" stroke="#f4edd3" stroke-width="3" stroke-linecap="round"/>
</svg>
`.trim();

// 3. 机械打字机 (Mechanical Typewriter & Cable)
const svgTypewriter = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="12" fill="#243427"/>
  <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-dasharray="4 2"/>
  <!-- Paper Roller / Carriage -->
  <rect x="24" y="32" width="52" height="10" rx="4" fill="#141e16"/>
  <circle cx="21" cy="37" r="4" fill="#d49e3d"/>
  <circle cx="79" cy="37" r="4" fill="#d49e3d"/>
  <!-- Paper Sheet sticking up -->
  <rect x="32" y="16" width="36" height="20" rx="1" fill="#f4edd3"/>
  <line x1="38" y1="22" x2="62" y2="22" stroke="#243427" stroke-width="2" stroke-linecap="round"/>
  <line x1="38" y1="27" x2="56" y2="27" stroke="#243427" stroke-width="2" stroke-linecap="round"/>
  <!-- Typewriter Main Body -->
  <path d="M 20 42 L 80 42 L 85 76 L 15 76 Z" fill="#1c2b1f" stroke="#d49e3d" stroke-width="2"/>
  <!-- Keyboard area -->
  <rect x="26" y="58" width="48" height="14" rx="2" fill="#141e16"/>
  <!-- Round keys in rows -->
  <circle cx="32" cy="63" r="2" fill="#d49e3d"/>
  <circle cx="41" cy="63" r="2" fill="#d49e3d"/>
  <circle cx="50" cy="63" r="2" fill="#d49e3d"/>
  <circle cx="59" cy="63" r="2" fill="#d49e3d"/>
  <circle cx="68" cy="63" r="2" fill="#d49e3d"/>
  <circle cx="36" cy="68" r="2" fill="#f4edd3"/>
  <circle cx="45" cy="68" r="2" fill="#f4edd3"/>
  <circle cx="54" cy="68" r="2" fill="#f4edd3"/>
  <circle cx="63" cy="68" r="2" fill="#f4edd3"/>
</svg>
`.trim();

// 4. 信鸽特派员 (Carrier Pigeon Dispatcher)
const svgPigeon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="12" fill="#243427"/>
  <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-dasharray="4 2"/>
  <!-- Pigeon Body -->
  <path d="M 22 55 C 24 40 38 34 52 38 C 58 32 68 28 75 32 C 80 35 84 42 78 48 C 72 54 66 56 60 58 C 50 68 34 72 24 66 Z" fill="#f4edd3"/>
  <!-- Wing -->
  <path d="M 40 45 C 52 40 64 45 68 56 C 60 62 48 64 36 56 Z" fill="#d49e3d"/>
  <!-- Eye -->
  <circle cx="74" cy="36" r="2" fill="#243427"/>
  <!-- Beak -->
  <polygon points="78,38 86,41 78,44" fill="#d49e3d"/>
  <!-- Brass Message Capsule held in leg/beak -->
  <rect x="48" y="66" width="18" height="6" rx="3" transform="rotate(-15 48 66)" fill="#d49e3d" stroke="#141e16" stroke-width="1"/>
  <!-- Speed lines -->
  <line x1="18" y1="42" x2="26" y2="42" stroke="#d49e3d" stroke-width="2" stroke-linecap="round"/>
  <line x1="14" y1="49" x2="22" y2="49" stroke="#d49e3d" stroke-width="2" stroke-linecap="round"/>
</svg>
`.trim();

// 5. 无线电长波塔 (Radio Broadcast Lattice Tower)
const svgRadioTower = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="12" fill="#243427"/>
  <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-dasharray="4 2"/>
  <!-- Central Tower Legs -->
  <line x1="50" y1="28" x2="28" y2="82" stroke="#f4edd3" stroke-width="3" stroke-linecap="round"/>
  <line x1="50" y1="28" x2="72" y2="82" stroke="#f4edd3" stroke-width="3" stroke-linecap="round"/>
  <!-- Tower Cross Struts -->
  <line x1="43" y1="45" x2="57" y2="45" stroke="#d49e3d" stroke-width="2"/>
  <line x1="37" y1="60" x2="63" y2="60" stroke="#d49e3d" stroke-width="2"/>
  <line x1="31" y1="74" x2="69" y2="74" stroke="#d49e3d" stroke-width="2"/>
  <!-- Braces X -->
  <line x1="43" y1="45" x2="63" y2="60" stroke="#d49e3d" stroke-width="1.5"/>
  <line x1="57" y1="45" x2="37" y2="60" stroke="#d49e3d" stroke-width="1.5"/>
  <!-- Top Beacon Spire -->
  <line x1="50" y1="16" x2="50" y2="28" stroke="#d49e3d" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="50" cy="15" r="4" fill="#f4edd3"/>
  <!-- Concentric Broadcast Waves -->
  <path d="M 38 15 A 12 12 0 0 1 62 15" fill="none" stroke="#d49e3d" stroke-width="2" stroke-linecap="round"/>
  <path d="M 30 15 A 20 20 0 0 1 70 15" fill="none" stroke="#d49e3d" stroke-width="2" stroke-linecap="round"/>
</svg>
`.trim();

// 6. 值机深夜咖啡 (Midnight Shift Enamel Mug)
const svgCoffee = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="12" fill="#243427"/>
  <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-dasharray="4 2"/>
  <!-- Mug Body -->
  <rect x="28" y="44" width="38" height="34" rx="4" fill="#f4edd3" stroke="#d49e3d" stroke-width="2"/>
  <!-- Enamel Rim -->
  <rect x="26" y="41" width="42" height="5" rx="2.5" fill="#d49e3d"/>
  <!-- Handle -->
  <path d="M 66 48 C 77 48 77 68 66 70" fill="none" stroke="#f4edd3" stroke-width="4.5" stroke-linecap="round"/>
  <!-- Telegram stamp icon on mug -->
  <circle cx="47" cy="61" r="7" fill="#243427"/>
  <polygon points="45,57 51,61 45,65" fill="#d49e3d"/>
  <!-- Steam curls -->
  <path d="M 38 35 Q 35 27 40 20" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 47 34 Q 52 25 46 17" fill="none" stroke="#f4edd3" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 56 35 Q 53 27 58 20" fill="none" stroke="#d49e3d" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`.trim();

function toDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'operator',
    name: '首席发报员',
    description: '头戴式电讯耳机与收发波频',
    dataUrl: toDataUrl(svgOperator),
  },
  {
    id: 'morse-key',
    name: '黄铜发报键',
    description: '经典直键式莫尔斯发报电键',
    dataUrl: toDataUrl(svgMorseKey),
  },
  {
    id: 'typewriter',
    name: '机械打字机',
    description: '老式机械打字机与电文纸卷',
    dataUrl: toDataUrl(svgTypewriter),
  },
  {
    id: 'carrier-pigeon',
    name: '信鸽特派员',
    description: '携带密电铜管的飞翔信鸽',
    dataUrl: toDataUrl(svgPigeon),
  },
  {
    id: 'radio-tower',
    name: '长波电讯塔',
    description: '装饰艺术风长波发射铁塔',
    dataUrl: toDataUrl(svgRadioTower),
  },
  {
    id: 'night-coffee',
    name: '值机夜班咖啡',
    description: '深夜值机守候的经典搪瓷杯',
    dataUrl: toDataUrl(svgCoffee),
  },
];

export const DEFAULT_AVATAR = AVATAR_PRESETS[0].dataUrl;

export function isLegacyOrInvalidAvatar(avatarUrl?: string): boolean {
  if (!avatarUrl) return true;
  if (avatarUrl.includes('images.unsplash.com')) return true;
  if (avatarUrl.includes('api.dicebear.com')) return true;
  return false;
}
