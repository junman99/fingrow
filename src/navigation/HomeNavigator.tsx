import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home as Spending } from '../screens/Spending';
import { Budgets } from '../screens/Budgets';
import { Insights } from '../screens/Insights';
import { Report } from '../screens/Report';
import { Transactions } from '../screens/Transactions';
import BudgetSettings from '../screens/BudgetSettings';
import CategoryInsights from '../screens/CategoryInsights';
import CategoryTransactions from '../screens/CategoryTransactions';
import UpcomingBills from '../screens/UpcomingBills';
import {
  GroupsRoot,
  GroupDetail,
  AddMember,
  AddBill,
  EditBill,
  CreateGroup,
  BillDetails,
  SettleUp,
  GroupReminders,
  ManageMembers,
  EditGroup,
  AddReminder,
} from '../features/groups';

export type HomeStackParamList = {
  HomeRoot: undefined;
  BudgetsRoot: undefined;
  BudgetSettings: undefined;
  CategoryInsights: undefined;
  CategoryTransactions: { category: string };
  UpcomingBills: undefined;
  InsightsRoot: undefined;
  Report: { selectedMonth: Date };
  HistoryRoot: undefined;
  GroupsRoot: undefined;
  GroupDetail: { groupId: string };
  AddMember: { groupId: string; memberId?: string; archiveToggle?: boolean };
  AddBill: { groupId: string };
  EditBill: { groupId: string; billId: string };
  CreateGroup: undefined;
  BillDetails: { groupId: string; billId: string };
  SettleUp: { groupId: string };
  GroupReminders: { groupId: string };
  ManageMembers: { groupId: string };
  EditGroup: { groupId: string };
  AddReminder: { groupId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="HomeRoot" component={Spending} />
      <Stack.Screen
        name="BudgetsRoot"
        component={Budgets}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="BudgetSettings"
        component={BudgetSettings}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="CategoryInsights"
        component={CategoryInsights}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="CategoryTransactions"
        component={CategoryTransactions}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="UpcomingBills"
        component={UpcomingBills}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="InsightsRoot"
        component={Insights}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Report"
        component={Report}
        options={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="HistoryRoot"
        component={Transactions}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="GroupsRoot"
        component={GroupsRoot}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetail}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen name="AddMember" component={AddMember} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AddBill" component={AddBill} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditBill" component={EditBill} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroup} options={{ presentation: 'modal' }} />
      <Stack.Screen name="BillDetails" component={BillDetails} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SettleUp" component={SettleUp} options={{ presentation: 'modal' }} />
      <Stack.Screen name="GroupReminders" component={GroupReminders} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ManageMembers" component={ManageMembers} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditGroup" component={EditGroup} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AddReminder" component={AddReminder} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
