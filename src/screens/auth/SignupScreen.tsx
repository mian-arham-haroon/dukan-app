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
import { ensureCloudProfile } from "../../services/businessCloudService";
import { isSupabaseConfigured, supabase } from "../../services/supabase";
import { useAuthStore } from "../../store/authStore";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const setSession = useAuthStore((state) => state.setSession);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSignup() {
    setError("");
    setSuccessMessage("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add your .env values first.");
      return;
    }

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName) {
      setError("Full name is required.");
      return;
    }

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      if (data.session) {
        setSession(data.session);
        await ensureCloudProfile(data.session.user);

        navigation.reset({
          index: 0,
          routes: [{ name: "BusinessSetup" }],
        });

        return;
      }

      setSuccessMessage(
        "Account created. Check your email to confirm the account, then login."
      );
    } catch (signupError) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Failed to create account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <AppHeader
            eyebrow="Account setup"
            title="Create Account"
            subtitle="Create your owner account. After confirmation, you will setup business and store."
          />

          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Business owner details</Text>

            <AppInput
              label="Full name"
              placeholder="Example: Arham"
              value={fullName}
              onChangeText={setFullName}
            />

            <AppInput
              label="Email"
              placeholder="owner@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />

            <AppInput
              label="Password"
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {successMessage ? (
              <Text style={styles.successText}>{successMessage}</Text>
            ) : null}

            {!isSupabaseConfigured ? (
              <Text style={styles.warningText}>
                Supabase env values are missing. Add EXPO_PUBLIC_SUPABASE_URL
                and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
              </Text>
            ) : null}

            <AppButton
              title={loading ? "Creating account..." : "Create account"}
              onPress={handleSignup}
            />

            <View style={styles.spacer} />

            <AppButton
              title="Back to Login"
              variant="secondary"
              onPress={() => navigation.navigate("Login")}
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
    maxWidth: 440,
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
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  warningText: {
    color: "#92400E",
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 14,
  },
  spacer: {
    height: 10,
  },
});