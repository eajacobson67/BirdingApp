export interface ThemePalette {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  border: string;
  gray: string;
  danger: string;
}

export interface BirdStyle {
  id: string;
  label: string;
  body: string;   // fallback fill when PNG is unavailable
  theme: ThemePalette;
}

// Change this one line to switch the default bird across the whole app.
export const DEFAULT_BIRD_ID = 'robin';

export const BIRD_STYLES: BirdStyle[] = [
  {
    id: 'waxwing',
    label: 'Cedar Waxwing',
    body: '#A4714A',
    theme: {
      primary: '#A4714A', accent: '#E03943', background: '#F5EEE3',
      surface: '#FFFFFF', border: '#E8DCC2', gray: '#8D9297', danger: '#1F1F1F',
    },
  },
  {
    id: 'cardinal',
    label: 'Northern Cardinal',
    body: '#C41E3A',
    theme: {
      primary: '#C41E3A', accent: '#F49A2A', background: '#FEF0F2',
      surface: '#FFFFFF', border: '#F2C5CC', gray: '#B7ADA1', danger: '#8C1D18',
    },
  },
  {
    id: 'robin',
    label: 'American Robin',
    body: '#3B4A5A',
    theme: {
      primary: '#C96A3D', accent: '#5A5652', background: '#E9DDC8',
      surface: '#FFFFFF', border: '#E9DDC8', gray: '#7F8C8D', danger: '#C0392B',
    },
  },
  {
    id: 'hummingbird',
    label: 'Ruby-Throat Hummingbird',
    body: '#2F7A63',
    theme: {
      primary: '#2F7A63', accent: '#C1273D', background: '#EAF4EE',
      surface: '#FFFFFF', border: '#BDD9CC', gray: '#7BA89A', danger: '#C1273D',
    },
  },
  {
    id: 'paintedbunting',
    label: 'Painted Bunting',
    body: '#4E8B47',
    theme: {
      primary: '#4E8B47', accent: '#2D5DA8', background: '#EDF5EC',
      surface: '#FFFFFF', border: '#B8D9B4', gray: '#7BA88A', danger: '#D94A3A',
    },
  },
  {
    id: 'housesparrow',
    label: 'House Sparrow',
    body: '#B79A7B',
    theme: {
      primary: '#8A5A3B', accent: '#6C7173', background: '#F0E9DF',
      surface: '#FFFFFF', border: '#DED0BC', gray: '#9E9089', danger: '#8C3A2A',
    },
  },
  {
    id: 'scissortailedflycatcher',
    label: 'Scissor-tailed Flycatcher',
    body: '#4B6E8A',
    theme: {
      primary: '#4B6E8A', accent: '#D98A6F', background: '#EFF3F6',
      surface: '#FFFFFF', border: '#BCC8D2', gray: '#8A9299', danger: '#2D3035',
    },
  },
  {
    id: 'bluejay',
    label: 'Blue Jay',
    body: '#3A7BD5',
    theme: {
      primary: '#3A7BD5', accent: '#1A5BAF', background: '#EEF4FC',
      surface: '#FFFFFF', border: '#AECBEE', gray: '#8A8FA0', danger: '#1A2A4A',
    },
  },
  {
    id: 'goldfinch',
    label: 'American Goldfinch',
    body: '#C4A200',
    theme: {
      primary: '#C4A200', accent: '#1A1A1A', background: '#FDFBE6',
      surface: '#FFFFFF', border: '#B09800', gray: '#9A8C60', danger: '#7A5800',
    },
  },
  {
    id: 'blackcappedchickadee',
    label: 'Black-capped Chickadee',
    body: '#1A2235',
    theme: {
      primary: '#1A2235', accent: '#C4902A', background: '#F0F1F5',
      surface: '#FFFFFF', border: '#B0BAC8', gray: '#8A9BAA', danger: '#0E1528',
    },
  },
];

const EXTRA_ALIASES: Record<string, string> = {
  'ruby-throated hummingbird': 'hummingbird',
  'ruby throated hummingbird': 'hummingbird',
};

export function getBirdIdForSpecies(commonName: string): string | null {
  const key = commonName.toLowerCase();
  for (const b of BIRD_STYLES) {
    if (b.label.toLowerCase() === key) return b.id;
  }
  return EXTRA_ALIASES[key] ?? null;
}
