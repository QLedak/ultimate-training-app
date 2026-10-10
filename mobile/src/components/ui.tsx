import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={s.screen} edges={["left", "right", "bottom"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[s.content, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function H1({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={s.h2}>{children}</Text>;
}
export function P({ children, muted, small, style }: { children: React.ReactNode; muted?: boolean; small?: boolean; style?: any }) {
  return <Text style={[s.p, muted && { color: colors.muted }, small && { fontSize: 12 }, style]}>{children}</Text>;
}
export function Caps({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[s.caps, color ? { color } : null]}>{children}</Text>;
}

export function Card({ children, tone, style }: { children: React.ReactNode; tone?: "green" | "amber" | "brand"; style?: StyleProp<ViewStyle> }) {
  const toneStyle =
    tone === "green" ? { backgroundColor: colors.greenBg, borderColor: colors.greenLine }
    : tone === "amber" ? { backgroundColor: colors.amberBg, borderColor: colors.amberLine }
    : tone === "brand" ? { backgroundColor: colors.brandBg, borderColor: colors.brand }
    : null;
  return <View style={[s.card, toneStyle, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = "primary", disabled, loading, style,
}: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "dark" | "link"; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  if (variant === "link") {
    return (
      <Pressable onPress={onPress} disabled={off} hitSlop={8} style={style}>
        <Text style={[s.link, off && { opacity: 0.4 }]}>{title}</Text>
      </Pressable>
    );
  }
  const bg = variant === "primary" ? colors.brand : variant === "dark" ? colors.cardAlt : "transparent";
  const fg = variant === "primary" ? colors.onBrand : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, borderColor: variant === "secondary" ? colors.line : bg, opacity: off ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ flex: 1 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.faint} selectionColor={colors.brand} keyboardAppearance="dark" style={[s.input, style]} {...rest} />
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={s.error}>{children}</Text>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={{ padding: 24, alignItems: "center" }}>
      <ActivityIndicator color={colors.brand} />
      <Text style={[s.p, { color: colors.muted, marginTop: 8 }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, pct))}%` }]} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text },
  h2: { fontSize: 17, fontWeight: "700", color: colors.text },
  p: { fontSize: 15, color: colors.text },
  caps: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.muted, textTransform: "uppercase" },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, gap: 8, backgroundColor: colors.card },
  btn: { minHeight: 50, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: "700" },
  link: { fontSize: 14, color: colors.brand, fontWeight: "600" },
  label: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.text, backgroundColor: colors.cardAlt },
  error: { color: "#FCA5A5", backgroundColor: colors.redBg, padding: 10, borderRadius: 8, fontSize: 14, overflow: "hidden" },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: colors.brand },
});
