import React, { useState } from "react";
import {
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useAppTheme } from "../../theme/useAppTheme";

type Props = TextInputProps & {
  label: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function AppInput({
  label,
  error,
  style,
  containerStyle,
  labelStyle,
  inputStyle,
  editable = true,
  onBlur,
  onFocus,
  ...rest
}: Props) {
  const { theme } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={[styles.label, { color: theme.textSecondary }, labelStyle]}>
        {label}
      </Text>

      <TextInput
        placeholderTextColor={theme.textMuted}
        editable={editable}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        style={[
          styles.input,
          {
            backgroundColor: editable ? theme.inputBackground : theme.cardMuted,
            borderColor: error
              ? theme.danger
              : isFocused
              ? theme.primary
              : theme.border,
            color: editable ? theme.textPrimary : theme.textMuted,
          },
          isFocused && !error ? styles.focusedInput : null,
          error ? styles.inputError : null,
          !editable ? styles.disabledInput : null,
          style,
          inputStyle,
        ]}
        {...rest}
      />

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
  },
  focusedInput: {
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: "#DC2626",
  },
  disabledInput: {
    opacity: 0.8,
  },
  error: {
    marginTop: 7,
    fontSize: 12,
    fontWeight: "700",
  },
});
