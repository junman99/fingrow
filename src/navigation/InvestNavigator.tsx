import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Invest as InvestHome } from '../screens/Invest';
import { Instrument } from '../screens/Instrument';
import { AddLot } from '../screens/AddLot';
import Search from '../screens/Search';
import EditWatchlist from '../screens/EditWatchlist';
import EditLot from '../screens/EditLot';
import HoldingHistory from '../screens/HoldingHistory';

const Stack = createNativeStackNavigator();

export default function InvestNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InvestHome" component={InvestHome} />
      <Stack.Screen name="Instrument" component={Instrument} />
      <Stack.Screen name="AddLot" component={AddLot} options={{ presentation: 'modal' }} />
      <Stack.Screen name="HoldingHistory" component={HoldingHistory} />
      <Stack.Screen name="Search" component={Search} />
      <Stack.Screen name="EditWatchlist" component={EditWatchlist} />
      <Stack.Screen name="EditLot" component={EditLot} />
    </Stack.Navigator>
  );
}
