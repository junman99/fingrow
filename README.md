I want to create an app called FinGrow to help young generations track spending, and also grow their wealth from a young age. below are the app's rules. I will be using expo go app to test the app on my iphone running SDK54. I am someone with no coding knowledge at all.

FinGrow UI Rules
MUST = non-negotiable · SHOULD = default · MAY = optional
Core (MUST)
1.	Wrappers
Use <Screen> (static) or <ScreenScroll> (scroll). No other page containers.
2.	Safe areas
Apply top+left+right+bottom at screen level. Bottom inset required to clear iPhone home indicator. Never add inner SafeAreaView.
3.	Backgrounds
Root uses background.default. Navigation theme must match. Cards/sheets/modals use surface.level1/2 (no #fff literals).
4.	Colors & tokens
No hex anywhere; read via get('…'). Component colors come from component tokens (e.g., component.button.primary.bg). New colors = add semantic token (don’t import palette directly).
5.	Spacing / radius / elevation
Spacing: 0 / 4 / 8 / 12 / 16 / 24 / 32.
Radius: sm | md | lg | xl | pill.
Elevation: level0–3 (+ matching iOS shadows).
6.	Scroll behavior
iOS bounce ON by default for all scrollable screens. Android: allow overscroll/stretch. Ensure contentContainerStyle.flexGrow:1. Forms/lists: keyboardShouldPersistTaps="handled", keyboardDismissMode="on-drag".
7.	Lists & virtualization
Do not nest FlatList/VirtualizedList inside a plain ScrollView with same orientation. Long lists use a VirtualizedList as the primary scroller. Mixed content pages can use <ScreenScroll> with non-virtualized sections.
8.	Keyboard & forms
Only the wrapper handles keyboard avoidance. No extra KeyboardAvoidingView. Input focus/placeholder/error colors must come from tokens.
9.	Navigation
Route names are singular & stable (Home, Add, Transactions, Settings, GroupsRoot, …). Nested nav: navigate('Parent', { screen: 'Child' }).
10.	Headers & spacing
React Navigation header OFF globally; use shared <AppHeader /> when needed. First content under header uses one top spacing (default 16).
11.	Components
Cards are for grouped content (never full-screen container). Buttons use defined variants (primary/secondary/ghost) with tokenized states. Chips/Tags/Badges use semantic variants (neutral/success/warning/danger).
12.	Icons & images
Icon color from tokens (icon.default, icon.onPrimary, …). For dark/light assets, route via tokens or provide both and switch by theme.
13.	Accessibility
Text tokens must meet WCAG AA on their backgrounds. Use text.muted for muted (no opacity hacks). Dynamic Type ON (allowFontScaling). VoiceOver: every control has role+label+value. No color-only meaning.
14.	Theming
Theme provider controls system|light|dark. Views read tokens via hook/getter; no static palette imports.
15.	Structure
theme/ = tokens, palettes, provider, nav theme.
components/ = reusable, tokenized, no screen hacks.
screens/ = page logic/layout; must start with approved wrapper; no SafeAreaView.
16.	States
Every data screen supports: idle | loading | empty | error | content | refreshing | paginating. Error/empty use tokens (text.muted, icon.muted, surface).
17.	Performance
Memoize heavy rows/lists. Pass minimal props. Avoid theme-dependent inline styles that cause large re-renders.
18.	I18n & truncation
Texts support truncation (numberOfLines, ellipsizeMode). Don’t hardcode string widths/lengths.
19.	Overlays (modals/sheets/toasts)
Use surface tokens; overlay opacity from tokens. Respect bottom safe area: padding-bottom = max(insets.bottom, 16). If an overlay scrolls, mirror contentInset.bottom and scrollIndicatorInsets.bottom.
20.	Charts (FinGrow)
Currency labels compact ($1.2k / $1.2m). MonthCompareChart padding: left ≈28–38, right 35, bottom 17. Don’t switch to daysPlotThis-1 without spec change.
21.	Bottom inset ownership
Wrappers own bottom inset: <Screen>/<ScreenScroll> add internal paddingBottom = max(insets.bottom, 16), and for scrollables also set contentInset.bottom & scrollIndicatorInsets.bottom. Tab bar includes paddingBottom = insets.bottom (navigator handles). Fixed footers/CTAs include paddingBottom = max(insets.bottom, 12); don’t overlap the home indicator.
Recommended (SHOULD/MAY)
22.	Type ramp
xs11 / sm13 / base15 / md17 / lg20 / xl24 / 2xl28. Line-height ~1.3–1.4×. Titles use xl/2xl; body base/md. Sentence-case CTAs.
23.	Touch targets
Min 44×44dp. Add hitslop 12 around small icons. If <24×24, wrap in Pressable meeting target.
24.	Motion & haptics
Subtle 100–150ms transitions; use springs for toggles. Haptics via expo-haptics (success light / warning medium / error heavy). Don’t fake “disabled” with opacity; use disabled tokens.
25.	Loading/refresh/pagination
Prefer skeletons over spinners. Pull-to-refresh uses native control; show “Last updated …”. Pagination: footer loader + “End of list” label; no auto-jump to top.
26.	Forms UX
Validate on blur & submit (not every keystroke). Inline error text in text.danger + icon. Primary CTA disabled until required fields valid; explain when disabled after submit try. Numeric keyboard for numbers; currency formats on blur.
27.	Formatting & locale
Currency compact; $0–$999 as full dollars; 2 decimals only when cents matter. Dates: Today, Yesterday, else DD MMM yyyy. Percent: one decimal for <1% (e.g., 0.7%), else integer. Use device TZ.
28.	Offline & retries
Show top offline banner; allow cached read-only. Retry button + auto-retry on reconnect. Small toggles: optimistic UI with rollback + toast on failure.
29.	Permissions & privacy
Prime before system prompt. If declined, provide “Open Settings” link. Mask PII by default.
30.	Images
Use expo-image (contentFit="cover", cached). Reserve aspect-ratio boxes to prevent layout shift. Fallback: muted placeholder + retry.
31.	Chart clarity
One accent per series (tokens). Subtle gridlines (border.subtle); show zero-line only if helpful. Truncate labels; use tooltips. Neutral annotations (e.g., “Payday”, “Rent auto-debit”).
32.	Devices & navigation
Phone portrait baseline; tablet MAY use 12-col grid, max width ~720–900dp. Keep state across rotation. Gesture back on iOS; confirm leaving dirty forms. Deep links land on correct nested screen.
33.	Toasts & banners
Toasts bottom, above home indicator (respect insets), auto-dismiss ~2.5–3s. Blocking errors are inline, not toasts.
34.	Performance budgets
First interaction ≤ ~1000ms after mount. 60 FPS for simple scroll; avoid heavy shadows/blur on long lists. Images ideally <300KB; prefer vectors.
35.	Copy & tone
Short, friendly microcopy for Gen-Z (e.g., “Nice—$40 under budget 🎉”). Hide details behind “Learn more”.
36.	Component contracts
Buttons: size(sm/md) · variant(primary/secondary/ghost) · loading · disabled (tokens).
Inputs: label · helper · error · required with consistent gaps.
Cards: outer padding ~16; inner gaps 8/12.
