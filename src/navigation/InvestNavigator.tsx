import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Invest as InvestHome,
  AddLot,
  EditWatchlist,
  EditLot,
  HoldingHistory,
  DCAPlanner,
  PortfolioDetail,
  CreatePortfolio,
} from '../features/invest';
import Search from '../screens/Search';
import CashManagement from '../screens/CashManagement';

const Stack = createNativeStackNavigator();

export default function InvestNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InvestHome" component={InvestHome} />
      <Stack.Screen name="PortfolioDetail" component={PortfolioDetail} />
      <Stack.Screen name="CreatePortfolio" component={CreatePortfolio} />
      <Stack.Screen name="AddLot" component={AddLot} options={{ presentation: 'modal' }} />
      <Stack.Screen name="HoldingHistory" component={HoldingHistory} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CashManagement" component={CashManagement} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Search" component={Search} />
      <Stack.Screen name="EditWatchlist" component={EditWatchlist} />
      <Stack.Screen name="EditLot" component={EditLot} />
      <Stack.Screen name="DCAPlanner" component={DCAPlanner} />
    </Stack.Navigator>
  );
}
