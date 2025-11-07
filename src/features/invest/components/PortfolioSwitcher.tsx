
import React from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import BottomSheet from '../BottomSheet';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';

type Item = { id: string; name: string; baseCurrency?: string; type?: 'Live'|'Paper' };

type Props = {
  visible: boolean;
  onClose: () => void;
  portfolios: Item[];
  activeId: string;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onCreate: (name: string, currency: string, type?: 'Live'|'Paper', benchmark?: string) => void;
};

export default function PortfolioSwitcher({ visible, onClose, portfolios, activeId, onSelect, onSelectAll, onCreate, onDelete, onArchive }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg2 = get('surface.level2') as string;
  const accent = get('accent.primary') as string;

  const Row = ({ label, subtitle, onPress, active }: { label: string; subtitle?: string; onPress?: () => void; active?: boolean }) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingVertical: spacing.s12, paddingHorizontal: spacing.s8, borderRadius: radius.md, backgroundColor: active ? bg2 : 'transparent' }}>
      <Text style={{ color: text, fontWeight: '700' }}>{label}</Text>
      {subtitle ? <Text style={{ color: muted, fontSize: 12 }}>{subtitle}</Text> : null}
    </Pressable>
  );

  const [createMode, setCreateMode] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newCur, setNewCur] = React.useState('SGD');
  const [newType, setNewType] = React.useState<'Live'|'Paper'>('Live');
  const [newBench, setNewBench] = React.useState('SPY');

  return (
    <BottomSheet visible={visible} onClose={onClose} height={520}>
      <View style={{ gap: spacing.s8 }}>
        <Text style={{ color: text, fontWeight: '800', fontSize: 18, marginBottom: spacing.s8 }}>Switch portfolio</Text>
        <Row label="All Portfolios" subtitle="Aggregate view" onPress={onSelectAll} />
        {/* New portfolio inline form */}
        {createMode ? (
          <View style={{ gap: spacing.s8, marginTop: spacing.s8, backgroundColor: get('surface.level1') as string, borderRadius: radius.lg, padding: spacing.s12 }}>
            <Text style={{ color: text, fontWeight: '700' }}>New portfolio</Text>
            <View style={{ gap: spacing.s8 }}>
              <View>
                <Text style={{ color: muted, marginBottom: spacing.s4 }}>Name</Text>
                <TextInput
                  placeholder="e.g., Long-term"
                  placeholderTextColor={get('text.muted') as string}
                  value={newName}
                  onChangeText={setNewName}
                  style={{ color: text, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12 }}
                />
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: spacing.s4 }}>Currency</Text>
                <TextInput
                  placeholder="SGD"
                  placeholderTextColor={get('text.muted') as string}
                  value={newCur}
                  onChangeText={t => setNewCur(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={3}
                  style={{ color: text, borderWidth: 1, borderColor: get('border.subtle') as string, borderRadius: radius.md, padding: spacing.s12 }}
                />
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: spacing.s4 }}>Type</Text>
                <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                  <Pressable onPress={() => setNewType('Live')} style={{ flex:1, alignItems:'center', paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: newType==='Live' ? (get('component.button.primary.bg') as string) : (get('component.button.secondary.bg') as string), borderWidth: newType==='Live' ? 0 : 1, borderColor: get('component.button.secondary.border') as string }}>
                    <Text style={{ color: newType==='Live' ? (get('component.button.primary.text') as string) : (get('component.button.secondary.text') as string), fontWeight:'700' }}>Live</Text>
                  </Pressable>
                  <Pressable onPress={() => setNewType('Paper')} style={{ flex:1, alignItems:'center', paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: newType==='Paper' ? (get('component.button.primary.bg') as string) : (get('component.button.secondary.bg') as string), borderWidth: newType==='Paper' ? 0 : 1, borderColor: get('component.button.secondary.border') as string }}>
                    <Text style={{ color: newType==='Paper' ? (get('component.button.primary.text') as string) : (get('component.button.secondary.text') as string), fontWeight:'700' }}>Paper</Text>
                  </Pressable>
                </View>
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: spacing.s4 }}>Benchmark</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap: spacing.s8 }}>
                  {['SPY','QQQ','STI','NONE'].map(b => (
                    <Pressable key={b} onPress={() => setNewBench(b)} style={{ paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill, backgroundColor: newBench===b ? (get('component.button.secondary.bg') as string) : 'transparent', borderWidth: 1, borderColor: get('border.subtle') as string }}>
                      <Text style={{ color: text }}>{b}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection:'row', gap: spacing.s8 }}>
                <Pressable disabled={!newName.trim() || newCur.length!==3} onPress={() => { if (!newName.trim() || newCur.length!==3) return; onCreate(newName.trim(), newCur.trim(), newType, newBench==='NONE'? undefined : newBench); setCreateMode(false); setNewName(''); setNewCur('SGD'); setNewType('Live'); setNewBench('SPY'); }} style={{ flex:1, alignItems:'center', backgroundColor: get('component.button.primary.bg') as string, borderRadius: radius.pill, paddingVertical: spacing.s8, opacity: (!newName.trim() || newCur.length!==3) ? 0.5 : 1 }}>
                  <Text style={{ color: get('component.button.primary.text') as string, fontWeight:'700' }}>Save</Text>
                </Pressable>
                <Pressable onPress={() => { setCreateMode(false); }} style={{ flex:1, alignItems:'center', backgroundColor: get('component.button.secondary.bg') as string, borderRadius: radius.pill, paddingVertical: spacing.s8, borderWidth:1, borderColor:get('component.button.secondary.border') as string }}>
                  <Text style={{ color: get('component.button.secondary.text') as string, fontWeight:'700' }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ height: 1, backgroundColor: get('border.subtle') as string, marginVertical: spacing.s8 }} />
        {portfolios.map(p => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Row label={p.name} subtitle={`${p.baseCurrency || ''} ${p.type || ''}`.trim()} onPress={() => onSelect(p.id)} active={p.id===activeId} />
            </View>
            <Pressable onPress={()=>Alert.alert('Manage portfolio', p.name, [
              { text: 'Archive', onPress: ()=> onArchive(p.id) },
              { text: 'Delete', style:'destructive', onPress: ()=> onDelete(p.id) },
              { text: 'Cancel', style:'cancel' }
            ])} style={{ padding: spacing.s8 }}>
              <Text style={{ color: get('text.primary') as string }}>Manage</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setCreateMode(true)} style={{ marginTop: spacing.s12, alignSelf:'flex-start', backgroundColor: accent, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}>
          <Text style={{ color: get('text.onPrimary') as string, fontWeight: '700' }}>Create new portfolio</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
