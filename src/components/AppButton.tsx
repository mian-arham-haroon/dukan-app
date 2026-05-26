import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../theme/useAppTheme";

type Variant = "primary" | "secondary" | "danger";

type Props = Omit<PressableProps, "children" | "style" | "onPress" | "disabled"> & {
  title: string;
  onPress: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  style,
  textStyle,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityRole = "button",
  ...pressableProps
}: Props) {
  const { theme } = useAppTheme();
  const isDisabled = disabled || loading;

  const variantStyles =
    variant === "primary"
      ? {
          backgroundColor: theme.primary,
          borderColor: theme.primary,
        }
      : variant === "danger"
      ? {
          backgroundColor: theme.danger,
          borderColor: theme.danger,
        }
      : {
          backgroundColor: theme.surfaceMuted,
          borderWidth: 1,
          borderColor: theme.borderStrong,
        };

  const textColor = isDisabled
    ? theme.textMuted
    : variant === "primary" || variant === "danger"
    ? theme.primaryText
    : theme.textPrimary;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles,
        fullWidth && styles.fullWidth,
        isDisabled && {
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.border,
          opacity: 0.75,
        },
        !isDisabled && pressed && styles.pressed,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
          size="small"
          style={styles.loadingIndicator}
        />
      ) : null}
      <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: "row",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.86,
  },
  text: {
    fontSize: 15,
    fontWeight: "800",
  },
  loadingIndicator: {
    marginRight: 8,
  },
});
