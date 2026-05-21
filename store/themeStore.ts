import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIRD_STYLES, BirdStyle, ThemePalette } from '../lib/birdStyles';

const DEFAULT = BIRD_STYLES[0];

interface ThemeState {
  birdStyle: BirdStyle;
  _hasHydrated: boolean;
  setBirdStyle: (id: string) => void;
  setHasHydrated: (v: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      birdStyle: DEFAULT,
      _hasHydrated: false,
      setBirdStyle: (id: string) => {
        const style = BIRD_STYLES.find((b) => b.id === id) ?? DEFAULT;
        set({ birdStyle: style });
      },
      setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),
    }),
    {
      name: 'bird-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ birdStyleId: state.birdStyle.id }),
      merge: (persisted, current) => {
        const id = (persisted as { birdStyleId?: string }).birdStyleId;
        const style = id ? (BIRD_STYLES.find((b) => b.id === id) ?? DEFAULT) : DEFAULT;
        return { ...current, birdStyle: style };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export function useTheme(): ThemePalette {
  return useThemeStore((s) => s.birdStyle.theme);
}

export function useColors() {
  const theme = useTheme();
  return useMemo(() => ({
    primary: theme.primary,
    accent: theme.accent,
    background: theme.background,
    border: theme.border,
    gray: theme.gray,
    danger: theme.danger,

    brown: theme.primary,
    yellow: theme.accent,
    red: theme.danger,
    cream: theme.background,

    black: '#1C1C1E',
    surface: '#FFFFFF',
    textPrimary: '#1C1C1E',
    textSecondary: theme.gray,
    tabBar: '#FFFFFF',
    tabBarActive: theme.primary,
    tabBarInactive: theme.gray,
  }), [theme]);
}
