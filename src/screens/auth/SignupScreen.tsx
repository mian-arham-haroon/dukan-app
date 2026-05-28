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
import { useAppTheme } from "../../theme/useAppTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
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
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.wrapper}>
          <View style={styles.hero}>
            <View style={[styles.brandMark, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.brandMarkText, { color: theme.primary }]}>D</Text>
            </View>

            <AppHeader
              eyebrow="Account setup"
              title="Create Account"
              subtitle="Create your owner account. After confirmation, you will setup business and store."
            />
          </View>

          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Business owner details
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Use the owner email you want connected with this business.
              </Text>
            </View>

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

            {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

            {successMessage ? (
              <Text style={[styles.successText, { color: theme.success }]}>{successMessage}</Text>
            ) : null}

            {!isSupabaseConfigured ? (
              <Text style={[styles.warningText, { backgroundColor: theme.warningSoft, borderColor: theme.warning, color: theme.warning }]}>
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
    padding: 22,
    justifyContent: "center",
  },
  wrapper: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  hero: {
    marginBottom: 6,
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  brandMarkText: {
    fontSize: 28,
    fontWeight: "900",
  },
  card: {
    marginTop: 14,
  },
  cardHeader: {
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  successText: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 14,
  },
  warningText: {
    borderWidth: 1,
    borderRadius: 14,
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
