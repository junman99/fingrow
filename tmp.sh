
#!/usr/bin/env bash
set -euo pipefail

# 0) sanity
[ -f package.json ] || { echo "Run this from your project root (where package.json lives)."; exit 1; }
mkdir -p src/components src/screens

# 1) ensure deps
node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); pkg.dependencies=pkg.dependencies||{}; pkg.dependencies['lucide-react-native']=pkg.dependencies['lucide-react-native']||'^0.525.0'; pkg.dependencies['expo-haptics']=pkg.dependencies['expo-haptics']||'~12.8.1'; fs.writeFileSync('package.json', JSON.stringify(pkg,null,2)); console.log('updated package.json deps');"

# 2) write Keypad.tsx
cat > src/components/Keypad.tsx <<'TS'
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type Props = { onKey: (k: string) => void; onBackspace: () => void; onDone: () => void; };

const Key: React.FC<{ label: string; onPress: () => void; wide?: boolean }> = ({ label, onPress, wide }) => {
  const { get } = useThemeTokens();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
      backgroundColor: get('surface.level1') as string, opacity: pressed ? 0.9 : 1, flex: wide ? 2 : 1
    })}>
      <Text style={{ color: get('text.primary') as string, fontSize: 20, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
};

export const Keypad: React.FC<Props> = ({ onKey, onBackspace, onDone }) => {
  const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View style={{ flexDirection: 'row', gap: spacing.s8 }}>{children}</View>
  );
  return (
    <View style={{ padding: spacing.s12, gap: spacing.s8 }}>
      <Row><Key label="1" onPress={() => onKey('1')} /><Key label="2" onPress={() => onKey('2')} /><Key label="3" onPress={() => onKey('3')} /><Key label="+" onPress={() => onKey('+')} /></Row>
      <Row><Key label="4" onPress={() => onKey('4')} /><Key label="5" onPress={() => onKey('5')} /><Key label="6" onPress={() => onKey('6')} /><Key label="−" onPress={() => onKey('-')} /></Row>
      <Row><Key label="7" onPress={() => onKey('7')} /><Key label="8" onPress={() => onKey('8')} /><Key label="9" onPress={() => onKey('9')} /><Key label="×" onPress={() => onKey('×')} /></Row>
      <Row><Key label="." onPress={() => onKey('.')} /><Key label="0" onPress={() => onKey('0')} /><Key label="⌫" onPress={onBackspace} /><Key label="÷" onPress={() => onKey('÷')} /></Row>
      <Row><Key label="Done" onPress={onDone} wide /></Row>
    </View>
  );
};

export default Keypad;
TS

# 3) write Add.tsx
cat > src/screens/Add.tsx <<'TS'
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { AppHeader } from '../components/AppHeader';
import { spacing, radius } from '../theme/tokens';
import { useThemeTokens } from '../theme/ThemeProvider';
import { useTxStore } from '../store/transactions';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Keypad } from '../components/Keypad';
import {
  Utensils, ShoppingBasket, Bus, Fuel, Ticket, ShoppingBag, Wallet, Plane, HeartPulse, Dumbbell, House, Gift,
  TrendingUp, Repeat, ArrowLeftRight, GraduationCap, PawPrint, Plug, Droplets, MoreHorizontal
} from 'lucide-react-native';

type Mode = 'expense' | 'income';
type Cat = { key: string; label: string; icon: React.ComponentType<any>; type: Mode };

const ALL_CATEGORIES: Cat[] = [
  { key: 'food',       label: 'Food',        icon: Utensils,       type: 'expense' },
  { key: 'groceries',  label: 'Groceries',   icon: ShoppingBasket, type: 'expense' },
  { key: 'transport',  label: 'Transport',   icon: Bus,            type: 'expense' },
  { key: 'fuel',       label: 'Fuel',        icon: Fuel,           type: 'expense' },
  { key: 'shopping',   label: 'Shopping',    icon: ShoppingBag,    type: 'expense' },
  { key: 'entertain',  label: 'Entertainment', icon: Ticket,       type: 'expense' },
  { key: 'bills',      label: 'Bills',       icon: Plug,           type: 'expense' },
  { key: 'utilities',  label: 'Utilities',   icon: Droplets,       type: 'expense' },
  { key: 'health',     label: 'Health',      icon: HeartPulse,     type: 'expense' },
  { key: 'fitness',    label: 'Fitness',     icon: Dumbbell,       type: 'expense' },
  { key: 'home',       label: 'Home',        icon: House,          type: 'expense' },
  { key: 'gifts',      label: 'Gifts',       icon: Gift,           type: 'expense' },
  { key: 'travel',     label: 'Travel',      icon: Plane,          type: 'expense' },
  { key: 'education',  label: 'Education',   icon: GraduationCap,  type: 'expense' },
  { key: 'pets',       label: 'Pets',        icon: PawPrint,       type: 'expense' },
  { key: 'salary',     label: 'Salary',      icon: Wallet,         type: 'income' },
  { key: 'invest',     label: 'Invest',      icon: TrendingUp,     type: 'income' },
  { key: 'refund',     label: 'Refund',      icon: Repeat,         type: 'income' },
  { key: 'transfer',   label: 'Transfer',    icon: ArrowLeftRight, type: 'income' },
];

const quickCats = (mode: Mode): Cat[] => ALL_CATEGORIES.filter(c => c.type === mode).slice(0, 11);

function evaluateExpression(expr: string): number | null {
  if (!expr) return 0;
  const mapped = expr.replace(/×/g,'*').replace(/÷/g,'/');
  if (!/^[0-9.+\-*/ ]+$/.test(mapped)) return null;
  if (/[+\-*/.]$/.test(mapped)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${mapped})`);
    const result = fn();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return result;
  } catch { return null; }
}

export default function Add() {
  const { get } = useThemeTokens();
  const nav = useNavigation<any>();
  const { add } = useTxStore();

  const [mode, setMode] = useState<Mode>('expense');
  const [expr, setExpr] = useState('');
  const result = evaluateExpression(expr);
  const [category, setCategory] = useState<Cat>(quickCats('expense')[0]);
  const [when] = useState<Date>(new Date());
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState('Default');

  useEffect(() => { if (category?.type !== mode) setCategory(quickCats(mode)[0]); }, [mode]);

  const onKey = (k: string) => {
    setExpr((prev) => {
      const last = prev.slice(-1);
      const isOp = (ch: string) => ['+','-','×','÷','*','/'].includes(ch);
      if (isOp(k)) {
        if (prev === '') return k === '-' ? '-' : prev; // allow leading minus
        if (isOp(last)) return prev.slice(0, -1) + k;   // replace operator
        return prev + k;
      }
      if (k === '.') {
        const parts = prev.split(/[+\-×÷*/]/);
        const curr = parts[parts.length - 1];
        if (curr.includes('.')) return prev;
      }
      return prev + k;
    });
  };

  const onBackspace = () => setExpr((p) => p.slice(0, -1));

  const onSave = async () => {
    const val = result ?? null;
    if (val === null || val <= 0) return;
    add({ type: mode, amount: val, category: category?.label || 'General', date: when.toISOString(), notes: notes?.trim() || undefined } as any);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    nav.goBack();
  };

  const ModeToggle = () => {
    const Seg = (m: Mode, label: string) => {
      const on = mode === m;
      return (
        <Pressable onPress={() => setMode(m)} style={({ pressed }) => ({
          paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill,
          backgroundColor: on ? (get('accent.primary') as string) : (get('surface.level2') as string),
          opacity: pressed ? 0.9 : 1,
        })}>
          <Text style={{ color: on ? (get('text.onPrimary') as string) : (get('text.primary') as string), fontWeight: '700' }}>{label}</Text>
        </Pressable>
      );
    };
    return <View style={{ flexDirection: 'row', gap: spacing.s8 }}>{Seg('expense','Exp')}{Seg('income','Inc')}</View>;
  };

  const CategoryGrid = () => {
    const cats = [...quickCats(mode)];
    cats.push({ key: 'more', label: 'More', icon: MoreHorizontal, type: mode });
    const Item: React.FC<{ c: Cat }> = ({ c }) => {
      const IconC = c.icon;
      const selected = category?.key === c.key;
      return (
        <Pressable onPress={() => setCategory(c)} style={({ pressed }) => ({
          width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
          backgroundColor: selected ? (get('accent.primary') as string) : (get('surface.level2') as string),
          opacity: pressed ? 0.9 : 1
        })}>
          <IconC size={28} color={selected ? (get('icon.onPrimary') as string) : (get('icon.default') as string)} />
        </Pressable>
      );
    };
    return (
      <View style={{ gap: spacing.s8 }}>
        {[0,1,2].map(row => (
          <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {cats.slice(row*4, row*4 + 4).map(c => (
              <View key={c.key} style={{ alignItems: 'center', width: 72 }}>
                <Item c={c} />
                <Text style={{ marginTop: spacing.s8, color: get('text.primary') as string }} numberOfLines={1}>{c.label}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const Chip: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill,
      backgroundColor: get('surface.level2') as string, opacity: pressed ? 0.9 : 1
    })}>
      <Text style={{ color: get('text.primary') as string }}>{label}</Text>
    </Pressable>
  );

  const Panels = () => (
    <View style={{ gap: spacing.s8 }}>
      {accountOpen && (
        <View style={{ borderRadius: radius.lg, backgroundColor: get('surface.level1') as string, padding: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', marginBottom: spacing.s8 }}>Account</Text>
          {['Default','Cash','Card'].map(a => (
            <Pressable key={a} onPress={() => { setAccount(a); setAccountOpen(false); }} style={{ paddingVertical: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string }}>{a}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {notesOpen && (
        <View style={{ borderRadius: radius.lg, backgroundColor: get('surface.level1') as string, padding: spacing.s12 }}>
          <Text style={{ color: get('text.primary') as string, fontWeight: '700', marginBottom: spacing.s8 }}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note"
            style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: get('surface.level2') as string, color: get('text.primary') as string }}
            returnKeyType="done"
            onSubmitEditing={() => setNotesOpen(false)}
          />
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <AppHeader title="Add" />
      <View style={{ flex: 1, padding: spacing.s16, gap: spacing.s16 }}>
        <ModeToggle />
        <CategoryGrid />
        <View style={{ flexDirection: 'row', gap: spacing.s8, flexWrap: 'wrap' }}>
          <Chip label={`Time: Now`} onPress={() => { /* small time sheet later */ }} />
          <Chip label={`Account: ${account}`} onPress={() => { setAccountOpen((s)=>!s); setNotesOpen(false); }} />
          <Chip label={notes ? `“${notes}”` : 'Notes'} onPress={() => { setNotesOpen((s)=>!s); setAccountOpen(false); }} />
        </View>
        <Panels />
        <View style={{ marginTop: spacing.s8 }}>
          {/* expression preview */}
          {/* (keep muted text token, no hex) */}
          {Boolean(expr) && <Text style={{ color: get('text.muted') as string, marginBottom: spacing.s8 }}>{expr}</Text>}
          <Text style={{ color: get('text.primary') as string, fontSize: 40, fontWeight: '800' }}>
            ${result !== null ? result.toFixed(2) : '0.00'}
          </Text>
        </View>
      </View>
      {/* custom keypad pinned bottom */}
      <Keypad onKey={onKey} onBackspace={onBackspace} onDone={onSave} />
    </Screen>
  );
}
TS

# 4) optional: Feather 'wallet' mapping fix if you still use it elsewhere
if [ -f src/components/Icon.tsx ]; then
  node -e "let p='src/components/Icon.tsx',s=require('fs').readFileSync(p,'utf8'); if(s.includes(`'wallet'`)&&s.includes('Feather')){s=s.replace(/['\"]wallet['\"][^\\n]*:[^\\n]*['\"][^'\\\"]*['\"]/,'\\'wallet\\': \\'credit-card\\''); require('fs').writeFileSync(p,s); console.log('Adjusted Feather wallet->credit-card mapping');} else { console.log('Icon.tsx unchanged'); }"
fi

echo "Done. Now run:
  npm install
  npx expo install
  npx expo start -c
"

