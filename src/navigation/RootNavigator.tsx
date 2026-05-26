import { ReportsScreen } from "../screens/modules/ReportsScreen";
import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { DashboardScreen } from "../screens/dashboard/DashboardScreen";
import { ProductsScreen } from "../screens/modules/ProductsScreen";
import { CustomersScreen } from "../screens/modules/CustomersScreen";
import { InvoicesScreen } from "../screens/modules/InvoicesScreen";
import { InvoiceDetailScreen } from "../screens/modules/InvoiceDetailScreen";
import { InvoiceReturnScreen } from "../screens/modules/InvoiceReturnScreen";
import { UdhaarScreen } from "../screens/modules/UdhaarScreen";
import { ExpensesScreen } from "../screens/modules/ExpensesScreen";
import { SettingsScreen } from "../screens/modules/SettingsScreen";
import { BusinessSetupScreen } from "../screens/onboarding/BusinessSetupScreen";

export type ModuleRouteName =
  | "Products"
  | "Customers"
  | "Invoices"
  | "Udhaar"
  | "Expenses"
  | "Settings";

export type RootStackParamList = {
  Login: undefined;
  Reports: undefined;
  Signup: undefined;
  BusinessSetup: undefined;
  Dashboard: undefined;
  Products: undefined;
  Customers: undefined;
  Invoices: undefined;
  InvoiceDetail: { invoiceId: string };
  InvoiceReturn: {
    invoiceId: string;
    localId?: string;
    invoiceNo?: string;
  };
  Udhaar: undefined;
  Expenses: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#F8FAFC",
    card: "#FFFFFF",
    text: "#0F172A",
    border: "#E2E8F0",
    primary: "#2563EB",
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={AppTheme}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: "#FFFFFF",
          },
          headerTintColor: "#0F172A",
          headerTitleStyle: {
            fontWeight: "700",
          },
          contentStyle: {
            backgroundColor: "#F8FAFC",
          },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{ title: "Create Account" }}
        />

        <Stack.Screen
          name="BusinessSetup"
          component={BusinessSetupScreen}
          options={{
            title: "Business Setup",
            headerBackVisible: false,
          }}
        />

        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Dukan Dashboard" }}
        />

        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={{ title: "Reports" }}
        />

        <Stack.Screen
          name="Products"
          component={ProductsScreen}
          options={{ title: "Products" }}
        />

        <Stack.Screen
          name="Customers"
          component={CustomersScreen}
          options={{ title: "Customers" }}
        />

        <Stack.Screen
          name="Invoices"
          component={InvoicesScreen}
          options={{ title: "Invoices" }}
        />

        <Stack.Screen
          name="InvoiceDetail"
          component={InvoiceDetailScreen}
          options={{ title: "Invoice Detail" }}
        />

        <Stack.Screen
          name="InvoiceReturn"
          component={InvoiceReturnScreen}
          options={{ title: "Return / Refund" }}
        />

        <Stack.Screen
          name="Udhaar"
          component={UdhaarScreen}
          options={{ title: "Udhaar" }}
        />

        <Stack.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={{ title: "Expenses" }}
        />

        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: "Settings" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}