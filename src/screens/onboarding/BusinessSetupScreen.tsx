import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton } from "../../components/AppButton";
import { AppCard, AppHeader, AppInput } from "../../components/ui";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { createBusinessWithFirstStore } from "../../services/businessCloudService";
import { pullFullSalesDataFromCloud } from "../../services/salesCloudRestoreService";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = NativeStackScreenProps<RootStackParamList, "BusinessSetup">;

export function BusinessSetupScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const user = useAuthStore((state) => state.user);

  const [businessName, setBusinessName] = useState("My Dukan");
  const [storeName, setStoreName] = useState("Main Store");
  const [address, setAddress] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateBusiness() {
    setError("");

    if (!user) {
      setError("Login session missing. Please login again.");
      return;
    }

    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }

    if (!storeName.trim()) {
      setError("Store name is required.");
      return;
    }

    try {
      setSaving(true);

      await createBusinessWithFirstStore(user, {
        businessName,
        storeName,
        address,
      });

      await pullFullSalesDataFromCloud(user);

      navigation.reset({
        index: 0,
        routes: [{ name: "Dashboard" }],
      });
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Failed to create business."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppHeader
            eyebrow="Business setup"
            title="Setup your shop"
            subtitle="Create your business and first store. This becomes the cloud owner record for your Supabase data."
          />

          <AppCard style={styles.card}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Business details</Text>

            <AppInput
              label="Business name"
              placeholder="Example: Arham General Store"
              value={businessName}
              onChangeText={setBusinessName}
            />

            <AppInput
              label="First store name"
              placeholder="Example: Main Store"
              value={storeName}
              onChangeText={setStoreName}
            />

            <AppInput
              label="Store address"
              placeholder="Example: Main bazaar"
              value={address}
              onChangeText={setAddress}
            />

            <View style={[styles.infoBox, { backgroundColor: theme.cardMuted, borderColor: theme.border }]}>
              <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>Default setup</Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>Currency: PKR</Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>Country: Pakistan</Text>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>Your role: Owner</Text>
            </View>

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            <AppButton
              title={saving ? "Creating business..." : "Create business"}
              onPress={handleCreateBusiness}
            />
          </AppCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  wrapper: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  card: {
    marginTop: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 4,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
});
