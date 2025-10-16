import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Home } from '../screens/Home';
import { Transactions } from '../screens/Transactions';
import { Budgets } from '../screens/Budgets';
import BillsList from '../screens/BillsList';
import BillEditor from '../screens/BillEditor';
import EnvelopesEditor from '../screens/EnvelopesEditor';
import { Insights } from '../screens/Insights';
import Settings from '../screens/Settings';
import Profile from '../screens/Profile';
import ProfileEdit from '../screens/ProfileEdit';
import GroupsNavigator from './GroupsNavigator';
import MoneyNavigator from './MoneyNavigator';
import GoalsNavigator from './GoalsNavigator';
import InvestNavigator from './InvestNavigator';
import Add from '../screens/Add';
import { useTheme, useThemeTokens } from '../theme/ThemeProvider';
import Icon from '../components/Icon';

enableScreens();

const Tab = createBottomTabNavigator();

function BottomTabs() {
  const { get, isDark } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const tabBarRadius = 28;
  const bottomOffset = Math.max(insets.bottom, 18);
  const tabBarBorderColor = (get('border.subtle') as string) ?? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(180,196,255,0.35)');
  const baseGlassColors = isDark
    ? ['rgba(42,46,64,0.58)', 'rgba(20,22,35,0.62)']
    : ['rgba(255,255,255,0.72)', 'rgba(233,241,255,0.62)'];
  const specularOverlayColors = isDark
    ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'];
  const edgeGlowColors = isDark
    ? ['rgba(0,0,0,0)', 'rgba(18,19,33,0.45)']
    : ['rgba(0,0,0,0)', 'rgba(171,194,255,0.32)'];
  const rimLightColors = isDark
    ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.15)']
    : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.28)'];
  const tintOverlayColor = isDark ? 'rgba(24,26,36,0.52)' : 'rgba(255,255,255,0.55)';
  const blurIntensity = isDark ? 70 : 98;
  const topHighlightColors = isDark
    ? ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']
    : ['rgba(255,255,255,0.58)', 'rgba(255,255,255,0)'];

  const tabBarStyle = React.useMemo(
    () => ({
      position: 'absolute' as const,
      left: 16,
      right: 16,
      bottom: bottomOffset,
      paddingTop: 12,
      paddingBottom: Math.max(insets.bottom - 6, 12),
      borderRadius: tabBarRadius,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      height: 66 + insets.bottom,
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.25 : 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    }),
    [bottomOffset, insets.bottom, isDark, tabBarRadius],
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: get('accent.primary') as string,
        tabBarInactiveTintColor: get('icon.default') as string,
        tabBarStyle,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <View style={[styles.tabBarBackground, { borderRadius: tabBarRadius }]}>
            <BlurView
              intensity={blurIntensity}
              tint={isDark ? 'dark' : 'light'}
              style={[StyleSheet.absoluteFill, { borderRadius: tabBarRadius }]}
            />
            <LinearGradient
              colors={baseGlassColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: tabBarRadius,
                  backgroundColor: tintOverlayColor,
                },
              ]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={topHighlightColors}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.tabBarTopHighlight, { borderRadius: tabBarRadius }]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={specularOverlayColors}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[styles.tabBarSheen, { borderRadius: tabBarRadius - 8 }]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={edgeGlowColors}
              start={{ x: 0.5, y: 0.15 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.tabBarGlow, { borderRadius: tabBarRadius }]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={rimLightColors}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.tabBarEdgeFade, { borderRadius: tabBarRadius }]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.tabBarBorder,
                {
                  borderRadius: tabBarRadius,
                  borderColor: tabBarBorderColor,
                },
              ]}
            />
          </View>
        ),
        tabBarIcon: ({ focused }) => (
          <Icon
            name={route.name === 'Home' ? 'receipt' : route.name === 'Money' ? 'wallet' : route.name === 'Invest' ? 'trending-up' : 'settings'}
            size={22}
            colorToken={focused ? 'accent.primary' : 'icon.default'}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={Home} options={{ tabBarLabel: 'Spending' }} />
      <Tab.Screen name="Money" component={MoneyNavigator} options={{ tabBarLabel: 'Money' }} />
      <Tab.Screen name="Invest" component={InvestNavigator} />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    flex: 1,
    overflow: 'hidden',
  },
  tabBarTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 40,
    opacity: 0.75,
  },
  tabBarSheen: {
    position: 'absolute',
    top: -18,
    left: 18,
    right: 18,
    height: 92,
    opacity: 0.82,
  },
  tabBarGlow: {
    position: 'absolute',
    bottom: -24,
    left: 12,
    right: 12,
    height: 60,
  },
  tabBarEdgeFade: {
    ...StyleSheet.absoluteFillObject,
  },
  tabBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabBarItem: {
    paddingVertical: 0,
  },
  tabBarLabel: {
    marginBottom: 0,
    fontSize: 12,
    fontWeight: '600',
  },
});

type RootParamList = {
  Tabs: undefined;
  Groups: undefined;
  Goals: undefined;
  TransactionsModal: undefined;
  Add: undefined;
  BudgetModal: undefined;
  InsightsModal: undefined;
  ProfileModal: undefined;
  ProfileEdit: undefined;
  Bills: undefined;
  BillEditor: undefined;
  Envelopes: undefined;
};

const Root = createNativeStackNavigator<RootParamList>();

export default function RootNavigator() {
  const { navTheme } = useTheme();
  return (
    <NavigationContainer theme={navTheme}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        <Root.Screen name="Tabs" component={BottomTabs} />
        <Root.Screen name="Groups" component={GroupsNavigator} options={{ presentation: 'modal' }} />
        <Root.Screen name="Goals" component={GoalsNavigator} options={{ presentation: 'modal' }} />
        <Root.Screen name="TransactionsModal" component={Transactions} options={{ presentation: 'modal' }} />
        <Root.Screen name="Add" component={Add} options={{ presentation: 'modal' }} />
        <Root.Screen name="BudgetModal" component={Budgets} options={{ presentation: 'modal' }} />
        <Root.Screen name="InsightsModal" component={Insights} options={{ presentation: 'modal' }} />
        <Root.Screen name="ProfileModal" component={Profile} options={{ presentation: 'modal' }} />
        <Root.Screen name="ProfileEdit" component={ProfileEdit} options={{ presentation: 'modal' }} />
        <Root.Screen name="Bills" component={BillsList} options={{ presentation: 'modal', headerShown: false }} />
        <Root.Screen name="BillEditor" component={BillEditor} options={{ presentation: 'modal', headerShown: false }} />
        <Root.Screen name="Envelopes" component={EnvelopesEditor} options={{ presentation: 'modal', headerShown: false }} />
      </Root.Navigator>
    </NavigationContainer>
  );
}
