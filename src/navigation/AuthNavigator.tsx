import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../screens/auth/Login';
import Signup from '../screens/auth/Signup';
import Forgot from '../screens/auth/Forgot';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  Forgot: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Signup" component={Signup} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Forgot" component={Forgot} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}