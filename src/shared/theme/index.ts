import { useColorScheme, Platform } from 'react-native';
import { usePreferences } from '@/shared/model';
export const palettes = {
  light: {
    background: '#F1F4F3',
    surface: '#FFFFFF',
    inset: '#E6EFEC',
    text: '#172D32',
    muted: '#52666C',
    border: '#CEDBD7',
    primary: '#176157',
    onPrimary: '#FFFFFF',
    hero: '#173E46',
    onHero: '#F4F8F7',
    heroMuted: '#B5CECE',
    success: '#176747',
    danger: '#B43036',
    warning: '#825600',
    focus: '#23796C',
    chartSecondary: '#547692',
  },
  dark: {
    background: '#101D22',
    surface: '#1A2D33',
    inset: '#223A40',
    text: '#EDF5F3',
    muted: '#ACBFBE',
    border: '#365058',
    primary: '#8EDCC5',
    onPrimary: '#123A32',
    hero: '#183E46',
    onHero: '#F4F8F7',
    heroMuted: '#B5CECE',
    success: '#8EDCC5',
    danger: '#FF9DA3',
    warning: '#EDCB80',
    focus: '#8EDCC5',
    chartSecondary: '#91B2DB',
  },
};
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 10, md: 18, lg: 26, pill: 999 };
export const fonts = {
  body: Platform.select({ ios: 'System', default: 'sans-serif' }),
  data: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};
export function useTheme() {
  const preference = usePreferences((s) => s.theme);
  const system = useColorScheme();
  const mode = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { colors: palettes[mode], mode };
}
