import React, { ReactNode } from "react";
import {
  SafeAreaView,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../theme/useAppTheme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  safeAreaStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle">;
};

export function AppScreen({
  children,
  scroll = true,
  contentStyle,
  safeAreaStyle,
  scrollViewProps,
}: Props) {
  const { theme } = useAppTheme();

  if (scroll) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: theme.background },
          safeAreaStyle,
        ]}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          {...scrollViewProps}
          contentContainerStyle={[
            styles.content,
            { backgroundColor: theme.background },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.background },
        safeAreaStyle,
      ]}
    >
      <View
        style={[
          styles.content,
          styles.flex,
          { backgroundColor: theme.background },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
  },
  flex: {
    flex: 1,
  },
});
