import React from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet from '../../../components/BottomSheet';
import { useThemeTokens } from '../../../theme/ThemeProvider';
import { spacing, radius } from '../../../theme/tokens';
import LineChart from '../../../components/LineChart';
import Icon from '../../../components/Icon';
import { useInvestStore } from '../store';
import { useProfileStore } from '../../../store/profile';

type IndexData = {
  symbol: string;
  name: string;
  currentValue: number;
  dayChange: number;
  dayChangePct: number;
  ytdChange: number;
  ytdChangePct: number;
};

type Props = {
  index: IndexData | null;
  visible: boolean;
  onClose: () => void;
};

// Generate sample historical data for the chart
function generateSampleData(currentValue: number, days: number = 90) {
  const data: Array<{ t: number; v: number }> = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = days; i >= 0; i--) {
    const variance = (Math.random() - 0.5) * (currentValue * 0.02); // ±2% daily variance
    const value = currentValue + variance * (i / days); // Trending toward current
    data.push({
      t: now - (i * dayMs),
      v: Math.max(value, currentValue * 0.8), // Keep within reasonable bounds
    });
  }

  return data;
}

// Index descriptions (use Yahoo Finance ticker format with ^ prefix)
const INDEX_INFO: Record<string, { description: string; components: string; methodology: string }> = {
  '^GSPC': {
    description: 'The S&P 500 is a stock market index tracking the performance of 500 large companies listed on stock exchanges in the United States.',
    components: '500 of the largest U.S. publicly traded companies',
    methodology: 'Market-capitalization-weighted index',
  },
  '^DJI': {
    description: 'The Dow Jones Industrial Average is a price-weighted index of 30 prominent companies traded on the NYSE and NASDAQ.',
    components: '30 large publicly owned U.S. companies',
    methodology: 'Price-weighted index',
  },
  '^IXIC': {
    description: 'The NASDAQ Composite includes more than 3,000 stocks listed on the NASDAQ exchange, heavily weighted toward technology companies.',
    components: '3,000+ stocks listed on NASDAQ',
    methodology: 'Market-capitalization-weighted index',
  },
  '^FTSE': {
    description: 'The FTSE 100 Index is a share index of the 100 companies listed on the London Stock Exchange with the highest market capitalization.',
    components: '100 largest companies on the LSE',
    methodology: 'Market-capitalization-weighted index',
  },
  '^GDAXI': {
    description: 'The DAX is a stock market index consisting of the 40 major German blue chip companies trading on the Frankfurt Stock Exchange.',
    components: '40 major German blue chip companies',
    methodology: 'Free-float market-capitalization-weighted index',
  },
  '^N225': {
    description: 'The Nikkei 225 is a stock market index for the Tokyo Stock Exchange, comprising 225 large, publicly-owned companies in Japan.',
    components: '225 large publicly-owned Japanese companies',
    methodology: 'Price-weighted index',
  },
  '^HSI': {
    description: 'The Hang Seng Index is a freefloat-adjusted market-capitalization-weighted stock market index of the largest companies on the Hong Kong Stock Exchange.',
    components: 'Largest companies on the Hong Kong Stock Exchange',
    methodology: 'Free-float market-capitalization-weighted index',
  },
  '^STI': {
    description: 'The Straits Times Index tracks the performance of the top 30 companies listed on the Singapore Exchange.',
    components: 'Top 30 companies on the Singapore Exchange',
    methodology: 'Market-capitalization-weighted index',
  },
};

export default function IndexDetailSheet({ index, visible, onClose }: Props) {
  console.log('📊 [IndexDetailSheet] Rendering. visible:', visible, 'index:', index?.symbol || null);

  const { get, isDark } = useThemeTokens();

  // Always call hooks before any early returns
  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const surface0 = get('surface.level0') as string;
  const surface1 = get('surface.level1') as string;
  const borderSubtle = get('border.subtle') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;
  const accentPrimary = get('accent.primary') as string;

  const [timeframe, setTimeframe] = React.useState<'1D'|'5D'|'1M'|'3M'|'6M'|'YTD'|'1Y'|'ALL'>('6M');

  const { quotes, refreshQuotes } = useInvestStore();
  const { profile } = useProfileStore();

  React.useEffect(() => {
    if (visible && index?.symbol) {
      // Refresh data in background (non-blocking)
      console.log('📊 [IndexDetailSheet] Background refresh for:', index.symbol);
      refreshQuotes([index.symbol]).catch((e) => {
        console.error('📊 [IndexDetailSheet] Background refresh failed:', e);
      });
    }
  }, [visible, index?.symbol]);

  const chartData = React.useMemo(() => {
    if (!index) return [];

    // Get quote from store
    const quote = quotes[index.symbol];

    // Use real data if available
    if (quote && quote.bars && quote.bars.length > 0) {
      const daysMap = { '1D': 1, '5D': 5, '1M': 30, '3M': 90, '6M': 180, 'YTD': 180, '1Y': 365, 'ALL': 9999 };
      const days = daysMap[timeframe];
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      const filtered = quote.bars
        .filter(b => {
          // Handle both timestamp formats (milliseconds and seconds)
          const timestamp = b.t > 10000000000 ? b.t : b.t * 1000;
          return timestamp >= cutoff;
        })
        .map(b => {
          // Handle both timestamp formats
          const timestamp = b.t > 10000000000 ? b.t : b.t * 1000;
          // bars from store have 'c' property (close price)
          const value = b.c || 0;
          return { t: timestamp, v: value };
        })
        .sort((a, b) => a.t - b.t);

      if (filtered.length > 0) {
        return filtered;
      }
    }

    // Fallback to sample data
    const daysMap = { '1D': 1, '5D': 5, '1M': 30, '3M': 90, '6M': 180, 'YTD': 180, '1Y': 365, 'ALL': 365 };
    const days = daysMap[timeframe];
    return generateSampleData(index.currentValue, days);
  }, [index, timeframe, quotes]);

  if (!index) {
    return null;
  }

  // Get quote from store
  const quote = quotes[index.symbol];

  // Use real data for display when available
  const displayValue = quote && quote.last > 0 ? quote.last : index.currentValue;
  const displayChange = quote ? quote.change : index.dayChange;
  const displayChangePct = quote && quote.last > 0
    ? (quote.change / (quote.last - quote.change)) * 100
    : index.dayChangePct;

  const dayColor = displayChangePct >= 0 ? successColor : dangerColor;
  const ytdColor = index.ytdChangePct >= 0 ? successColor : dangerColor;

  const info = INDEX_INFO[index.symbol] || {
    description: 'Market index tracking major publicly traded companies.',
    components: 'Various publicly traded companies',
    methodology: 'Market-weighted index',
  };

  // Calculate stats from real data if available, otherwise use sample data
  let open = index.currentValue - index.dayChange * 0.5;
  let high = index.currentValue + Math.abs(index.dayChange) * 0.3;
  let low = index.currentValue - Math.abs(index.dayChange) * 0.7;

  if (quote && quote.bars && quote.bars.length > 0) {
    // Get today's bar (last bar)
    const todayBar = quote.bars[quote.bars.length - 1];
    if (todayBar) {
      open = todayBar.o || todayBar.c || open;
      high = todayBar.h || todayBar.c || high;
      low = todayBar.l || todayBar.c || low;
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, paddingBottom: spacing.s32 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.s16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s4 }}>
                  {index.symbol}
                </Text>
                <Text style={{ color: textPrimary, fontSize: 24, fontWeight: '800', marginBottom: spacing.s4 }}>
                  {index.name}
                </Text>
                <Text style={{ color: textPrimary, fontSize: 32, fontWeight: '800' }}>
                  {displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.s12, marginTop: spacing.s8 }}>
                  <Text style={{ color: dayColor, fontSize: 14, fontWeight: '600' }}>
                    {displayChangePct >= 0 ? '+' : ''}{displayChange.toFixed(2)} ({displayChangePct >= 0 ? '+' : ''}{displayChangePct.toFixed(2)}%)
                  </Text>
                  <Text style={{ color: textMuted, fontSize: 14 }}>Today</Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  console.log('📊 [IndexDetailSheet] X button pressed, calling onClose');
                  onClose();
                }}
                style={{ padding: spacing.s8, zIndex: 10000, elevation: 10000 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="x" size={24} color={textMuted} />
              </Pressable>
            </View>

            {/* Chart */}
            <View style={{ marginBottom: spacing.s24 }}>
              <LineChart
                data={chartData}
                height={200}
                yAxisWidth={0}
                padding={{ left: 12, right: 12, bottom: 20, top: 10 }}
                showCurrentLabel={false}
              />
              {quote && quote.bars && (
                <Text style={{ color: textMuted, fontSize: 10, marginTop: spacing.s4, textAlign: 'center' }}>
                  Data from {profile.dataSource || 'Yahoo'} • {chartData.length} data points
                </Text>
              )}

              {/* Time Interval Selector */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s12 }}>
                {(['1D','5D','1M','3M','6M','YTD','1Y','ALL'] as const).map(k => {
                  const on = timeframe === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setTimeframe(k)}
                      style={{ paddingHorizontal: spacing.s8, paddingVertical: spacing.s8 }}
                    >
                      <Text
                        style={{
                          color: on ? accentPrimary : textMuted,
                          fontSize: on ? 14 : 12,
                          fontWeight: on ? '800' : '600',
                        }}
                      >
                        {k}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Stats Grid */}
            <View style={{ flexDirection: 'row', gap: spacing.s12, marginBottom: spacing.s24 }}>
              <View style={{ flex: 1, backgroundColor: surface1, padding: spacing.s12, borderRadius: radius.md }}>
                <Text style={{ color: textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: spacing.s4 }}>
                  Open
                </Text>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
                  {open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: surface1, padding: spacing.s12, borderRadius: radius.md }}>
                <Text style={{ color: textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: spacing.s4 }}>
                  High
                </Text>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
                  {high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: surface1, padding: spacing.s12, borderRadius: radius.md }}>
                <Text style={{ color: textMuted, fontSize: 11, textTransform: 'uppercase', marginBottom: spacing.s4 }}>
                  Low
                </Text>
                <Text style={{ color: textPrimary, fontSize: 16, fontWeight: '700' }}>
                  {low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* YTD Performance */}
            <View style={{ backgroundColor: surface1, padding: spacing.s16, borderRadius: radius.lg, marginBottom: spacing.s24 }}>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s8 }}>
                Year to Date
              </Text>
              <Text style={{ color: ytdColor, fontSize: 20, fontWeight: '700' }}>
                {index.ytdChangePct >= 0 ? '+' : ''}{index.ytdChange.toFixed(2)} ({index.ytdChangePct >= 0 ? '+' : ''}{index.ytdChangePct.toFixed(1)}%)
              </Text>
            </View>

            {/* About Section */}
            <View style={{ marginBottom: spacing.s24 }}>
              <Text style={{ color: textPrimary, fontSize: 18, fontWeight: '700', marginBottom: spacing.s12 }}>
                About
              </Text>
              <Text style={{ color: textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.s16 }}>
                {info.description}
              </Text>

              <View style={{ gap: spacing.s12 }}>
                <View>
                  <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s4 }}>
                    Components
                  </Text>
                  <Text style={{ color: textPrimary, fontSize: 14 }}>
                    {info.components}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: textMuted, fontSize: 12, fontWeight: '600', marginBottom: spacing.s4 }}>
                    Methodology
                  </Text>
                  <Text style={{ color: textPrimary, fontSize: 14 }}>
                    {info.methodology}
                  </Text>
                </View>
              </View>
            </View>
      </View>
    </BottomSheet>
  );
}
