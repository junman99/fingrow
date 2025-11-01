import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScreenScroll } from '../components/ScreenScroll';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';

const institutions = [
  { name: 'Manual', icon: 'edit-3', logo: null },
  { name: 'DBS', icon: 'building-2', logo: 'https://logo.clearbit.com/dbs.com' },
  { name: 'OCBC', icon: 'building-2', logo: 'https://logo.clearbit.com/ocbc.com' },
  { name: 'UOB', icon: 'building-2', logo: 'https://logo.clearbit.com/uob.com.sg' },
  { name: 'HSBC', icon: 'building-2', logo: 'https://logo.clearbit.com/hsbc.com' },
  { name: 'Maybank', icon: 'building-2', logo: 'https://logo.clearbit.com/maybank.com' },
  { name: 'Standard Chartered', icon: 'building-2', logo: 'https://logo.clearbit.com/sc.com' },
  { name: 'Citibank', icon: 'building-2', logo: 'https://logo.clearbit.com/citibank.com' },
  { name: 'Bank of America', icon: 'building-2', logo: 'https://logo.clearbit.com/bankofamerica.com' },
  { name: 'Chase', icon: 'building-2', logo: 'https://logo.clearbit.com/chase.com' },
  { name: 'Wells Fargo', icon: 'building-2', logo: 'https://logo.clearbit.com/wellsfargo.com' },
  { name: 'Capital One', icon: 'building-2', logo: 'https://logo.clearbit.com/capitalone.com' },
  { name: 'American Express', icon: 'credit-card', logo: 'https://logo.clearbit.com/americanexpress.com' },
  { name: 'Discover', icon: 'credit-card', logo: 'https://logo.clearbit.com/discover.com' },
  { name: 'PayPal', icon: 'dollar-sign', logo: 'https://logo.clearbit.com/paypal.com' },
  { name: 'Venmo', icon: 'dollar-sign', logo: 'https://logo.clearbit.com/venmo.com' },
  { name: 'Cash App', icon: 'dollar-sign', logo: 'https://logo.clearbit.com/cash.app' },
  { name: 'Revolut', icon: 'credit-card', logo: 'https://logo.clearbit.com/revolut.com' },
  { name: 'Wise', icon: 'credit-card', logo: 'https://logo.clearbit.com/wise.com' },
  { name: 'N26', icon: 'credit-card', logo: 'https://logo.clearbit.com/n26.com' },
];

function withAlpha(color: string, alpha: number) {
  if (!color) return color;
  if (color.startsWith('#')) {
    const raw = color.replace('#', '');
    const expanded = raw.length === 3 ? raw.split('').map(x => x + x).join('') : raw;
    const int = parseInt(expanded, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

const SelectInstitution: React.FC = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { get, isDark } = useThemeTokens();
  const [search, setSearch] = useState('');

  const currentInstitution = route.params?.currentInstitution || '';

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const cardBg = get('surface.level1') as string;
  const border = get('border.subtle') as string;
  const accentPrimary = get('accent.primary') as string;

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (institutionName: string) => {
    if (route.params?.onSelect) {
      route.params.onSelect(institutionName);
    }
    nav.goBack();
  };

  return (
    <ScreenScroll
      inTab
      contentStyle={{ padding: spacing.s16, paddingBottom: spacing.s32, gap: spacing.s16 }}
    >
      {/* Header */}
      <View style={{ gap: spacing.s8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? cardBg : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="chevron-left" size={28} color={text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
              Select institution
            </Text>
          </View>
        </View>
        <Text style={{ color: muted, fontSize: 14 }}>
          Choose your bank or financial institution
        </Text>
      </View>

      {/* Search */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.s16,
          paddingVertical: spacing.s12,
          gap: spacing.s12,
        }}
      >
        <Icon name="search" size={20} color={muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search institutions..."
          placeholderTextColor={muted}
          style={{
            flex: 1,
            color: text,
            fontSize: 16,
            padding: 0,
          }}
        />
      </View>

      {/* Institutions List */}
      <View style={{ gap: spacing.s8 }}>
        {filteredInstitutions.map((inst) => {
          const isSelected = inst.name === currentInstitution;
          return (
            <Pressable
              key={inst.name}
              onPress={() => handleSelect(inst.name)}
              style={({ pressed }) => ({
                backgroundColor: cardBg,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: isSelected ? accentPrimary : border,
                padding: spacing.s16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                {inst.logo ? (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: withAlpha(border, 0.3),
                    }}
                  >
                    <Image
                      source={{ uri: inst.logo }}
                      style={{ width: 40, height: 40 }}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: radius.md,
                      backgroundColor: withAlpha(text, isDark ? 0.2 : 0.1),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={inst.icon as any} size={24} color={muted} />
                  </View>
                )}
                <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>
                  {inst.name}
                </Text>
              </View>
              {isSelected && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.pill,
                    backgroundColor: accentPrimary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" size={16} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {filteredInstitutions.length === 0 && (
        <View style={{ padding: spacing.s32, alignItems: 'center', gap: spacing.s12 }}>
          <Icon name="search" size={48} color={muted} />
          <Text style={{ color: muted, textAlign: 'center' }}>
            No institutions found
          </Text>
        </View>
      )}
    </ScreenScroll>
  );
};

export default SelectInstitution;
