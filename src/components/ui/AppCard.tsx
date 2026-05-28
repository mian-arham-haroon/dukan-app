import React from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { useAppTheme } from "../../theme/useAppTheme";

type Variant = "default" | "muted";

type Props = ViewProps & {
  children: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, variant = "default", style, ...rest }: Props) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            variant === "muted" ? theme.cardMuted : theme.card,
          borderColor: variant === "muted" ? theme.border : theme.borderStrong,
          shadowColor: theme.shadow,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
});
