# Screen Spacing Guide

Quick reference for fixing top/bottom spacing issues in screens.

## The Problem

ScreenScroll adds automatic padding which can create unwanted gaps:
- **SafeAreaView** adds bottom padding for notches/home indicators
- **ScrollView** adds `paddingBottom: Math.max(insets.bottom, 16)`

If you add MORE padding with `contentStyle`, you get **TRIPLE PADDING**!

---

## The Solution

### ✅ For Modal Screens (Full-bleed, no bottom gap)

Use the `inTab` prop to remove all bottom padding:

```tsx
<ScreenScroll inTab>
  <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
    {/* Your content */}
  </View>
</ScreenScroll>
```

**Examples:** Insights page, any modal that should extend to the bottom

---

### ✅ For Tab Screens (With custom bottom padding)

Use `contentStyle` to control bottom padding:

```tsx
<ScreenScroll contentStyle={{ paddingBottom: Math.max(insets.bottom, spacing.s24) }}>
  <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
    {/* Your content */}
  </View>
</ScreenScroll>
```

**Examples:** Goals page, screens in navigators

---

### ✅ For Screens Inside Tabs (With tab bar)

Use the `inTab` prop but DON'T add contentStyle:

```tsx
<ScreenScroll inTab>
  <View style={{
    paddingHorizontal: spacing.s16,
    paddingTop: spacing.s16,
    paddingBottom: spacing.s24,
    gap: spacing.s16
  }}>
    {/* Your content */}
  </View>
</ScreenScroll>
```

**Examples:** Home, Money, Invest tabs

---

## Standard Layout Pattern

All screens should follow this structure:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const YourScreen = () => {
  const insets = useSafeAreaInsets(); // Only if using contentStyle
  const { get } = useThemeTokens();

  return (
    <ScreenScroll inTab> {/* or contentStyle={{ paddingBottom: ... }} */}
      <View style={{
        paddingHorizontal: spacing.s16,
        paddingTop: spacing.s16,
        gap: spacing.s16
      }}>
        {/* All your content here */}
      </View>
    </ScreenScroll>
  );
};
```

---

## Common Spacing Values

- **Top padding:** `spacing.s16` (always)
- **Horizontal padding:** `spacing.s16` (always)
- **Gap between sections:** `spacing.s16`
- **Gap within sections:** `spacing.s12`
- **Bottom padding (if custom):** `Math.max(insets.bottom, spacing.s24)`

---

## Quick Fixes

### ❌ Problem: Big gap at top
**Fix:** Remove extra padding from header. Should only be `paddingTop: spacing.s16`

### ❌ Problem: Big gap at bottom
**Fix:** Add `inTab` prop to ScreenScroll or remove `contentStyle` padding

### ❌ Problem: Content not extending to bottom on modal
**Fix:** Use `inTab` prop

### ❌ Problem: Content being cut off by tab bar
**Fix:** Remove `inTab` and add proper `contentStyle` with safe area insets

---

## Reference Examples

### Perfect Modal Screen (Insights)
```tsx
<ScreenScroll inTab>
  <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
```

### Perfect Navigator Screen (Goals)
```tsx
<ScreenScroll contentStyle={{ paddingBottom: Math.max(insets.bottom, spacing.s24) }}>
  <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s16, gap: spacing.s16 }}>
```

### Perfect Tab Screen (Home)
```tsx
<ScreenScroll inTab>
  <View style={{
    paddingHorizontal: spacing.s16,
    paddingTop: spacing.s12,
    paddingBottom: spacing.s32
  }}>
```

---

## Don'ts

❌ Don't nest padding containers
❌ Don't add both `inTab` AND `contentStyle` padding
❌ Don't use custom header components with their own padding
❌ Don't add `paddingBottom` to both ScreenScroll AND inner View

---

## Quick Decision Tree

```
Is it a modal screen?
├─ YES → Use `inTab` prop
│
└─ NO → Is it in a navigator (Goals, Money, Invest)?
   ├─ YES → Use `contentStyle={{ paddingBottom: Math.max(insets.bottom, spacing.s24) }}`
   │
   └─ NO → Is it in a bottom tab?
      └─ YES → Use `inTab` prop
```

---

**Last updated:** October 2025
**Applies to:** All screens using ScreenScroll component
