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
];
