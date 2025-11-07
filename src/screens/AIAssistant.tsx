import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import * as Clipboard from 'expo-clipboard';
import { useThemeTokens } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme/tokens';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { processQuery, AIMessage, getUserRateLimitStatus, clearConversation } from '../lib/ai/aiService';
import TransactionConfirmation, { TransactionData, PortfolioTransactionData } from '../components/ai/TransactionConfirmation';
import { useTxStore } from '../store/transactions';
import { useInvestStore } from '../store/invest';
import { useAccountsStore } from '../store/accounts';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  metadata?: AIMessage['metadata'];
};

const SUGGESTED_QUESTIONS = [
  "How much did I spend on food this month?",
  "What's my portfolio performance?",
  "Show my biggest expenses this month",
  "What's my net worth?",
  "How am I doing on my budget?",
  "I spent $12 at Starbucks",
];

const MESSAGES_STORAGE_KEY = 'fingrow:ai:messages';

export default function AIAssistant() {
  const { get } = useThemeTokens();
  const nav = useNavigation();
  const { add: addTransaction } = useTxStore();
  const { addLot } = useInvestStore();
  const { accounts, hydrate: hydrateAccounts } = useAccountsStore();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingConfirmation, setPendingConfirmation] = React.useState<{
    type: 'transaction' | 'portfolio_transaction';
    data: TransactionData | PortfolioTransactionData;
  } | null>(null);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = React.useState(0);
  const suggestionOpacity = React.useRef(new Animated.Value(1)).current;
  const flatListRef = React.useRef<FlatList>(null);

  // Expanding bubble animation
  const bubbleScale = React.useRef(new Animated.Value(0)).current;
  const bubbleOpacity = React.useRef(new Animated.Value(0)).current;

  // Hydrate accounts on mount
  React.useEffect(() => {
    hydrateAccounts();
  }, [hydrateAccounts]);

  // Load persisted messages on mount
  React.useEffect(() => {
    const loadMessages = async () => {
      try {
        const stored = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const loadedMessages = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error('[AIAssistant] Failed to load messages:', error);
      }
    };
    loadMessages();

    // Expanding bubble animation on mount
    Animated.parallel([
      Animated.spring(bubbleScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Persist messages when they change
  React.useEffect(() => {
    if (messages.length > 0) {
      AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages)).catch(console.error);
    }
  }, [messages]);

  // Rotate suggestions with fade animation
  React.useEffect(() => {
    if (messages.length === 0) return; // Don't rotate on welcome screen

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(suggestionOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change suggestion
        setCurrentSuggestionIndex(prev => (prev + 1) % SUGGESTED_QUESTIONS.length);
        // Fade in
        Animated.timing(suggestionOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [messages.length]);

  const text = get('text.primary') as string;
  const muted = get('text.muted') as string;
  const bg = get('background.default') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const accent = get('accent.primary') as string;
  const border = get('border.subtle') as string;

  const withAlpha = (hex: string, alpha: number) => {
    if (!hex) return hex;
    const raw = hex.replace('#', '');
    const bigint = parseInt(raw.length === 3 ? raw.repeat(2) : raw, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const sendMessage = async (messageText?: string) => {
    const questionText = messageText || input.trim();
    if (!questionText || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: questionText,
      timestamp: new Date(),
    };

    setMessages(prev => [userMsg, ...prev]);
    setInput('');
    setIsLoading(true);

    // Scroll to bottom after user message (offset 0 for inverted list)
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);

    try {
      // Call real AI service
      console.log('[AIAssistant] Sending query to AI service:', questionText);
      const response = await processQuery(questionText);

      const assistantMsg: Message = {
        id: response.message.id,
        role: 'assistant',
        text: response.message.content,
        timestamp: new Date(response.message.timestamp),
        metadata: response.message.metadata,
      };

      setMessages(prev => [assistantMsg, ...prev]);
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);

      // Handle transaction confirmation if needed
      if (response.requiresConfirmation) {
        console.log('[AIAssistant] Transaction confirmation required:', response.requiresConfirmation);
        setPendingConfirmation(response.requiresConfirmation);
      }

      // Log usage stats
      if (response.message.metadata?.usage) {
        console.log('[AIAssistant] Token usage:', response.message.metadata.usage);
      }
      if (response.message.metadata?.cached) {
        console.log('[AIAssistant] Response from cache');
      }
    } catch (error: any) {
      console.error('[AIAssistant] Error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [errorMsg, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  // Get ALL cash and credit card accounts for selection
  const suggestedAccounts = React.useMemo(() => {
    console.log('[AIAssistant] All accounts:', JSON.stringify(accounts.map(a => ({ name: a.name, kind: a.kind })), null, 2));

    // Filter to show transaction accounts (same logic as Money tab's cashAccounts + credit cards)
    // Includes: cash, checking, savings, credit (excludes: investment, retirement)
    const transactionAccounts = accounts.filter(a =>
      a.kind === 'cash' ||
      a.kind === 'credit' ||
      a.kind === 'checking' ||
      a.kind === 'savings'
    );

    console.log('[AIAssistant] Transaction accounts:', JSON.stringify(transactionAccounts.map(a => ({ name: a.name, kind: a.kind })), null, 2));

    // Sort by usage in recent transactions
    const { transactions } = useTxStore.getState();
    const accountUsage: Record<string, number> = {};

    (transactions || []).slice(0, 100).forEach(tx => {
      if (tx.account) {
        accountUsage[tx.account] = (accountUsage[tx.account] || 0) + 1;
      }
    });

    // Sort accounts: First by type (cash, checking, savings, credit), then by usage
    const typeOrder: Record<string, number> = {
      'cash': 1,
      'checking': 2,
      'savings': 3,
      'credit': 4,
    };

    const sortedAccounts = transactionAccounts.sort((a, b) => {
      // First sort by type
      const typeA = typeOrder[a.kind || ''] || 999;
      const typeB = typeOrder[b.kind || ''] || 999;
      if (typeA !== typeB) return typeA - typeB;

      // Then sort by usage within same type
      const usageA = accountUsage[a.name] || 0;
      const usageB = accountUsage[b.name] || 0;
      return usageB - usageA;
    });

    return sortedAccounts;
  }, [accounts]);

  const handleConfirmTransaction = async (data: TransactionData | PortfolioTransactionData) => {
    if (pendingConfirmation?.type === 'transaction') {
      const txData = data as TransactionData;

      try {
        // Convert date string to ISO format
        let dateISO = new Date().toISOString();
        if (txData.date === 'today' || txData.date === 'just now') {
          dateISO = new Date().toISOString();
        } else if (txData.date === 'yesterday') {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          dateISO = yesterday.toISOString();
        } else if (txData.date) {
          // Try to parse the date
          const parsed = new Date(txData.date);
          if (!isNaN(parsed.getTime())) {
            dateISO = parsed.toISOString();
          }
        }

        console.log('[AIAssistant] Adding transaction:', {
          type: 'expense',
          amount: txData.amount,
          category: txData.category || 'Food & Dining',
          date: dateISO,
          note: txData.merchant || 'Added via AI Assistant',
          account: txData.account,
        });

        // Add transaction to store
        await addTransaction({
          type: 'expense',
          amount: txData.amount || 0,
          category: txData.category || 'Food',
          date: dateISO,
          note: txData.merchant || 'Added via AI Assistant',
          account: txData.account,
        });

        // Verify transaction was added by checking store
        const { transactions } = useTxStore.getState();
        const wasAdded = transactions && transactions.length > 0 &&
          transactions[0].amount === txData.amount &&
          transactions[0].note === (txData.merchant || 'Added via AI Assistant');

        if (wasAdded) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          console.log('[AIAssistant] Transaction verified in store');

          // Add success message
          const successMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: `✅ Transaction logged: $${txData.amount?.toFixed(2)}${txData.merchant ? ' at ' + txData.merchant : ''}${txData.account ? ' using ' + txData.account : ''}. Check your Spending tab!`,
            timestamp: new Date(),
          };
          setMessages(prev => [successMsg, ...prev]);
        } else {
          throw new Error('Transaction not found in store after adding');
        }
      } catch (error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        console.error('[AIAssistant] Error adding transaction:', error);
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: '❌ Failed to log transaction. Please try again or add it manually in the Spending tab.',
          timestamp: new Date(),
        };
        setMessages(prev => [errorMsg, ...prev]);
      }
    } else if (pendingConfirmation?.type === 'portfolio_transaction') {
      const portfolioData = data as PortfolioTransactionData;

      // Add portfolio transaction
      if (portfolioData.symbol && portfolioData.amount) {
        // TODO: This needs to be integrated with the actual portfolio system
        // For now, just show success message
        const successMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `✅ ${portfolioData.side === 'buy' ? 'Bought' : 'Sold'} ${portfolioData.amount} shares of ${portfolioData.symbol}`,
          timestamp: new Date(),
        };
        setMessages(prev => [successMsg, ...prev]);
      }
    }

    setPendingConfirmation(null);
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
  };

  const handleCancelTransaction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const cancelMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: "Transaction cancelled. Feel free to ask me anything else!",
      timestamp: new Date(),
    };
    setMessages(prev => [cancelMsg, ...prev]);
    setPendingConfirmation(null);
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'This will delete all messages and reset the conversation. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMessages([]);
            setPendingConfirmation(null);
            clearConversation(); // Clear AI conversation memory
            await AsyncStorage.removeItem(MESSAGES_STORAGE_KEY);
          }
        }
      ]
    );
  };

  // Format AI messages with better visuals (but no bold)
  const FormattedMessage = ({ text, textColor }: { text: string; textColor: string }) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        elements.push(<View key={`space-${idx}`} style={{ height: spacing.s8 }} />);
        return;
      }

      // Bullet points (- or • or *)
      if (trimmed.match(/^[-•*]\s+/)) {
        const content = trimmed.replace(/^[-•*]\s+/, '').replace(/\*\*/g, ''); // Remove ** markup
        elements.push(
          <View key={idx} style={{ flexDirection: 'row', marginBottom: spacing.s4 }}>
            <Text style={{ color: get('accent.primary') as string, fontSize: 15, marginRight: spacing.s8 }}>•</Text>
            <Text style={{ color: textColor, fontSize: 15, lineHeight: 22, flex: 1 }}>{content}</Text>
          </View>
        );
        return;
      }

      // Numbered lists (1. or 2. etc)
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        const [, num, content] = numberedMatch;
        const cleanContent = content.replace(/\*\*/g, ''); // Remove ** markup
        elements.push(
          <View key={idx} style={{ flexDirection: 'row', marginBottom: spacing.s4 }}>
            <Text style={{ color: get('accent.primary') as string, fontSize: 15, marginRight: spacing.s8 }}>{num}.</Text>
            <Text style={{ color: textColor, fontSize: 15, lineHeight: 22, flex: 1 }}>{cleanContent}</Text>
          </View>
        );
        return;
      }

      // Regular text - just remove any ** markup
      const cleanText = trimmed.replace(/\*\*/g, '');
      elements.push(
        <Text key={idx} style={{ color: textColor, fontSize: 15, lineHeight: 22, marginBottom: spacing.s4 }}>
          {cleanText}
        </Text>
      );
    });

    return <View>{elements}</View>;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    const isCached = item.metadata?.cached;
    const hasUsage = item.metadata?.usage;
    // With inverted list, index 0 is the newest message (at bottom)
    const isLastMessage = index === 0;
    const showConfirmation = isLastMessage && pendingConfirmation;

    return (
      <View>
        <View
          style={{
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            marginBottom: spacing.s16,
          }}
        >
          <Pressable
            onLongPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await Clipboard.setStringAsync(item.text);
              Alert.alert('Copied!', 'Message copied to clipboard');
            }}
            style={{
              backgroundColor: isUser ? accent : surface1,
              borderRadius: radius.xl,
              padding: spacing.s14,
              paddingHorizontal: spacing.s16,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            {isUser ? (
              <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 22 }} selectable>
                {item.text}
              </Text>
            ) : (
              <FormattedMessage text={item.text} textColor={text} />
            )}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.s6, marginHorizontal: spacing.s8, alignSelf: isUser ? 'flex-end' : 'flex-start', gap: spacing.s6 }}>
            <Text style={{ color: muted, fontSize: 11 }}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isCached && !isUser && (
              <View style={{ backgroundColor: muted + '20', paddingHorizontal: spacing.s6, paddingVertical: 2, borderRadius: radius.sm }}>
                <Text style={{ color: muted, fontSize: 9, fontWeight: '600' }}>CACHED</Text>
              </View>
            )}
          </View>
        </View>

        {/* Show confirmation UI after last assistant message */}
        {showConfirmation && (
          <View style={{ marginTop: -spacing.s8, marginBottom: spacing.s16 }}>
            <TransactionConfirmation
              type={pendingConfirmation.type}
              data={pendingConfirmation.data}
              onConfirm={handleConfirmTransaction}
              onCancel={handleCancelTransaction}
              suggestedAccounts={(() => {
                // Ensure AI-extracted account is always in the list
                if (pendingConfirmation.type === 'transaction') {
                  const txData = pendingConfirmation.data as any;
                  if (txData.account) {
                    const extractedAccount = accounts.find(a => a.name === txData.account);
                    if (extractedAccount) {
                      // Check if it's already in suggested accounts
                      const alreadyIncluded = suggestedAccounts.some(a => a?.name === extractedAccount.name);
                      if (!alreadyIncluded) {
                        // Add it at the beginning
                        return [extractedAccount, ...suggestedAccounts.filter(a => a)].slice(0, 2);
                      }
                    }
                  }
                }
                return suggestedAccounts.filter(a => a);
              })()}
            />
          </View>
        )}
      </View>
    );
  };

  const showWelcome = messages.length === 0;

  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ scale: bubbleScale }],
        opacity: bubbleOpacity,
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={{ flex: 1, backgroundColor: bg }}>
            {/* Floating Gradient Header - positioned absolutely over content */}
            <LinearGradient
            colors={[
              withAlpha(bg, 0.8),
              withAlpha(bg, 0.7),
              withAlpha(bg, 0.5),
              withAlpha(bg, 0.3),
              withAlpha(bg, 0.1),
              withAlpha(bg, 0)
            ]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              paddingTop: spacing.s8,
              paddingBottom: spacing.s32,
            }}
            pointerEvents="box-none"
          >
            {/* Drag Handle */}
            <View style={{ alignItems: 'center', paddingBottom: spacing.s4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: muted, opacity: 0.3 }} />
            </View>

            {/* Header */}
            <View style={{ paddingHorizontal: spacing.s16, paddingTop: spacing.s8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Text style={{ color: text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }}>
                  FinGrow AI
                </Text>
                {messages.length > 0 && (
                  <Pressable
                    onPress={handleClearChat}
                    style={({ pressed }) => ({
                      padding: spacing.s6,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? surface1 : 'transparent',
                      position: 'absolute',
                      right: 0,
                    })}
                    hitSlop={8}
                  >
                    <Icon name="trash" size={20} colorToken="text.primary" />
                  </Pressable>
                )}
              </View>
            </View>
          </LinearGradient>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            scrollEnabled={true}
            bounces={true}
            showsVerticalScrollIndicator={true}
            overScrollMode="always"
            nestedScrollEnabled={true}
            contentContainerStyle={{
              paddingTop: 180,
              paddingHorizontal: spacing.s16,
              paddingBottom: 80,
            }}
          ListHeaderComponent={
            isLoading ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '80%',
                  marginTop: spacing.s16,
                }}
              >
                <View
                  style={{
                    backgroundColor: surface1,
                    borderRadius: radius.xl,
                    padding: spacing.s14,
                    paddingHorizontal: spacing.s16,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.s8,
                  }}
                >
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={{ color: muted, fontSize: 15 }}>Thinking...</Text>
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            showWelcome ? (
              <View style={{ marginTop: spacing.s20 }}>
                <View style={{ alignItems: 'center', paddingVertical: spacing.s24 }}>
                  <View
                    style={{
                      backgroundColor: accent + '15',
                      borderRadius: radius.full,
                      width: 72,
                      height: 72,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: spacing.s16,
                    }}
                  >
                    <Icon name="cpu" size={36} colorToken="accent.primary" />
                  </View>
                  <Text style={{ color: text, fontSize: 20, fontWeight: '800', marginBottom: spacing.s8, letterSpacing: -0.3 }}>
                    Ask me anything
                  </Text>
                  <Text style={{ color: muted, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.s16 }}>
                    I can help with spending, portfolio, budgets, and financial insights
                  </Text>
                </View>

                <View style={{ gap: spacing.s8 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.s4 }}>
                    Suggested questions
                  </Text>
                  {SUGGESTED_QUESTIONS.map((question, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSuggestedQuestion(question)}
                      style={({ pressed }) => ({
                        backgroundColor: surface1,
                        borderRadius: radius.lg,
                        padding: spacing.s16,
                        marginBottom: spacing.s4,
                        opacity: pressed ? 0.7 : 1,
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      })}
                    >
                      <Text style={{ color: text, fontSize: 14, lineHeight: 20 }}>{question}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

          {/* Floating Input Area with gradient background - positioned absolutely at bottom */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
            }}
          >
            <LinearGradient
              colors={[
                withAlpha(bg, 0),
                withAlpha(bg, 0.1),
                withAlpha(bg, 0.3),
                withAlpha(bg, 0.5),
                withAlpha(bg, 0.7),
                withAlpha(bg, 0.8)
              ]}
              style={{
                paddingTop: spacing.s48,
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s12,
                paddingBottom: Platform.OS === 'ios' ? spacing.s32 : spacing.s16,
              }}
              pointerEvents="box-none"
            >
          {/* Rotating Suggestion Chip (only show when conversation has started) */}
          {messages.length > 0 && (
            <Animated.View
              style={{
                opacity: suggestionOpacity,
                marginBottom: spacing.s12,
              }}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleSuggestedQuestion(SUGGESTED_QUESTIONS[currentSuggestionIndex]);
                }}
                style={({ pressed }) => ({
                  backgroundColor: surface1,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.s16,
                  paddingVertical: spacing.s10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.s8,
                  alignSelf: 'flex-start',
                  borderWidth: 1,
                  borderColor: border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon name="zap" size={14} colorToken="accent.primary" />
                <Text style={{ color: muted, fontSize: 13 }}>
                  {SUGGESTED_QUESTIONS[currentSuggestionIndex]}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
            <View
              style={{
                flex: 1,
                backgroundColor: surface1,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: border,
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s12,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your finances..."
                placeholderTextColor={muted}
                style={{ color: text, fontSize: 15, minHeight: 24 }}
                multiline
                maxLength={500}
                editable={!isLoading}
                onSubmitEditing={() => sendMessage()}
                blurOnSubmit={false}
              />
            </View>
            <Pressable
              onPress={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              style={({ pressed }) => ({
                backgroundColor: input.trim() && !isLoading ? accent : surface1,
                borderRadius: radius.full,
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
                borderWidth: 1,
                borderColor: input.trim() && !isLoading ? 'transparent' : border,
              })}
              accessibilityLabel="Send message"
            >
              {isLoading ? (
                <Icon name="zap" size={20} colorToken="text.muted" />
              ) : (
                <Icon
                  name="chevron-right"
                  size={20}
                  colorToken={input.trim() ? 'text.inverse' : 'text.muted'}
                />
              )}
            </Pressable>
          </View>

              {/* Privacy Disclaimer */}
              <View style={{ marginTop: spacing.s12, alignItems: 'center' }}>
                <Text style={{ color: muted, fontSize: 11, textAlign: 'center' }}>
                  Powered by Claude •{' '}
                  <Pressable
                    onPress={() => nav.navigate('AIPrivacyInfo')}
                    style={{ paddingHorizontal: spacing.s4 }}
                  >
                    <Text style={{ color: accent, fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' }}>
                      See how your data is handled
                    </Text>
                  </Pressable>
                </Text>
              </View>
            </LinearGradient>
          </View>
          </View>
        </KeyboardAvoidingView>
    </SafeAreaView>
    </Animated.View>
  );
}
