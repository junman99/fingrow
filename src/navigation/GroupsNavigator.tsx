import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GroupsRoot from '../screens/groups/GroupsRoot';
import GroupDetail from '../screens/groups/GroupDetail';
import AddMember from '../screens/groups/AddMember';
import AddBill from '../screens/groups/AddBill';
import EditBill from '../screens/groups/EditBill';
import CreateGroup from '../screens/groups/CreateGroup';
import BillDetails from '../screens/groups/BillDetails';
import SettleUp from '../screens/groups/SettleUp';
import GroupReminders from '../screens/groups/GroupReminders';
import ManageMembers from '../screens/groups/ManageMembers';

export type GroupsStackParamList = {
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
};

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export default function GroupsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GroupsRoot" component={GroupsRoot} />
      <Stack.Screen name="GroupDetail" component={GroupDetail} />
      <Stack.Screen name="AddMember" component={AddMember} options={{ presentation: 'modal' }} />
      <Stack.Screen name="AddBill" component={AddBill} options={{ presentation: 'modal' }} />
      <Stack.Screen name="EditBill" component={EditBill} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroup} options={{ presentation: 'modal' }} />
      <Stack.Screen name="BillDetails" component={BillDetails} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SettleUp" component={SettleUp} options={{ presentation: 'modal' }} />
      <Stack.Screen name="GroupReminders" component={GroupReminders} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ManageMembers" component={ManageMembers} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
