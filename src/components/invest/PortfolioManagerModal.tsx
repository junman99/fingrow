import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import CenterModal from '../CenterModal';
import { useInvestStore } from '../../store/invest';
import { useThemeTokens } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/tokens';
import MoveHoldingsSheet from './MoveHoldingsSheet';
import { exportPortfolioCsv } from '../../lib/export';

type Props = {
  onStartDelete?: () => void;
  visible: boolean;
  onClose: () => void;
  onRequestEdit?: (id: string) => void;
};

export default function PortfolioManagerModal({ visible, onClose, onRequestEdit }: Props) {
  const { get } = useThemeTokens();
  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const border = get('border.subtle') as string;

  const portfolios = useInvestStore((s) => s.portfolios);
  const order = useInvestStore((s) => (s as any).order || (s as any).portfolioOrder);
  const setPortfolioArchived = useInvestStore((s) => (s as any).setPortfolioArchived);
  const duplicatePortfolio = useInvestStore((s) => (s as any).duplicatePortfolio);
  const deletePortfolio = useInvestStore((s) => (s as any).deletePortfolio);
  const reorderPortfolios = useInvestStore((s) => (s as any).reorderPortfolios);

  const items = useMemo(() => {
    const map = portfolios || {};
    const ord = (order && (order as any).length ? order : Object.keys(map));
    return (ord as any).map((id: string) => ({ id, ...(map as any)[id] })).filter(Boolean);
  }, [portfolios, order]);

  const [reorderMode, setReorderMode] = useState(false);
  const [moveVisible, setMoveVisible] = useState(false);
  const [moveSrc, setMoveSrc] = useState<string | null>(null);

  return (
    <>
      <CenterModal visible={visible} onClose={onClose}>
        <View style={{ paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
          <View style={{ alignItems: 'flex-end', marginBottom: spacing.s8 }}>
            <Pressable accessibilityRole="button" onPress={() => setReorderMode((v) => !v)} hitSlop={12} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
              <Text style={{ color: text, fontWeight: '700' }}>{reorderMode ? 'Done' : 'Reorder'}</Text>
            </Pressable>
          </View>

          {items.length === 0 ? (
            <View style={{ paddingVertical: spacing.s12 }}>
              <Text style={{ color: muted }}>No portfolios yet.</Text>
            </View>
          ) : (
            <View>
              {items.map((item: any, index: number) => {
                const isArchived = !!item.archived;
                return (
                  <View key={item.id} style={{ paddingVertical: spacing.s12, borderBottomWidth: 1, borderBottomColor: border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, paddingRight: spacing.s12 }}>
                        <Text style={{ color: text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                          {item.name || 'Untitled'} {isArchived ? '· Archived' : ''}
                        </Text>
                        <Text style={{ color: muted, marginTop: 2 }} numberOfLines={1}>
                          {(item.baseCurrency || 'USD').toUpperCase()} · {item.type || 'Live'}
                        </Text>
                      </View>

                      {!reorderMode ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          <Pressable onPress={() => onRequestEdit && onRequestEdit(item.id)} hitSlop={12} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12 }}>
                            <Text style={{ color: text, fontWeight: '700' }}>Edit</Text>
                          </Pressable>
                          <Pressable onPress={() => { setMoveSrc(item.id); setMoveVisible(true); }} hitSlop={12} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12 }}>
                            <Text style={{ color: text }}>Move</Text>
                          </Pressable>
                          <Pressable onPress={() => exportPortfolioCsv(item.id)} hitSlop={12} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12 }}>
                            <Text style={{ color: text }}>Export</Text>
                          </Pressable>
                          <Pressable onPress={() => setPortfolioArchived(item.id, !isArchived)} hitSlop={12} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12 }}>
                            <Text style={{ color: text }}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
                          </Pressable>
                          <Pressable onPress={() => duplicatePortfolio(item.id)} hitSlop={12} style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12 }}>
                            <Text style={{ color: text }}>Duplicate</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              Alert.alert('Delete portfolio', `Delete "${item.name}"? This cannot be undone.`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deletePortfolio(item.id) },
                              ]);
                            }}
                            hitSlop={12}
                            style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12 }}
                          >
                            <Text style={{ color: text }}>Delete</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row' }}>
                          <Pressable
                            onPress={() => {
                              const ids = items.map((x: any) => x.id);
                              if (index > 0) {
                                const tmp = ids[index - 1];
                                ids[index - 1] = ids[index];
                                ids[index] = tmp;
                                reorderPortfolios(ids);
                              }
                            }}
                            hitSlop={12}
                            style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, opacity: index === 0 ? 0.5 : 1 }}
                          >
                            <Text style={{ color: text }}>Up</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              const ids = items.map((x: any) => x.id);
                              if (index < items.length - 1) {
                                const tmp = ids[index + 1];
                                ids[index + 1] = ids[index];
                                ids[index] = tmp;
                                reorderPortfolios(ids);
                              }
                            }}
                            hitSlop={12}
                            style={{ paddingVertical: spacing.s8, paddingHorizontal: spacing.s12, opacity: index === items.length - 1 ? 0.5 : 1 }}
                          >
                            <Text style={{ color: text }}>Down</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </CenterModal>

      {moveVisible ? (
        <MoveHoldingsSheet visible onClose={() => setMoveVisible(false)} sourceId={moveSrc} />
      ) : null}
    </>
  );
}
