# Main Tab Title Animation

**Official Name:** Main Tab Title Animation

**Quick Command:** "Implement Main Tab Title Animation to [screen name]"

---

## Overview
A sophisticated scroll-triggered animation where a left-aligned title smoothly transitions to a centered, floating sticky header with gradient background as the user scrolls down.

## Visual Behavior

### Initial State (scroll position = 0px)
- **Original Title**: Left-aligned, visible
  - fontSize: `28` ⭐ (STANDARD - use this size for all screens)
  - fontWeight: `'800'`
  - letterSpacing: `-0.5`
  - Position: Normal flow in content
  - Opacity: `1`

- **Floating Title**: Not visible
  - Opacity: `0`

### Transition (scroll position = 0-50px)
- **Original Title**: Fades out smoothly
  - Opacity interpolates from `1` → `0`

- **Floating Title**: Fades in and shrinks
  - Opacity interpolates from `0` → `1`
  - fontSize interpolates from `28` → `20`
  - fontWeight interpolates from `800` → `700`
  - Position: Fixed at top, centered

- **Gradient Background**: Fades in
  - Opacity interpolates from `0` → `1`

### Final State (scroll position >= 50px)
- **Original Title**: Completely hidden
  - Opacity: `0`

- **Floating Title**: Fully visible, sticky at top
  - fontSize: `20`
  - fontWeight: `'700'`
  - letterSpacing: `-0.5`
  - textAlign: `'center'`
  - Opacity: `1` (stays at 1, doesn't fade further)
  - Position: Fixed at top

- **Gradient Background**: Fully visible, sticky
  - Opacity: `1` (stays at 1)
  - Colors: 6-stop gradient for smooth fade
    ```typescript
    [
      bgDefault,           // 100% opaque at top
      bgDefault,           // 100% opaque (holds solid color)
      withAlpha(bgDefault, 0.95),  // 95% opaque
      withAlpha(bgDefault, 0.8),   // 80% opaque
      withAlpha(bgDefault, 0.5),   // 50% opaque
      withAlpha(bgDefault, 0)      // 0% opaque (transparent)
    ]
    ```
  - Padding Top: `insets.top + spacing.s16` (ensures title is below dynamic island)
  - Padding Bottom: `spacing.s32 + spacing.s20` (52px total for gradient fade height)

---

## Implementation Checklist

### 1. Screen Setup (Full Screen)
```typescript
// In your screen component:
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnimatedScrollHandler, interpolate, Extrapolate } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const insets = useSafeAreaInsets();
```

### 2. Animation Values & Handlers
```typescript
// Main Tab Title Animation
const scrollY = useSharedValue(0);
const scrollHandler = useAnimatedScrollHandler((event) => {
  scrollY.value = event.contentOffset.y;
});
```

### 3. Animated Styles
```typescript
// Original title animation (fades out)
const originalTitleAnimatedStyle = useAnimatedStyle(() => {
  'worklet';
  const progress = interpolate(
    scrollY.value,
    [0, 50],
    [0, 1],
    Extrapolate.CLAMP
  );

  return {
    opacity: 1 - progress,
  };
});

// Floating title animation (fades in, shrinks)
const floatingTitleAnimatedStyle = useAnimatedStyle(() => {
  'worklet';
  const progress = interpolate(
    scrollY.value,
    [0, 50],
    [0, 1],
    Extrapolate.CLAMP
  );

  const fontSize = interpolate(progress, [0, 1], [28, 20]);
  const fontWeight = interpolate(progress, [0, 1], [800, 700]);

  return {
    fontSize,
    fontWeight: fontWeight.toString() as any,
    opacity: progress >= 1 ? 1 : progress, // Keep at 1 once fully scrolled
  };
});

// Gradient background animation
const gradientAnimatedStyle = useAnimatedStyle(() => {
  'worklet';
  const progress = interpolate(
    scrollY.value,
    [0, 50],
    [0, 1],
    Extrapolate.CLAMP
  );

  return {
    opacity: progress >= 1 ? 1 : progress, // Keep at 1 once fully scrolled
  };
});
```

### 4. JSX Structure
```typescript
return (
  <>
    {/* Main Tab Title Animation - Floating Gradient Header (Fixed at top, outside scroll) */}
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          pointerEvents: 'none',
        },
        gradientAnimatedStyle,
      ]}
    >
      <LinearGradient
        colors={[
          bgDefault,
          bgDefault,
          withAlpha(bgDefault, 0.95),
          withAlpha(bgDefault, 0.8),
          withAlpha(bgDefault, 0.5),
          withAlpha(bgDefault, 0)
        ]}
        style={{
          paddingTop: insets.top + spacing.s16,
          paddingBottom: spacing.s32 + spacing.s20,
          paddingHorizontal: spacing.s16,
        }}
      >
        <Animated.Text
          style={[
            {
              color: text,
              fontSize: 20,
              fontWeight: '700',
              letterSpacing: -0.5,
              textAlign: 'center',
            },
            floatingTitleAnimatedStyle,
          ]}
        >
          {SCREEN_TITLE}
        </Animated.Text>
      </LinearGradient>
    </Animated.View>

    <ScreenScroll
      inTab
      fullScreen
      onScroll={scrollHandler}
      scrollEventThrottle={16}
      contentStyle={{
        paddingHorizontal: 0,
        paddingTop: insets.top + spacing.s24,  ⭐ STANDARD TOP PADDING
        paddingBottom: spacing.s32,
        gap: spacing.s16,
      }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.s16, gap: spacing.s16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Animated.Text
            style={[
              {
                color: text,
                fontSize: 28,
                fontWeight: '800',
                letterSpacing: -0.5,
              },
              originalTitleAnimatedStyle,
            ]}
          >
            {SCREEN_TITLE}
          </Animated.Text>
        </View>

        {/* Rest of your content */}
      </View>
    </ScreenScroll>
  </>
);
```

---

## Key Technical Details

### Animation Trigger
- **Scroll Distance**: 50 pixels
- **Interpolation**: Linear with `Extrapolate.CLAMP`
- **Direction**: Reversible (scrolling back up reverses everything)

### Positioning Strategy
- **Floating Header**: `position: 'absolute'` outside ScreenScroll for true sticky behavior
- **Full Screen**: ScreenScroll uses `fullScreen` prop to remove top SafeAreaView edge
- **Content Padding**: Content uses `insets.top + spacing.s16` to start below dynamic island

### Performance Optimizations
- Uses `'worklet'` directive for all animated styles
- `scrollEventThrottle={16}` for 60fps smooth animation
- `pointerEvents: 'none'` on floating header to avoid blocking touches

### Color & Opacity
- Text color: Uses theme token `text` (adapts to light/dark mode)
- Gradient: 6 color stops for ultra-smooth fade
- Background: Uses `bgDefault` theme token

---

## Required Props/Values to Replace
1. `{SCREEN_TITLE}` - Replace with actual screen title (e.g., "Money", "Invest", "Goals")
2. `text` - Ensure you have `const text = get('text.primary') as string;`
3. `bgDefault` - Ensure you have `const bgDefault = get('background.default') as string;`
4. `withAlpha` - Use the utility function from the screen (already exists in most screens)

---

## Key Standards (IMPORTANT - USE THESE VALUES)

⭐ **Original Title Font Size:** `28` (fontSize at top of screen)
⭐ **Content Top Padding:** `insets.top + spacing.s24` (spacing below dynamic island)
⭐ **Floating Title Font Size:** `20` (fontSize when scrolled)
⭐ **Animation Trigger:** `50` pixels scroll distance

## Notes
- This animation is currently implemented in: `src/screens/Money.tsx`, `src/screens/Budgets.tsx`, `src/screens/Home.tsx`
- Works perfectly with iPhone dynamic island and notch
- Fully compatible with both light and dark themes
- No snap/jump behavior - completely smooth
- The gradient fade prevents text cutoff as content scrolls under the header
- **Always use fontSize 28 for the original title and spacing.s24 for top padding**

---

## Example Usage
To implement this on another screen:
1. Say: "Implement Main Tab Title Animation to the Invest screen"
2. Or: "Add Main Tab Title Animation to Goals tab"
3. The assistant will follow this spec exactly
