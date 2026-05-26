import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";
import { ModulePlaceholderScreen } from "../screens/main/ModulePlaceholderScreen";

export type AppStackParamList = {
  Login: undefined;
  Signup: undefined;
  Dashboard: undefined;
  Products: undefined;
  Customers: undefined;
  Invoices: undefined;
  Udhaar: undefined;
  Expenses: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Dukan App" }}
        />

        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ title: "Create Account" }}
        />

        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Dukan Dashboard" }}
        />

        <Stack.Screen
          name="Products"
          component={ModulePlaceholderScreen}
          options={{ title: "Products" }}
        />

        <Stack.Screen
          name="Customers"
          component={ModulePlaceholderScreen}
          options={{ title: "Customers" }}
        />

        <Stack.Screen
          name="Invoices"
          component={ModulePlaceholderScreen}
          options={{ title: "Invoices" }}
        />

        <Stack.Screen
          name="Udhaar"
          component={ModulePlaceholderScreen}
          options={{ title: "Udhaar" }}
        />

        <Stack.Screen
          name="Expenses"
          component={ModulePlaceholderScreen}
          options={{ title: "Expenses" }}
        />

        <Stack.Screen
          name="Settings"
          component={ModulePlaceholderScreen}
          options={{ title: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}