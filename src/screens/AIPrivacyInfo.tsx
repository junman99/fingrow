import React from 'react';
import { View, Text, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';

export default function AIPrivacyInfo() {
  const { get } = useThemeTokens();
  const nav = useNavigation();

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('surface.base') as string;
  const surface1 = get('surface.level1') as string;
  const accent = get('accent.primary') as string;
  const border = get('border.subtle') as string;

  const openPrivacyPolicy = async () => {
    const url = 'https://www.anthropic.com/privacy';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open the link');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open the link');
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: spacing.s24 }}>
      <Text style={{ color: text, fontSize: 18, fontWeight: '800', marginBottom: spacing.s12, letterSpacing: -0.3 }}>
        {title}
      </Text>
      {children}
    </View>
  );

  const Paragraph = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ color: muted, fontSize: 15, lineHeight: 24, marginBottom: spacing.s12 }}>
      {children}
    </Text>
  );

  const BulletPoint = ({ children }: { children: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', marginBottom: spacing.s8, paddingLeft: spacing.s12 }}>
      <Text style={{ color: accent, marginRight: spacing.s8, fontSize: 15 }}>•</Text>
      <Text style={{ color: muted, fontSize: 15, lineHeight: 24, flex: 1 }}>
        {children}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s12, paddingBottom: spacing.s16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s12 }}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => ({
              padding: spacing.s8,
              marginLeft: -spacing.s8,
              marginTop: -spacing.s4,
              borderRadius: radius.md,
              backgroundColor: pressed ? surface1 : 'transparent',
            })}
            hitSlop={8}
          >
            <Icon name="x" size={28} colorToken="text.primary" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.s2 }}>
              AI Privacy & Data
            </Text>
            <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
              How your data is handled
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.s16,
          paddingBottom: spacing.s32,
        }}
      >
        <Section title="Powered by Claude">
          <Paragraph>
            Fingrow's AI Assistant is powered by Anthropic's Claude, a state-of-the-art AI model designed with safety and privacy in mind.
          </Paragraph>
        </Section>

        <Section title="Your Data Privacy">
          <Paragraph>
            We take your financial privacy seriously. Here's exactly how your data is handled:
          </Paragraph>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Privacy by Design: </Text>
            All your financial data (transactions, account balances, portfolio holdings) stays on your device. We never send raw transaction data to the cloud.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Aggregated Summaries Only: </Text>
            When you ask a question, we first process your data locally to create privacy-safe summaries (e.g., "spent $450 on food this month"). Only these summaries are sent to Claude, never individual transactions.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Not Used for Training: </Text>
            Your conversations and financial data are never used to train AI models. Anthropic has a strict policy against using API data for model training.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Automatic Deletion: </Text>
            All conversation data is automatically deleted from Anthropic's servers within 30 days.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Encrypted Transmission: </Text>
            All data sent to Claude is encrypted in transit using industry-standard HTTPS/TLS encryption.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>No Sharing: </Text>
            Your financial information is never shared with third parties or used for advertising purposes.
          </BulletPoint>
        </Section>

        <Section title="What Data is Sent">
          <Paragraph>
            When you ask a question, we send the following to Claude:
          </Paragraph>

          <BulletPoint>
            Your question or prompt
          </BulletPoint>

          <BulletPoint>
            Recent conversation history (last 2-5 messages depending on your tier) for context
          </BulletPoint>

          <BulletPoint>
            Aggregated summaries relevant to your question (e.g., "spent $145 in Sep, $167 in Oct on coffee" instead of individual transaction details)
          </BulletPoint>

          <Paragraph>
            <Text style={{ fontWeight: '700', color: text }}>What is NOT sent:</Text>
          </Paragraph>

          <BulletPoint>
            Individual transaction records (merchant names, exact amounts, timestamps)
          </BulletPoint>

          <BulletPoint>
            Account numbers or authentication credentials
          </BulletPoint>

          <BulletPoint>
            Personal identification information
          </BulletPoint>

          <BulletPoint>
            Your full financial history
          </BulletPoint>
        </Section>

        <Section title="Local Processing & Caching">
          <Paragraph>
            To protect your privacy and reduce API costs:
          </Paragraph>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Local Storage: </Text>
            Your core financial data (transactions, accounts, portfolio) remains stored locally on your device and is never automatically synced to cloud servers.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Local Intent Detection: </Text>
            Many queries are handled entirely on your device without contacting Claude, saving both privacy and costs.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Device-Level Cache: </Text>
            Responses are cached on your device for 1 hour. If you ask the same question twice, we use the cached response instead of sending it to Claude again.
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Sliding Window Memory: </Text>
            Conversation context is limited to recent messages only (2-5 exchanges depending on your tier), minimizing data exposure.
          </BulletPoint>
        </Section>

        <Section title="Rate Limiting & Tier System">
          <Paragraph>
            We use rate limiting to prevent excessive API usage:
          </Paragraph>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Free Tier: </Text>
            10 messages per day, 5 per hour, with 2-message conversation memory
          </BulletPoint>

          <BulletPoint>
            <Text style={{ fontWeight: '700', color: text }}>Premium Tier: </Text>
            50 messages per day, 20 per hour, with 5-message conversation memory
          </BulletPoint>

          <Paragraph>
            You can switch tiers in Settings → AI Assistant
          </Paragraph>
        </Section>

        <Section title="Your Control">
          <Paragraph>
            You're always in control:
          </Paragraph>

          <BulletPoint>
            You choose what questions to ask and what information to share
          </BulletPoint>

          <BulletPoint>
            You can review transaction confirmations before they're saved
          </BulletPoint>

          <BulletPoint>
            You can stop using the AI Assistant at any time
          </BulletPoint>

          <BulletPoint>
            Conversations are stored locally on your device only
          </BulletPoint>

          <BulletPoint>
            No data is sent to Claude unless you explicitly ask a question
          </BulletPoint>
        </Section>

        <Section title="Learn More">
          <Pressable
            onPress={openPrivacyPolicy}
            style={({ pressed }) => ({
              backgroundColor: surface1,
              borderRadius: radius.lg,
              padding: spacing.s16,
              borderWidth: 1,
              borderColor: border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: muted, fontSize: 14, lineHeight: 22, marginBottom: spacing.s12 }}>
              For more information about Anthropic's privacy practices:
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
              <Text style={{ color: accent, fontSize: 14, fontWeight: '600' }}>
                anthropic.com/privacy
              </Text>
              <Icon name="chevron-right" size={16} colorToken="accent.primary" />
            </View>
          </Pressable>
        </Section>

        <View style={{ marginTop: spacing.s16, padding: spacing.s16, backgroundColor: accent + '10', borderRadius: radius.lg }}>
          <Text style={{ color: muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            <Text style={{ fontWeight: '700', color: text }}>Testing Mode: </Text>
            During development, rate limits are disabled for unlimited testing. Add your Claude API key in src/config/secrets.ts to enable the AI Assistant.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
