import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const { accounts } = useAccountsStore();
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

  // Load persisted messages on mount
  React.useEffect(() => {
    const loadMessages = async () => {
      try {
        const stored = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setMessages(parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
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
  const bg = get('surface.base') as string;
  const surface1 = get('surface.level1') as string;
  const surface2 = get('surface.level2') as string;
  const accent = get('accent.primary') as string;
  const border = get('border.subtle') as string;

  const sendMessage = async (messageText?: string) => {
    const questionText = messageText || input.trim();
    if (!questionText || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: questionText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Scroll to bottom after user message
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

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

      setMessages(prev => [...prev, assistantMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

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
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  // Get most commonly used accounts for suggestions
  // Only include cash, checking, savings, and credit accounts (exclude retirement, investment, etc.)
  const suggestedAccounts = React.useMemo(() => {
    const { transactions } = useTxStore.getState();

    // Filter to only transaction-eligible accounts
    const eligibleAccounts = accounts.filter(a =>
      a.kind === 'cash' ||
      a.kind === 'checking' ||
      a.kind === 'savings' ||
      a.kind === 'credit'
    );

    // Count account usage in recent transactions (by account name)
    const accountUsage: Record<string, number> = {};
    (transactions || []).slice(0, 100).forEach(tx => {
      if (tx.account) {
        // Only count if it's an eligible account
        const isEligible = eligibleAccounts.find(a => a.name === tx.account);
        if (isEligible) {
          accountUsage[tx.account] = (accountUsage[tx.account] || 0) + 1;
        }
      }
    });

    // Sort by usage and get top 2 (accountName is the key)
    const sortedAccounts = Object.entries(accountUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([accountName]) => eligibleAccounts.find(a => a.name === accountName))
      .filter(Boolean);

    // If less than 2, add default accounts (checking first, then credit, then cash)
    if (sortedAccounts.length < 2) {
      const checking = eligibleAccounts.find(a => a.kind === 'checking');
      const credit = eligibleAccounts.find(a => a.kind === 'credit');
      const cash = eligibleAccounts.find(a => a.kind === 'cash');

      if (checking && !sortedAccounts.find(a => a?.name === checking.name)) {
        sortedAccounts.push(checking);
      }
      if (credit && !sortedAccounts.find(a => a?.name === credit.name) && sortedAccounts.length < 2) {
        sortedAccounts.push(credit);
      }
      if (cash && !sortedAccounts.find(a => a?.name === cash.name) && sortedAccounts.length < 2) {
        sortedAccounts.push(cash);
      }
    }

    return sortedAccounts.slice(0, 2);
  }, [accounts]);

  const handleConfirmTransaction = async (data: TransactionData | PortfolioTransactionData) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

        // Add success message
        const successMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `✅ Transaction added: $${txData.amount?.toFixed(2)}${txData.merchant ? ' at ' + txData.merchant : ''}. Check your Spending tab!`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMsg]);
      } catch (error) {
        console.error('[AIAssistant] Error adding transaction:', error);
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: '❌ Failed to add transaction. Please try again.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMsg]);
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
        setMessages(prev => [...prev, successMsg]);
      }
    }

    setPendingConfirmation(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleCancelTransaction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const cancelMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: "Transaction cancelled. Feel free to ask me anything else!",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, cancelMsg]);
    setPendingConfirmation(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    const isCached = item.metadata?.cached;
    const hasUsage = item.metadata?.usage;
    const isLastMessage = index === messages.length - 1;
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
          <View
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
            <Text style={{ color: isUser ? '#FFFFFF' : text, fontSize: 15, lineHeight: 22 }}>
              {item.text}
            </Text>
          </View>
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
              suggestedAccounts={suggestedAccounts}
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
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
        {/* Header - No Card */}
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
                AI Assistant
              </Text>
              <Text style={{ color: muted, fontSize: 13, marginTop: spacing.s4 }}>
                Ask about your spending and portfolio
              </Text>
            </View>
            {messages.length > 0 && (
              <Pressable
                onPress={handleClearChat}
                style={({ pressed }) => ({
                  padding: spacing.s8,
                  marginRight: -spacing.s8,
                  marginTop: -spacing.s4,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? surface1 : 'transparent',
                })}
                hitSlop={8}
              >
                <Icon name="trash" size={22} colorToken="text.primary" />
              </Pressable>
            )}
          </View>
        </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.s16,
            paddingBottom: spacing.s24,
          }}
          ListFooterComponent={
            isLoading ? (
              <View
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '80%',
                  marginBottom: spacing.s16,
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
          ListHeaderComponent={
            showWelcome ? (
              <View style={{ marginBottom: spacing.s20 }}>
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

        {/* Floating Input Area */}
        <View
          style={{
            paddingHorizontal: spacing.s16,
            paddingVertical: spacing.s12,
            paddingBottom: Platform.OS === 'ios' ? spacing.s24 : spacing.s12,
          }}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </Animated.View>
  );
}
