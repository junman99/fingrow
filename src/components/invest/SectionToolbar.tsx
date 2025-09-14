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
};

export default function SectionToolbar({ title, onFilter, onSort, onEdit, sortLabel='Sort', filterLabel='Filter', editLabel='Edit' }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const bg = get('surface.level2') as string;

  const Btn = ({ label, onPress }: { label: string; onPress?: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: bg, paddingHorizontal: spacing.s12, paddingVertical: spacing.s8, borderRadius: radius.pill }}
    >
      <Text style={{ color: text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.s16, marginBottom: spacing.s8, paddingHorizontal: spacing.s16 }}>
      <Text style={{ color: text, fontWeight: '700' }}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
        {onFilter ? <Btn label={filterLabel} onPress={onFilter} /> : null}
        {onSort ? <Btn label={sortLabel} onPress={onSort} /> : null}
        {onEdit ? <Btn label={editLabel} onPress={onEdit} /> : null}
      </View>
    </View>
  );
}