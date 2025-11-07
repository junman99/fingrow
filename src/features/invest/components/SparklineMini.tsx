import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useThemeTokens } from '../../theme/ThemeProvider';

type Props = {
  data?: Array<number> | Array<{ v: number }> | Array<{ t: number; v: number }>;
  width?: number;
  height?: number;
  gradient?: boolean;
  positive?: boolean | null; // null = neutral
};

export default function SparklineMini({ data, width = 76, height = 24, gradient = false, positive = null }: Props) {
  const { get } = useThemeTokens();
  const accent = get('accent.primary') as string;
  const danger = get('semantic.danger') as string;
  const grid = get('border.subtle') as string;

  const vals = (data || []).map(d => (typeof d === 'number' ? d : (d as any).v)).filter(v => typeof v === 'number');
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  const range = Math.max(1e-6, max - min);

  const xFor = (i: number) => (i / Math.max(1, vals.length - 1)) * width;
  const yFor = (v: number) => height - ((v - min) / range) * height;

  const pathD = React.useMemo(() => {
    if (!vals.length) return '';
    let d = `M ${xFor(0)} ${yFor(vals[0])}`;
    for (let i = 1; i < vals.length; i++) d += ` L ${xFor(i)} ${yFor(vals[i])}`;
    return d;
  }, [width, height, min, max, vals.length]);

  const lineColor = positive === null ? grid : (positive ? accent : danger);

  const areaD = React.useMemo(() => {
    if (!vals.length) return '';
    let d = `M ${xFor(0)} ${height}`;
    d += ` L ${xFor(0)} ${yFor(vals[0])}`;
    for (let i = 1; i < vals.length; i++) d += ` L ${xFor(i)} ${yFor(vals[i])}`;
    d += ` L ${xFor(vals.length - 1)} ${height} Z`;
    return d;
  }, [width, height, min, max, vals.length]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="smGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity={0.22} />
            <Stop offset="1" stopColor={lineColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {gradient && areaD ? <Path d={areaD} fill="url(#smGrad)" /> : null}
        {pathD ? <Path d={pathD} stroke={lineColor} strokeWidth={1.5} fill="none" /> : null}
      </Svg>
    </View>
  );
}