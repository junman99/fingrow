import React from 'react';
import { useThemeTokens } from '../theme/ThemeProvider';
import { Feather } from '@expo/vector-icons';

export type IconName =
  | 'plus-circle'
  | 'users-2'
  | 'target'
  | 'wallet'
  | 'history'
  | 'home'
  | 'settings'
  | 'trending-up';

const map: Record<IconName, keyof typeof Feather.glyphMap> = {
  'plus-circle': 'plus-circle',
  'users-2': 'users',
  'target': 'target',
  'wallet': 'credit-card',
  'history': 'clock',
  'home': 'home',
  'settings': 'settings',
  'trending-up': 'trending-up',
};

type Props = {
  name: IconName;
  size?: number;
  colorToken?: string;
};

const Icon: React.FC<Props> = ({ name, size = 24, colorToken = 'icon.default' }) => {
  const { get } = useThemeTokens();
  const iconName = map[name];
  const color = get(colorToken) as string;
  return <Feather name={iconName} size={size} color={color} />;
};

export default Icon;
