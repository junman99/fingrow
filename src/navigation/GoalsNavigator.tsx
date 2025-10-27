import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GoalsRoot from '../screens/goals/GoalsRoot';
import GoalCreate from '../screens/goals/GoalCreate';
import GoalDetail from '../screens/goals/GoalDetail';

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
