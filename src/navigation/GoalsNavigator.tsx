import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GoalsRoot, GoalCreate, GoalDetail } from '../features/goals';

export type GoalsStackParamList = {
  GoalsRoot: undefined;
  GoalCreate: { type?: 'milestone' | 'networth' };
  GoalDetail: { goalId: string; mode?: 'journey' | 'add' };
};

const Stack = createNativeStackNavigator<GoalsStackParamList>();

export default function GoalsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GoalsRoot" component={GoalsRoot} />
      <Stack.Screen name="GoalCreate" component={GoalCreate} options={{ presentation: 'modal' }} />
      <Stack.Screen name="GoalDetail" component={GoalDetail} />
    </Stack.Navigator>
  );
}
