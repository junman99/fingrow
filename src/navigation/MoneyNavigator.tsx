import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Money from '../screens/Money';
import AddAccount from '../screens/AddAccount';
import AccountDetail from '../screens/AccountDetail';
import AddDebt from '../screens/AddDebt';
import DebtDetail from '../screens/DebtDetail';
import DCAPlanner from '../screens/DCAPlanner';
import PayoffSimulator from '../screens/PayoffSimulator';

const Stack = createNativeStackNavigator();

export default function MoneyNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoneyHome" component={Money} />
      <Stack.Screen name="AddAccount" component={AddAccount} />
      <Stack.Screen name="AccountDetail" component={AccountDetail} />
          <Stack.Screen name="AddDebt" component={AddDebt} />
      <Stack.Screen name="DebtDetail" component={DebtDetail} />
      <Stack.Screen name="DCAPlanner" component={DCAPlanner} />
      <Stack.Screen name="PayoffSimulator" component={PayoffSimulator} />
    </Stack.Navigator>
  );
}
