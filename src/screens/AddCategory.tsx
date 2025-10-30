import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';

type AddCategoryModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, emoji: string) => void;
};

// Emoji mapping for common category keywords
const EMOJI_MAP: Record<string, string> = {
  // Food & Dining
  food: '🍔',
  restaurant: '🍽️',
  dining: '🍽️',
  lunch: '🥗',
  dinner: '🍲',
  breakfast: '🥞',
  coffee: '☕',
  cafe: '☕',
  pizza: '🍕',
  burger: '🍔',
  sushi: '🍣',
  dessert: '🍰',
  ice: '🍦',
  drink: '🥤',
  beer: '🍺',
  wine: '🍷',
  snack: '🍿',
  fruit: '🍎',
  vege: '🥬',
  vegetable: '🥬',
  meat: '🥩',

  // Transportation
  car: '🚗',
  taxi: '🚕',
  uber: '🚕',
  grab: '🚕',
  bus: '🚌',
  train: '🚆',
  mrt: '🚇',
  subway: '🚇',
  flight: '✈️',
  parking: '🅿️',
  gas: '⛽',
  fuel: '⛽',

  // Shopping
  clothes: '👕',
  clothing: '👕',
  shoes: '👟',
  bag: '👜',
  beauty: '💄',
  makeup: '💄',

  // Entertainment
  movie: '🎬',
  cinema: '🎬',
  game: '🎮',
  gaming: '🎮',
  music: '🎵',
  spotify: '🎵',
  netflix: '📺',
  youtube: '📺',

  // Health & Fitness
  gym: '💪',
  fitness: '🏋️',
  yoga: '🧘',
  doctor: '⚕️',
  medicine: '💊',
  hospital: '🏥',
  dental: '🦷',

  // Home
  rent: '🏠',
  mortgage: '🏠',
  electricity: '💡',
  water: '💧',
  internet: '📡',
  wifi: '📡',
  cleaning: '🧹',

  // Work & Income
  salary: '💰',
  bonus: '💰',
  freelance: '💼',
  business: '💼',

  // Gifts & Donations
  gift: '🎁',
  donation: '❤️',
  charity: '❤️',

  // Pets
  pet: '🐾',
  dog: '🐕',
  cat: '🐈',
  vet: '🐾',

  // Other
  book: '📚',
  education: '📚',
  phone: '📱',
  laptop: '💻',
  gadget: '📱',
};

function getEmojiForCategory(name: string): string {
  const lowercased = name.toLowerCase().trim();

  // Check for exact matches
  if (EMOJI_MAP[lowercased]) {
    return EMOJI_MAP[lowercased];
  }

  // Check for partial matches
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (lowercased.includes(key) || key.includes(lowercased)) {
      return emoji;
    }
  }

  // Default: return first letter as uppercase
  return name.trim().charAt(0).toUpperCase();
}

export default function AddCategoryModal({ visible, onClose, onSave }: AddCategoryModalProps) {
  const { get, isDark } = useThemeTokens();
  const [name, setName] = useState('');

  const textPrimary = get('text.primary') as string;
  const textMuted = get('text.muted') as string;
  const textOnPrimary = get('text.onPrimary') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const backgroundDefault = get('background.default') as string;
  const accentPrimary = get('accent.primary') as string;
  const accentSecondary = get('accent.secondary') as string;
  const borderSubtle = get('border.subtle') as string;

  const emoji = useMemo(() => getEmojiForCategory(name), [name]);
  const isEmoji = emoji.length > 1; // Emojis are typically multi-byte

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), emoji);
    setName('');
    onClose();
  };

  const handleCancel = () => {
    setName('');
    onClose();
  };

  function withAlpha(color: string, alpha: number): string {
    if (!color) return color;
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const bigint = parseInt(expanded, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={{ flex: 1, backgroundColor: withAlpha(backgroundDefault, 0.94), justifyContent: 'flex-start', alignItems: 'center', paddingTop: 180, padding: spacing.s16 }}>
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        </TouchableWithoutFeedback>
        <View
          style={{
            width: '100%',
            maxWidth: 400,
            borderRadius: radius.xl,
            padding: spacing.s20,
            backgroundColor: surface1,
            borderWidth: 1,
            borderColor: borderSubtle,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.s20 }}>
            <Text style={{ color: textPrimary, fontWeight: '700', fontSize: 20 }}>Add category</Text>
            <Pressable
              onPress={handleSave}
              disabled={!name.trim()}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: radius.md,
                backgroundColor: name.trim() ? accentPrimary : surface2,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{
                color: name.trim() ? textOnPrimary : textMuted,
                fontSize: 18,
                fontWeight: '700'
              }}>✓</Text>
            </Pressable>
          </View>

          {/* Preview */}
          <View style={{
            alignItems: 'center',
            paddingVertical: spacing.s20,
            marginBottom: spacing.s16,
          }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.lg,
                backgroundColor: withAlpha(accentSecondary, isDark ? 0.25 : 0.15),
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.s10,
              }}
            >
              <Text style={{ fontSize: isEmoji ? 36 : 32, fontWeight: isEmoji ? '400' : '700', color: isEmoji ? undefined : accentSecondary }}>
                {emoji || '?'}
              </Text>
            </View>
            <Text style={{ color: textPrimary, fontWeight: '600', fontSize: 15 }}>
              {name.trim() || 'Category name'}
            </Text>
          </View>

          {/* Category Name Input */}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Coffee, Vegetables, Donations"
            placeholderTextColor={`${textMuted}88`}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            style={{
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: borderSubtle,
              paddingVertical: spacing.s12,
              paddingHorizontal: spacing.s16,
              backgroundColor: surface2,
              color: textPrimary,
              fontSize: 16,
              fontWeight: '600',
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
