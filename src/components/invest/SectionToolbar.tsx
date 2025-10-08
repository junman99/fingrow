import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';

type Props = {
  title: string;
  onFilter?: () => void;
  onSort?: () => void;
  onEdit?: () => void; // for watchlist
  sortLabel?: string;
  filterLabel?: string;
  editLabel?: string;
  onAdd?: () => void;
  addLabel?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  subtitle?: string;
};

export default function SectionToolbar({ title, onFilter, onSort, onEdit, sortLabel='Sort', filterLabel='Filter', editLabel='Edit', onAdd, addLabel='Add', collapsed=false, onToggle, subtitle }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.level2') as string;

  const Pill = ({ label, onPress }: { label: string; onPress?: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: bg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}
    >
      <Text style={{ color: text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.s8, paddingTop: spacing.s8, marginBottom: spacing.s8, paddingHorizontal: spacing.s12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${title}`} style={{ flexDirection:'row', alignItems:'baseline' }}>
          <Text style={{ color: text, fontWeight: '700', fontSize: 20 }}>{collapsed ? '▸' : '▾'} {title}</Text>
          {subtitle ? <Text style={{ color: muted, marginLeft: spacing.s8, fontSize: 13 }}>{subtitle}</Text> : null}
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
          {onFilter ? <Pill label={filterLabel!} onPress={onFilter} /> : null}
          {onSort ? <Pill label={sortLabel!} onPress={onSort} /> : null}
          {onEdit ? <Pill label={editLabel!} onPress={onEdit} /> : null}
          {onAdd ? <Pill label={addLabel!} onPress={onAdd} /> : null}
        </View>
      </View>
    </View>
  );
}
