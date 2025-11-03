import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Transactions } from '../screens/Transactions';
import BillsModal from '../screens/BillsModal';
import BillEditor from '../screens/BillEditor';
import EnvelopesEditor from '../screens/EnvelopesEditor';
import { Insights } from '../screens/Insights';
import Settings from '../screens/Settings';
import Profile from '../screens/Profile';
import ProfileEdit from '../screens/ProfileEdit';
import Achievements from '../screens/Achievements';
import HomeNavigator from './HomeNavigator';
import MoneyNavigator from './MoneyNavigator';
import GoalsNavigator from './GoalsNavigator';
import InvestNavigator from './InvestNavigator';
import Add from '../screens/Add';
import EditTransaction from '../screens/EditTransaction';
import AIAssistant from '../screens/AIAssistant';
import AIPrivacyInfo from '../screens/AIPrivacyInfo';
import FloatingAIButton from '../components/FloatingAIButton';
import { useTheme, useThemeTokens } from '../theme/ThemeProvider';
import Icon from '../components/Icon';

enableScreens();

const Tab = createBottomTabNavigator();

function BottomTabs() {
  const { get, isDark } = useThemeTokens();
  const insets = useSafeAreaInsets();
  const tabBarBorderColor = get('border.subtle') as string;
  const tabBarBackground = get('surface.level1') as string;

  const tabBarStyle = React.useMemo(
    () => ({
      paddingTop: 7,
      paddingBottom: Math.max(insets.bottom, 8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tabBarBorderColor,
      backgroundColor: tabBarBackground,
      height: 45 + insets.bottom,
      elevation: 0,
      shadowColor: isDark ? '#000000' : '#2D2424',
      shadowOpacity: isDark ? 0.15 : 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -2 },
    }),
    [insets.bottom, isDark, tabBarBackground, tabBarBorderColor],
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
        tabBarIcon: ({ focused }) => (
          <View style={{ marginBottom: -2 }}>
            <Icon
              name={route.name === 'Home' ? 'receipt' : route.name === 'Money' ? 'wallet' : route.name === 'Goals' ? 'target' : route.name === 'Invest' ? 'trending-up' : 'settings'}
              size={22}
              colorToken={focused ? 'accent.primary' : 'icon.default'}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeNavigator} options={{ tabBarLabel: 'Spending' }} />
      <Tab.Screen name="Money" component={MoneyNavigator} options={{ tabBarLabel: 'Money' }} />
      <Tab.Screen name="Goals" component={GoalsNavigator} options={{ tabBarLabel: 'Goals' }} />
      <Tab.Screen name="Invest" component={InvestNavigator} />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
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
  TransactionsModal: undefined;
  Add: undefined;
  EditTransaction: { id: string };
  InsightsModal: undefined;
  AchievementsModal: undefined;
  ProfileModal: undefined;
  ProfileEdit: undefined;
  Bills: undefined;
  BillEditor: undefined;
  Envelopes: undefined;
  AIAssistant: undefined;
  AIPrivacyInfo: undefined;
};

const Root = createNativeStackNavigator<RootParamList>();

export default function RootNavigator() {
  const { navTheme } = useTheme();
  return (
    <NavigationContainer theme={navTheme}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        <Root.Screen name="Tabs" component={BottomTabs} />
        <Root.Screen name="TransactionsModal" component={Transactions} options={{ presentation: 'modal' }} />
        <Root.Screen name="Add" component={Add} options={{ presentation: 'modal' }} />
        <Root.Screen name="EditTransaction" component={EditTransaction} options={{ presentation: 'modal' }} />
        <Root.Screen name="InsightsModal" component={Insights} options={{ presentation: 'modal' }} />
        <Root.Screen name="AchievementsModal" component={Achievements} options={{ presentation: 'modal' }} />
        <Root.Screen name="ProfileModal" component={Profile} options={{ presentation: 'modal' }} />
        <Root.Screen name="ProfileEdit" component={ProfileEdit} options={{ presentation: 'modal' }} />
        <Root.Screen name="Bills" component={BillsModal} options={{ presentation: 'modal', headerShown: false }} />
        <Root.Screen name="BillEditor" component={BillEditor} options={{ presentation: 'modal', headerShown: false }} />
        <Root.Screen name="Envelopes" component={EnvelopesEditor} options={{ presentation: 'modal', headerShown: false }} />
        <Root.Screen name="AIAssistant" component={AIAssistant} options={{ presentation: 'modal', headerShown: false }} />
        <Root.Screen name="AIPrivacyInfo" component={AIPrivacyInfo} options={{ presentation: 'modal', headerShown: false }} />
      </Root.Navigator>

      {/* Global Floating AI Button */}
      <FloatingAIButton />
    </NavigationContainer>
  );
}
