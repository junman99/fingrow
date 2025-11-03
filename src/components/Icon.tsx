import React from 'react';
import { Path, Svg } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { useThemeTokens } from '../theme/ThemeProvider';

type FeatherIconName = keyof typeof Feather.glyphMap;

const ArrowBoldLeft = ({ size = 24, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15.5 5.2L8 12l7.5 6.8V5.2Z" fill={color} />
  </Svg>
);

const ArrowBoldRight = ({ size = 24, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M8.5 5.2 16 12l-7.5 6.8V5.2Z" fill={color} />
  </Svg>
);

const PlusRounded = ({ size = 24, color }: { size?: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5c-.552 0-1 .448-1 1v5H6c-.552 0-1 .448-1 1s.448 1 1 1h5v5c0 .552.448 1 1 1s1-.448 1-1v-5h5c.552 0 1-.448 1-1s-.448-1-1-1h-5V6c0-.552-.448-1-1-1Z"
      fill={color}
    />
  </Svg>
);

export type IconName =
  | 'arrow-bold-left'
  | 'arrow-bold-right'
  | 'plus-rounded'
  | 'receipt'
  | 'plus-circle'
  | 'users-2'
  | 'target'
  | 'wallet'
  | 'history'
  | 'home'
  | 'settings'
  | 'trending-up'
  | 'trending-down'
  | 'menu'
  | 'check'
  | 'filter'
  | 'sort'
  | 'chevron-right'
  | 'chevron-left'
  | 'plus'
  | 'more-horizontal'
  | 'trash'
  | 'archive'
  | 'edit'
  | 'close'
  | 'x'
  | 'zap'
  | 'trophy'
  | 'crown'
  | 'star'
  | 'award'
  | 'check-circle'
  | 'tag'
  | 'dollar-sign'
  | 'shield'
  | 'flag'
  | 'briefcase'
  | 'book'
  | 'calendar'
  | 'lock'
  | 'gift'
  | 'rocket'
  | 'hexagon'
  | 'sun'
  | 'activity'
  | 'bar-chart-2'
  | 'heart'
  | 'coffee'
  | 'compass'
  | 'layers'
  | 'eye'
  | 'eye-off'
  | 'piggy-bank'
  | 'shield-check'
  | 'sparkles'
  | 'gem'
  | 'sunrise'
  | 'search'
  | 'alert-circle'
  | 'arrow-up'
  | 'arrow-down'
  | 'chevron-down'
  | 'chevron-up'
  | 'shopping-bag'
  | 'inbox'
  | 'download'
  | 'share'
  | 'pie-chart'
  | 'info'
  | 'moon'
  | 'globe'
  | 'camera'
  | 'smartphone'
  | 'minus'
  | 'key'
  | 'calculator'
  | 'banknote'
  | 'building-2'
  | 'credit-card'
  | 'languages'
  | 'palette'
  | 'refresh-cw'
  | 'bell'
  | 'alert-triangle'
  | 'user'
  | 'help-circle'
  | 'log-out'
  | 'database'
  | 'cpu';

type Props = {
  name: IconName;
  size?: number;
  colorToken?: string;
  color?: string;
};

const featherMap: Record<Exclude<IconName, 'arrow-bold-left' | 'arrow-bold-right' | 'plus-rounded'>, FeatherIconName> = {
  'receipt': 'file-text',
  'plus-circle': 'plus-circle',
  'users-2': 'users',
  'target': 'target',
  'wallet': 'credit-card',
  'history': 'clock',
  'home': 'home',
  'settings': 'settings',
  'trending-up': 'trending-up',
  'trending-down': 'trending-down',
  'menu': 'menu',
  'check': 'check',
  'filter': 'filter',
  'sort': 'sliders',
  'chevron-right': 'chevron-right',
  'chevron-left': 'chevron-left',
  'plus': 'plus',
  'more-horizontal': 'more-horizontal',
  'trash': 'trash-2',
  'archive': 'archive',
  'edit': 'edit-3',
  'close': 'x',
  'x': 'x',
  'zap': 'zap',
  'trophy': 'award',
  'crown': 'award',
  'star': 'star',
  'award': 'award',
  'check-circle': 'check-circle',
  'tag': 'tag',
  'dollar-sign': 'dollar-sign',
  'shield': 'shield',
  'flag': 'flag',
  'briefcase': 'briefcase',
  'book': 'book',
  'calendar': 'calendar',
  'lock': 'lock',
  'gift': 'gift',
  'rocket': 'send',
  'hexagon': 'hexagon',
  'sun': 'sun',
  'activity': 'activity',
  'bar-chart-2': 'bar-chart-2',
  'heart': 'heart',
  'coffee': 'coffee',
  'compass': 'compass',
  'layers': 'layers',
  'eye': 'eye',
  'eye-off': 'eye-off',
  'piggy-bank': 'save',
  'shield-check': 'shield',
  'sparkles': 'star',
  'gem': 'hexagon',
  'sunrise': 'sunrise',
  'search': 'search',
  'alert-circle': 'alert-circle',
  'arrow-up': 'arrow-up',
  'arrow-down': 'arrow-down',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  'shopping-bag': 'shopping-bag',
  'inbox': 'inbox',
  'download': 'download',
  'share': 'share-2',
  'pie-chart': 'pie-chart',
  'info': 'info',
  'moon': 'moon',
  'globe': 'globe',
  'camera': 'camera',
  'smartphone': 'smartphone',
  'minus': 'minus',
  'key': 'key',
  'calculator': 'grid',
  'banknote': 'dollar-sign',
  'building-2': 'home',
  'credit-card': 'credit-card',
  'languages': 'globe',
  'palette': 'droplet',
  'refresh-cw': 'refresh-cw',
  'bell': 'bell',
  'alert-triangle': 'alert-triangle',
  'user': 'user',
  'help-circle': 'help-circle',
  'log-out': 'log-out',
  'database': 'database',
  'cpu': 'cpu',
};

const Icon: React.FC<Props> = ({ name, size = 24, colorToken = 'icon.default', color: colorProp }) => {
  const { get } = useThemeTokens();
  const color = colorProp || (get(colorToken) as string);

  if (name === 'arrow-bold-left') {
    return <ArrowBoldLeft size={size} color={color} />;
  }
  if (name === 'arrow-bold-right') {
    return <ArrowBoldRight size={size} color={color} />;
  }
  if (name === 'plus-rounded') {
    return <PlusRounded size={size} color={color} />;
  }

  const iconName = featherMap[name];
  return <Feather name={iconName} size={size} color={color} />;
};

export default Icon;
