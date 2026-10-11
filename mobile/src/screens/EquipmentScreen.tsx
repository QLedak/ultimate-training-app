import React, { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Caps, Card, Choice, Chip, ErrorText, H1, Loading, P, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { EQUIPMENT_OPTIONS, MODALITY_OPTIONS, SPACE_OPTIONS, toggleEquipmentValue } from "../shared/equipment-options";
import { colors } from "../theme";

type EquipmentState = { equipment: string[]; available_space: string | null; conditioning_modality: string | null };

export default function EquipmentScreen() {
  const { athlete } = useAuth();
  const [data, setData] = useState<EquipmentState | null>(null);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [space, setSpace] = useState("");
  const [modality, setModality] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canRebuild, setCanRebuild] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<EquipmentState>(`/api/athletes/${athlete.id}/equipment`);
      setData(d);
      setEquipment(d.equipment ?? []);
      setSpace(d.available_space ?? "");
      setModality(d.conditioning_modality ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!athlete) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const d = await api<{ equipment: string[]; has_active_phase: boolean; message: string }>(`/api/athletes/${athlete.id}/equipment`, {
        method: "PATCH",
        body: { equipment, ...(space ? { available_space: space } : {}), ...(modality ? { conditioning_modality: modality } : {}) },
      });
      setMessage(d.message);
      setCanRebuild(d.has_active_phase);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function rebuild() {
    if (!athlete) return;
    setRebuilding(true);
    setError(null);
    try {
      const names = EQUIPMENT_OPTIONS.filter((o) => equipment.includes(o.value)).map((o) => o.label);
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/request-rebuild`, {
        method: "POST",
        body: {
          reason_category: "other",
          detail: `Athlete updated their available equipment to: ${names.join(", ")}. Please rebuild the rest of the current phase with it.`,
        },
      });
      setMessage(d.message ?? "Sent to your coach for review. You'll see the change once it's approved.");
      setCanRebuild(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRebuilding(false);
    }
  }

  if (!data && !error) return <Screen><Loading /></Screen>;

  const mark = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };

  return (
    <Screen>
      <H1>Equipment</H1>
      <P muted>Pick everything you can use. Changes shape your next training block; workouts already scheduled stay as they are.</P>
      <ErrorText>{error}</ErrorText>

      <Caps>What you have</Caps>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {EQUIPMENT_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={equipment.includes(o.value)}
            onPress={() => mark(setEquipment)(toggleEquipmentValue(equipment, o.value))}
          />
        ))}
      </View>

      <Caps>Space to move</Caps>
      <View style={{ gap: 8 }}>
        {SPACE_OPTIONS.map((o) => (
          <Choice key={o.value} label={o.label} selected={space === o.value} onPress={() => mark(setSpace)(o.value)} />
        ))}
      </View>

      <Caps>Conditioning preference</Caps>
      <View style={{ gap: 8 }}>
        {MODALITY_OPTIONS.map((o) => (
          <Choice key={o.value} label={o.label} selected={modality === o.value} onPress={() => mark(setModality)(o.value)} />
        ))}
      </View>

      <Button title="Save equipment" onPress={save} loading={saving} disabled={!dirty || equipment.length === 0} />

      {message ? (
        <Card tone="green">
          <P>{message}</P>
        </Card>
      ) : null}

      {canRebuild ? (
        <Card>
          <P>Want this to apply to your current phase too? Your coach reviews the rebuilt plan before it replaces anything.</P>
          <Button title="Rebuild my current phase" variant="secondary" onPress={rebuild} loading={rebuilding} />
        </Card>
      ) : null}
    </Screen>
  );
}
