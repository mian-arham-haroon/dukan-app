import { ReportsScreen } from "../screens/modules/ReportsScreen";
import React from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../theme/useAppTheme";

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

export function RootNavigator() {
  const { theme, mode } = useAppTheme();

  const navigationTheme = {
    ...(mode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.surface,
      text: theme.textPrimary,
      border: theme.border,
      primary: theme.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: {
            fontWeight: "700",
            color: theme.textPrimary,
          },
          contentStyle: {
            backgroundColor: theme.background,
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
