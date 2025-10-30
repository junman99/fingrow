import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, LayoutChangeEvent, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type Point = { t: number; v: number };

type Props = {
  actualData: Point[];
  projectedValue: number;
  projectedTime: number;
  budget: number;
  height?: number;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function formatCurrency(value: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `S$${value.toFixed(0)}`;
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProjectionChart({ actualData, projectedValue, projectedTime, budget, height = 180 }: Props) {
  const { get, isDark } = useThemeTokens();
  const [containerWidth, setContainerWidth] = useState(340);
  const [tooltipData, setTooltipData] = useState<{ x: number; y: number; value: number; date: string } | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pathLengthAnim = useRef(new Animated.Value(0)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    pathLengthAnim.setValue(0);

    Animated.sequence([
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(pathLengthAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    ]).start();
  }, [actualData]);

  const accentPrimary = get('accent.primary') as string;
  const dangerColor = get('semantic.danger') as string;
  const warningColor = get('semantic.warning') as string;
  const textMuted = get('text.muted') as string;

  if (actualData.length === 0) return null;

  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const chartWidth = containerWidth - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  // Calculate bounds
  const allValues = [...actualData.map(p => p.v), projectedValue, budget];
  const minValue = 0;
  const maxValue = Math.max(...allValues, budget * 1.1);

  const minTime = actualData[0].t;
  const maxTime = projectedTime;

  // Scale functions
  const scaleX = (t: number) => {
    return padding.left + ((t - minTime) / (maxTime - minTime)) * chartWidth;
  };

  const scaleY = (v: number) => {
    return padding.top + chartHeight - ((v - minValue) / (maxValue - minValue)) * chartHeight;
  };

  // Build actual line path
  let actualPath = '';
  actualData.forEach((point, i) => {
    const x = scaleX(point.t);
    const y = scaleY(point.v);
    if (i === 0) {
      actualPath += `M ${x} ${y}`;
    } else {
      actualPath += ` L ${x} ${y}`;
    }
  });

  // Build projection line path (dotted)
  const lastActual = actualData[actualData.length - 1];
  const projX = scaleX(projectedTime);
  const projY = scaleY(projectedValue);
  const lastX = scaleX(lastActual.t);
  const lastY = scaleY(lastActual.v);

  // Budget line
  const budgetY = scaleY(budget);
  const budgetPath = `M ${padding.left} ${budgetY} L ${padding.left + chartWidth} ${budgetY}`;

  // Area fill path
  let areaPath = actualPath;
  if (actualData.length > 0) {
    const lastPoint = actualData[actualData.length - 1];
    areaPath += ` L ${scaleX(lastPoint.t)} ${padding.top + chartHeight}`;
    areaPath += ` L ${scaleX(actualData[0].t)} ${padding.top + chartHeight}`;
    areaPath += ' Z';
  }

  // Determine color based on projection
  const projectionColor = projectedValue > budget ? dangerColor : projectedValue > budget * 0.9 ? warningColor : accentPrimary;

  // Animated stroke dashoffset for drawing effect
  const animatedStrokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1000, 0],
  });

  const projectionLineOpacity = pathLengthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.9],
  });

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateTooltip = (x: number) => {
    if (!x || actualData.length === 0) return;

    // Find closest data point
    let closestPoint = actualData[0];
    let minDistance = Math.abs(scaleX(actualData[0].t) - x);

    actualData.forEach(point => {
      const pointX = scaleX(point.t);
      const distance = Math.abs(pointX - x);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    const tooltipX = scaleX(closestPoint.t);
    const tooltipY = scaleY(closestPoint.v);

    setTooltipData({
      x: tooltipX,
      y: tooltipY,
      value: closestPoint.v,
      date: formatDate(closestPoint.t)
    });

    // Show tooltip if not visible
    if (!tooltipData) {
      Animated.timing(tooltipOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleTouchStart = (e: any) => {
    try {
      // Clear any existing hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      const x = e.nativeEvent.locationX;
      updateTooltip(x);
    } catch (error) {
      console.log('Touch start error:', error);
    }
  };

  const handleTouchMove = (e: any) => {
    try {
      // Clear any existing hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      const x = e.nativeEvent.locationX;
      updateTooltip(x);
    } catch (error) {
      console.log('Touch move error:', error);
    }
  };

  const handleTouchEnd = () => {
    try {
      // Auto hide after 2 seconds
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setTooltipData(null));
      }, 2000);
    } catch (error) {
      console.log('Touch end error:', error);
    }
  };

  const textPrimary = get('text.primary') as string;
  const surface2 = get('surface.level2') as string;

  return (
    <View style={{ width: '100%', height }} onLayout={onLayout}>
      <View
        style={{ width: '100%', height }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Svg width={containerWidth} height={height}>
        <Defs>
          <SvgGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accentPrimary} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={accentPrimary} stopOpacity="0.02" />
          </SvgGradient>
        </Defs>

        {/* Budget line */}
        <Line
          x1={padding.left}
          y1={budgetY}
          x2={padding.left + chartWidth}
          y2={budgetY}
          stroke={textMuted}
          strokeWidth="1.5"
          strokeDasharray="5,5"
          opacity={0.4}
        />

        {/* Budget line label */}
        <SvgText
          x={padding.left + chartWidth - 5}
          y={budgetY - 6}
          fill={textMuted}
          fontSize="11"
          fontWeight="600"
          textAnchor="end"
          opacity={0.7}
        >
          {formatCurrency(budget)}
        </SvgText>

        {/* Area fill */}
        <AnimatedPath
          d={areaPath}
          fill="url(#areaGradient)"
          opacity={progressAnim}
        />

        {/* Actual spending line */}
        <AnimatedPath
          d={actualPath}
          stroke={accentPrimary}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1000"
          strokeDashoffset={animatedStrokeDashoffset}
        />

        {/* Projection line (dotted) - animated */}
        <AnimatedLine
          x1={lastX}
          y1={lastY}
          x2={projX}
          y2={projY}
          stroke={projectionColor}
          strokeWidth="2.5"
          strokeDasharray="8,8"
          opacity={projectionLineOpacity}
        />

        {/* Current position dot - animated */}
        <AnimatedCircle
          cx={lastX}
          cy={lastY}
          r={progressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 6],
          })}
          fill={accentPrimary}
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        {/* Projection end dot - animated */}
        <AnimatedCircle
          cx={projX}
          cy={projY}
          r={pathLengthAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 6],
          })}
          fill={projectionColor}
          stroke="#ffffff"
          strokeWidth="2.5"
          opacity={0.9}
        />
      </Svg>

        {/* Tooltip */}
        {tooltipData && (
          <Animated.View
            style={{
              position: 'absolute',
              left: tooltipData.x - 40,
              top: Math.max(10, tooltipData.y - 60),
              opacity: tooltipOpacity,
              backgroundColor: surface2,
              padding: spacing.s10,
              borderRadius: radius.md,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 5,
              borderWidth: 2,
              borderColor: accentPrimary,
              minWidth: 80,
            }}
          >
            <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '800', textAlign: 'center' }}>
              {formatCurrency(tooltipData.value)}
            </Text>
            <Text style={{ color: textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
              {tooltipData.date}
            </Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
