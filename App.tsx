import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { runDatabaseTest } from "./src/database/databaseTest";
import { startAutoSyncWatcher, stopAutoSyncWatcher } from "./src/services/autoSyncService";
type AppStatus = {
  loading: boolean;
  success: boolean;
  message: string;
  error?: string;
};

export default function App() {
    useEffect(() => {
    startAutoSyncWatcher();

    return () => {
      stopAutoSyncWatcher();
    };
  }, []);
  const [retryKey, setRetryKey] = useState(0);

  const [appStatus, setAppStatus] = useState<AppStatus>({
    loading: true,
    success: false,
    message: "Starting local database...",
  });

  useEffect(() => {
    let mounted = true;

    async function prepareApp() {
      setAppStatus({
        loading: true,
        success: false,
        message: "Starting local database...",
      });

      const result = await runDatabaseTest();

      if (!mounted) {
        return;
      }

      setAppStatus({
        loading: false,
        success: result.success,
        message: result.message,
        error: result.error,
      });
    }

    prepareApp();

    return () => {
      mounted = false;
    };
  }, [retryKey]);

  if (appStatus.loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{appStatus.message}</Text>
      </View>
    );
  }

  if (!appStatus.success) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />

        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Database Error</Text>
          <Text style={styles.errorText}>{appStatus.message}</Text>

          {appStatus.error ? (
            <Text style={styles.errorDetails}>{appStatus.error}</Text>
          ) : null}

          <Pressable
            style={styles.retryButton}
            onPress={() => setRetryKey((current) => current + 1)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <RootNavigator />
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#64748B",
  },
  errorCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: "#334155",
    marginBottom: 10,
  },
  errorDetails: {
    fontSize: 13,
    lineHeight: 20,
    color: "#DC2626",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563EB",
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});