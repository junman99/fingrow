import React from 'react';
import { View, Text, ScrollView, Animated, Easing, Pressable, AppState } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';
import { IndexDetailSheet } from '../features/invest';

type IndexData = {
  symbol: string;
  name: string;
  currentValue: number;
  dayChange: number;
  dayChangePct: number;
  ytdChange: number;
  ytdChangePct: number;
};

// Major global indices - you can update these with real data from your store/API
// Using correct Yahoo Finance ticker symbols
const INDICES: IndexData[] = [
  { symbol: '^GSPC', name: 'S&P 500', currentValue: 5234.56, dayChange: 52.30, dayChangePct: 0.85, ytdChange: 812.45, ytdChangePct: 15.2 },
  { symbol: '^DJI', name: 'Dow Jones', currentValue: 38245.60, dayChange: 245.60, dayChangePct: 0.62, ytdChange: 3250.10, ytdChangePct: 9.8 },
  { symbol: '^IXIC', name: 'Nasdaq', currentValue: 16180.25, dayChange: 180.25, dayChangePct: 1.15, ytdChange: 2845.75, ytdChangePct: 22.4 },
  { symbol: '^FTSE', name: 'FTSE 100', currentValue: 7815.40, dayChange: -15.40, dayChangePct: -0.22, ytdChange: 185.30, ytdChangePct: 2.5 },
  { symbol: '^GDAXI', name: 'DAX', currentValue: 17098.75, dayChange: 98.75, dayChangePct: 0.58, ytdChange: 1825.60, ytdChangePct: 12.8 },
  { symbol: '^N225', name: 'Nikkei 225', currentValue: 38125.80, dayChange: -125.80, dayChangePct: -0.35, ytdChange: 4250.90, ytdChangePct: 18.6 },
  { symbol: '^HSI', name: 'Hang Seng', currentValue: 18320.50, dayChange: 320.50, dayChangePct: 1.45, ytdChange: -1250.30, ytdChangePct: -6.2 },
  { symbol: '^STI', name: 'STI', currentValue: 3312.45, dayChange: 12.45, dayChangePct: 0.38, ytdChange: 245.80, ytdChangePct: 7.5 },
];

// Calculate US market status (NYSE/NASDAQ: 9:30 AM - 4:00 PM ET)
function getUSMarketStatus() {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcDay = now.getUTCDay();

  // Convert to ET (UTC-5 or UTC-4 during DST - simplified to UTC-5)
  let etHours = utcHours - 5;
  if (etHours < 0) etHours += 24;

  // Weekend check
  if (utcDay === 0 || utcDay === 6) {
    return { isOpen: false, message: 'Market Closed - Weekend' };
  }

  const currentMinutes = etHours * 60 + utcMinutes;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  if (currentMinutes >= marketOpen && currentMinutes < marketClose) {
    // Market is open
    const minutesUntilClose = marketClose - currentMinutes;
    const hours = Math.floor(minutesUntilClose / 60);
    const minutes = minutesUntilClose % 60;
    return { isOpen: true, message: `Closes in ${hours}h ${minutes}m` };
  } else {
    // Market is closed
    let minutesUntilOpen;
    if (currentMinutes < marketOpen) {
      minutesUntilOpen = marketOpen - currentMinutes;
    } else {
      minutesUntilOpen = (24 * 60) - currentMinutes + marketOpen;
    }
    const hours = Math.floor(minutesUntilOpen / 60);
    const minutes = minutesUntilOpen % 60;
    return { isOpen: false, message: `Opens in ${hours}h ${minutes}m` };
  }
}

const IndexItem: React.FC<{ index: IndexData; onPress: () => void }> = ({ index, onPress }) => {
  const { get } = useThemeTokens();

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const successColor = get('semantic.success') as string;
  const dangerColor = get('semantic.danger') as string;
  const surface1 = get('surface.level1') as string;

  const dayColor = index.dayChangePct >= 0 ? successColor : dangerColor;
  const ytdColor = index.ytdChangePct >= 0 ? successColor : dangerColor;

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View
        style={{
          backgroundColor: surface1,
          paddingHorizontal: spacing.s12,
          paddingVertical: spacing.s8,
          borderRadius: 8,
          marginRight: spacing.s8,
          minWidth: 200,
        }}
        pointerEvents="box-only"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <Text style={{ color: textPrimary, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 }}>
            {index.symbol}
          </Text>
          <Text style={{ color: textMuted, fontSize: 10 }}>
            {index.name}
          </Text>
        </View>
        <Text style={{ color: textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
          {index.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textMuted, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }}>
              Day
            </Text>
            <Text style={{ color: dayColor, fontSize: 11, fontWeight: '600' }}>
              {index.dayChangePct >= 0 ? '+' : ''}{index.dayChangePct.toFixed(2)}%
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textMuted, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }}>
              YTD
            </Text>
            <Text style={{ color: ytdColor, fontSize: 11, fontWeight: '600' }}>
              {index.ytdChangePct >= 0 ? '+' : ''}{index.ytdChangePct.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export const GlobalIndicesTicker: React.FC = () => {
  const { get } = useThemeTokens();
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [itemWidth, setItemWidth] = React.useState(0);
  const animationFrameRef = React.useRef<number | null>(null);
  const isUserScrollingRef = React.useRef(false);
  const initialScrollDoneRef = React.useRef(false);
  const isPausedRef = React.useRef(false);
  const lastTimestampRef = React.useRef<number | null>(null);
  const [marketStatus, setMarketStatus] = React.useState(getUSMarketStatus());
  const [selectedIndex, setSelectedIndex] = React.useState<IndexData | null>(null);
  const [showModal, setShowModal] = React.useState(false);
  const [renderModal, setRenderModal] = React.useState(false);

  // Debug state changes
  React.useEffect(() => {
    console.log('📊 [IndexTicker] showModal changed to:', showModal);
    if (showModal) {
      setRenderModal(true);
    }
  }, [showModal]);

  React.useEffect(() => {
    console.log('📊 [IndexTicker] selectedIndex changed to:', selectedIndex?.symbol || null);
  }, [selectedIndex]);

  React.useEffect(() => {
    console.log('📊 [IndexTicker] renderModal changed to:', renderModal);
  }, [renderModal]);

  // Update market status every minute
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getUSMarketStatus());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Breathing animation for market status dot
  const breathAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (marketStatus.isOpen) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 0.4,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      breathAnim.setValue(1);
    }
  }, [marketStatus.isOpen, breathAnim]);

  // Measure single item width
  const onItemLayout = (event: any) => {
    if (itemWidth === 0) {
      const width = event.nativeEvent.layout.width;
      setItemWidth(width);
    }
  };

  // Initialize scroll position to middle segment
  React.useEffect(() => {
    if (itemWidth > 0 && !initialScrollDoneRef.current) {
      const totalWidth = itemWidth * INDICES.length;
      const middlePosition = totalWidth * 2; // Start at copy 2 (out of 5 copies)

      setTimeout(() => {
        scrollX.setValue(middlePosition);
        initialScrollDoneRef.current = true;
      }, 50);
    }
  }, [itemWidth, scrollX]);

  // Pause animation when app goes to background
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        isPausedRef.current = false;
        lastTimestampRef.current = null; // Reset timestamp to avoid jumps
      } else {
        isPausedRef.current = true;
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Auto-scroll effect with requestAnimationFrame (prevents speed issues when app is backgrounded)
  React.useEffect(() => {
    if (itemWidth === 0) return;

    const totalWidth = itemWidth * INDICES.length;
    const scrollSpeed = 30; // pixels per second

    // Small delay to ensure initial scroll is complete
    const startDelay = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (isUserScrollingRef.current || isPausedRef.current) {
          lastTimestampRef.current = timestamp;
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // Calculate delta time for smooth animation regardless of frame rate
        const deltaTime = lastTimestampRef.current ? (timestamp - lastTimestampRef.current) / 1000 : 0;
        lastTimestampRef.current = timestamp;

        const currentScroll = (scrollX as any)._value;
        const scrollDelta = scrollSpeed * deltaTime;
        let newScroll = currentScroll + scrollDelta;

        // Wrap forward when reaching end of segment
        if (newScroll >= totalWidth * 3) {
          newScroll = newScroll - totalWidth;
        } else if (newScroll <= totalWidth) {
          // Wrap backward when scrolling too far left
          newScroll = newScroll + totalWidth;
        }

        scrollX.setValue(newScroll);
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, 100);

    return () => {
      clearTimeout(startDelay);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [itemWidth, scrollX]);

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Create many duplicates for seamless infinite scroll
  const duplicatedIndices = [...INDICES, ...INDICES, ...INDICES, ...INDICES, ...INDICES];

  const textMuted = get('text.muted') as string;
  const textPrimary = get('text.primary') as string;
  const statusColor = marketStatus.isOpen ? '#3B82F6' : '#6B7280'; // Blue for open, gray for closed

  return (
    <View>
      {/* Market Status Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingBottom: spacing.s6 }}>
        <Animated.View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: statusColor,
            marginRight: spacing.s8,
            opacity: breathAnim,
          }}
        />
        <Text style={{ color: textMuted, fontSize: 11, fontWeight: '600' }}>
          {marketStatus.isOpen ? 'US Market Open' : 'US Market Closed'} • {marketStatus.message}
        </Text>
      </View>

      {/* Ticker ScrollView */}
      <View style={{ height: 90, overflow: 'hidden' }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            transform: [{ translateX: scrollX.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -1]
            })}]
          }}
        >
          {duplicatedIndices.map((index, i) => (
            <View key={`${index.symbol}-${i}`} onLayout={i === 0 ? onItemLayout : undefined}>
              <IndexItem
                index={index}
                onPress={() => {
                  console.log('📊 [IndexTicker] Index card pressed:', index.symbol);
                  setSelectedIndex(index);
                  setShowModal(true);
                }}
              />
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Index Detail Sheet */}
      {renderModal && selectedIndex && showModal && (
        <IndexDetailSheet
          index={selectedIndex}
          visible={showModal}
          onClose={() => {
            console.log('📊 [IndexTicker] onClose called');
            setShowModal(false);
            // Delay unmounting to allow Modal animation to complete
            setTimeout(() => {
              setRenderModal(false);
              setSelectedIndex(null);
            }, 300);
          }}
        />
      )}
    </View>
  );
};
