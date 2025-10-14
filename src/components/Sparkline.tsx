import React from 'react';
import { View } from 'react-native';
import { Svg, Polyline } from 'react-native-svg';

type Props = { data: number[]; color?: string; height?: number };

export const Sparkline: React.FC<Props> = ({ data, color = '#4F46E5', height = 28 }) => {
  const w = Math.max(48, (data.length - 1) * 8 + 16);
  if (!data || data.length === 0) return <View style={{ height }} />;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = 8 + i * ((w - 16) / Math.max(1, data.length - 1));
    const y = 4 + (1 - (v - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={{ width: '100%', height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

export default Sparkline;

