export type EasterEggId =
  | 'logo-taps'
  | 'nav-avatar-taps'
  | 'konami-companion'
  | 'arena-title'
  | 'theme-spinner'
  | 'version-tap';

export const EASTER_EGGS: Array<{ id: EasterEggId; title: string }> = [
  { id: 'logo-taps', title: 'Logo Tapper' },
  { id: 'nav-avatar-taps', title: 'Secret Avatar' },
  { id: 'konami-companion', title: 'Konami Coach' },
  { id: 'arena-title', title: 'Arena Whisper' },
  { id: 'theme-spinner', title: 'Theme Spinner' },
  { id: 'version-tap', title: 'Version Vault' },
];

export const EASTER_EGGS_TOTAL = EASTER_EGGS.length;

export const normalizeEasterEggIds = (value: unknown): EasterEggId[] => {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(EASTER_EGGS.map((egg) => egg.id));
  return value.filter((id): id is EasterEggId => typeof id === 'string' && allowed.has(id as EasterEggId));
};

