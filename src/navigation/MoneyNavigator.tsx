import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Money from '../screens/Money';
import AddAccount from '../screens/AddAccount';
import AccountDetail from '../screens/AccountDetail';
import AccountSettings from '../screens/AccountSettings';
import AccountsList from '../screens/AccountsList';
import AddDebt from '../screens/AddDebt';
import DebtDetail from '../screens/DebtDetail';
import DebtsList from '../screens/DebtsList';
import PayoffSimulator from '../screens/PayoffSimulator';
import PaycheckBreakdown from '../screens/PaycheckBreakdown';
import PaycheckSetup from '../screens/PaycheckSetup';
import PaycheckSettings from '../screens/PaycheckSettings';
import PaycheckHistory from '../screens/PaycheckHistory';
import BillsList from '../screens/BillsList';
import InvestmentsList from '../screens/InvestmentsList';
import PortfolioList from '../screens/PortfolioList';
import SelectInstitution from '../screens/SelectInstitution';
import SelectAccountType from '../screens/SelectAccountType';
import PayCreditCard from '../screens/PayCreditCard';

const Stack = createNativeStackNavigator();

export default function MoneyNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="MoneyHome" component={Money} />
      <Stack.Screen name="AddAccount" component={AddAccount} />
      <Stack.Screen name="AccountDetail" component={AccountDetail} />
      <Stack.Screen name="AccountSettings" component={AccountSettings} />
      <Stack.Screen
        name="AccountsList"
        component={AccountsList}
        options={{
          animation: 'default',
        }}
      />
      <Stack.Screen name="AddDebt" component={AddDebt} />
      <Stack.Screen name="DebtDetail" component={DebtDetail} />
      <Stack.Screen
        name="DebtsList"
        component={DebtsList}
        options={{
          animation: 'default',
        }}
      />
      <Stack.Screen name="PayoffSimulator" component={PayoffSimulator} />
      <Stack.Screen
        name="PaycheckBreakdown"
        component={PaycheckBreakdown}
        options={{
          animation: 'slide_from_right',
          animationDuration: 200,
        }}
      />
      <Stack.Screen name="PaycheckSetup" component={PaycheckSetup} />
      <Stack.Screen name="PaycheckSettings" component={PaycheckSettings} />
      <Stack.Screen name="PaycheckHistory" component={PaycheckHistory} />
      <Stack.Screen
        name="BillsList"
        component={BillsList}
        options={{
          animation: 'default',
        }}
      />
      <Stack.Screen
        name="InvestmentsList"
        component={InvestmentsList}
        options={{
          animation: 'default',
        }}
      />
      <Stack.Screen
        name="PortfolioList"
        component={PortfolioList}
        options={{
          animation: 'default',
        }}
      />
      <Stack.Screen name="SelectInstitution" component={SelectInstitution} />
      <Stack.Screen name="SelectAccountType" component={SelectAccountType} />
      <Stack.Screen name="PayCreditCard" component={PayCreditCard} />
    </Stack.Navigator>
  );
}
