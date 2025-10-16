import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const tabBarBorderColor =
    (get('border.subtle') as string) ?? (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(180,196,255,0.35)');
  const tabBarBackground = (get('surface.primary') as string) ?? (isDark ? '#131420' : '#FFFFFF');

  const tabBarStyle = React.useMemo(
    () => ({
      paddingTop: 10,
      paddingBottom: Math.max(insets.bottom, 12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tabBarBorderColor,
      backgroundColor: tabBarBackground,
      height: 64 + insets.bottom,
      elevation: 8,
      shadowColor: '#000000',
      shadowOpacity: isDark ? 0.18 : 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -1 },
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
