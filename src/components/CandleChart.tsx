import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, G } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';

type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };

type Props = {
  data: Bar[];
  height?: number;
  padding?: { left?: number; right?: number; bottom?: number; top?: number };
  barWidth?: number; // pixels
};

export default function CandleChart({ data, height = 200, padding, barWidth = 6 }: Props) {
  const { get } = useThemeTokens();
  const pad = { left: 32, right: 35, bottom: 17, top: 8, ...(padding || {}) };
  const w = 340;
  const h = height;

  const lows = data.map(d => d.l);
  const highs = data.map(d => d.h);
  const min = lows.length ? Math.min(...lows) : 0;
  const max = highs.length ? Math.max(...highs) : 1;
  const range = Math.max(1e-6, max - min);

  const tmin = data[0]?.t ?? 0;
  const tmax = data[data.length-1]?.t ?? 1;
  const trange = Math.max(1, tmax - tmin);

  const grid = get('border.subtle') as string;
  const up = get('semantic.success') as string;
  const down = get('semantic.danger') as string;

  const glines = [0.25, 0.5, 0.75].map(fr => ({
    x1: pad.left, x2: w - pad.right,
    y: h - pad.bottom - fr * (h - pad.top - pad.bottom),
  }));

  const xFor = (t: number) => pad.left + ((t - tmin) / trange) * (w - pad.left - pad.right);
  const yFor = (v: number) => h - pad.bottom - ((v - min) / range) * (h - pad.top - pad.bottom);

  return (
    <View>
      <Svg width="100%" height={h}>
        <G>
          {glines.map((g, i) => (
            <Line key={i} x1={g.x1} x2={g.x2} y1={g.y} y2={g.y} stroke={grid} strokeWidth={1} />
          ))}
          {data.map((b, idx) => {
            const x = xFor(b.t);
            const yc = yFor(b.c);
            const yo = yFor(b.o);
            const yh = yFor(b.h);
            const yl = yFor(b.l);
            const color = b.c >= b.o ? up : down;
            const x0 = x - barWidth/2;
            const yTop = Math.min(yo, yc);
            const bodyH = Math.max(1, Math.abs(yo - yc));
            return (
              <G key={idx}>
                {/* Wick */}
                <Line x1={x} x2={x} y1={yh} y2={yl} stroke={color} strokeWidth={1} />
                {/* Body */}
                <Rect x={x0} y={yTop} width={barWidth} height={bodyH} fill={color} />
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}