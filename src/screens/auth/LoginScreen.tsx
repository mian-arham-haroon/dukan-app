import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";

import { AppButton } from "../../components/AppButton";
import { AppCard, AppHeader, AppInput } from "../../components/ui";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { getUserBusinessContext } from "../../services/businessCloudService";
import { pullFullSalesDataFromCloud } from "../../services/salesCloudRestoreService";
import { isSupabaseConfigured, supabase } from "../../services/supabase";
import { useAuthStore } from "../../store/authStore";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { theme } = useAppTheme();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [error, setError] = useState("");

  async function routeAfterAuth(session: Session) {
    setSession(session);

    const context = await getUserBusinessContext(session.user);

    if (context.business) {
      await pullFullSalesDataFromCloud(session.user);
    }

    navigation.reset({
      index: 0,
      routes: [
        {
          name: context.business ? "Dashboard" : "BusinessSetup",
        },
      ],
    });
  }

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!mounted) {
          return;
        }

        if (data.session) {
          await routeAfterAuth(data.session);
        }
      } catch {
        // Keep login screen usable if session restore fails.
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    }

    restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin() {
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add your .env values first.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.session) {
        setError("Login failed. No session was returned.");
        return;
      }

      await routeAfterAuth(data.session);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Failed to login."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={styles.centerBox}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Checking session...</Text>
        </View>
      </SafeAreaView>
    );
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
              eyebrow="Offline first small business app"
              title="Dukan App"
              subtitle="Login with Supabase Auth. Business and store setup comes before cloud sync."
            />
          </View>

          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Login</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Continue to your shop workspace.
              </Text>
            </View>

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

            {!isSupabaseConfigured ? (
              <Text style={[styles.warningText, { backgroundColor: theme.warningSoft, borderColor: theme.warning, color: theme.warning }]}>
                Supabase env values are missing. Add EXPO_PUBLIC_SUPABASE_URL
                and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
              </Text>
            ) : null}

            <AppButton
              title={loading ? "Logging in..." : "Login"}
              onPress={handleLogin}
            />

            <View style={styles.spacer} />

            <AppButton
              title="Create Account"
              variant="secondary"
              onPress={() => navigation.navigate("Signup")}
            />

            <View style={styles.spacer} />

            <AppButton
              title="Open Offline Demo Dashboard"
              variant="secondary"
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Dashboard" }],
                })
              }
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
    gap: 2,
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
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
