import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { fromHHMM, fromIso, prettyTime, toHHMM, toIso } from "../lib/schedule.core";
import { prettyDate } from "../lib/dates";
import { colors } from "../theme";

type Props = {
  label?: string;
  value: string; // YYYY-MM-DD or HH:MM, "" when unset
  onChange: (v: string) => void;
  mode?: "date" | "time";
  placeholder?: string;
  /** Show a clear (x) button for optional values. */
  clearable?: boolean;
};

/** Tap to pick a date or time with the phone's native picker. Stores YYYY-MM-DD / HH:MM strings. */
export function DateField({ label, value, onChange, mode = "date", placeholder, clearable }: Props) {
  const [open, setOpen] = useState(false);
  const current = (mode === "date" ? fromIso(value) : fromHHMM(value)) ?? new Date();
  const shown = value ? (mode === "date" ? `${prettyDate(value)} ${value.slice(0, 4)}` : prettyTime(value)) : placeholder ?? (mode === "date" ? "Pick a date" : "Pick a time");

  function handle(_: unknown, d?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (d) onChange(mode === "date" ? toIso(d) : toHHMM(d));
  }

  return (
    <View style={{ flex: 1, minWidth: 120 }}>
      {label ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {Platform.OS === "ios" ? (
          // iOS shows a compact tappable pill that opens the native picker in place.
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
            {value || !clearable ? (
              <DateTimePicker value={current} mode={mode} display="compact" themeVariant="dark" onChange={handle} />
            ) : (
              <Pressable onPress={() => onChange(mode === "date" ? toIso(new Date()) : "12:00")} style={pill}>
                <Text style={{ color: colors.faint }}>{shown}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <Pressable onPress={() => setOpen(true)} style={[pill, { flex: 1 }]}>
              <Text style={{ color: value ? colors.text : colors.faint }}>{shown}</Text>
            </Pressable>
            {open ? <DateTimePicker value={current} mode={mode} onChange={handle} /> : null}
          </>
        )}
        {clearable && value ? (
          <Pressable onPress={() => onChange("")} hitSlop={8}>
            <Text style={{ color: colors.faint, fontSize: 18 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const pill = { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 } as const;
