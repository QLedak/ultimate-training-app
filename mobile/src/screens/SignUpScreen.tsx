import React, { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorText, Field, P } from "../components/ui";
import { useAuth } from "../lib/auth";
import { API_URL } from "../config";
import { signUpProblem } from "../lib/signup.core";
import { colors } from "../theme";

export default function SignUpScreen({ navigation }: any) {
  const { signUp, pendingPlanId } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);

  async function submit() {
    const problem = signUpProblem({ name, email, password, agreed });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    setExists(false);
    const err = await signUp(name, email, password);
    if (err) {
      setError(err);
      setExists(/already exists/i.test(err));
    }
    // On success the signed-in screens take over automatically.
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 14, justifyContent: "center", flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 2, color: colors.brand }}>TRUE</Text>
            <Text style={{ fontSize: 30, fontWeight: "800", color: colors.text }}>Create your account</Text>
          </View>
          <P muted>
            {pendingPlanId && pendingPlanId !== "coach"
              ? "One quick step, then you'll pick your start date and get your program."
              : "One quick step. Next you'll answer the intake so your coach can build your plan."}
          </P>
          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" />
          <Field label="Password (8+ characters)" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" onSubmitEditing={submit} />

          <Pressable onPress={() => setAgreed(!agreed)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.brand, backgroundColor: agreed ? colors.brand : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {agreed ? <Text style={{ color: colors.onBrand, fontWeight: "900" }}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              I agree to the{" "}
              <Text style={{ color: colors.brand, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${API_URL}/terms`)}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={{ color: colors.brand, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>Privacy Policy</Text>
              , including how my training and injury information is used.
            </Text>
          </Pressable>

          <ErrorText>{error}</ErrorText>
          {exists ? <Button title="Sign in instead" variant="secondary" onPress={() => navigation.navigate("Login")} /> : null}
          <Button title="Create account" onPress={submit} loading={busy} />
          <Button title="I already have an account" variant="link" onPress={() => navigation.navigate("Login")} style={{ alignSelf: "center" }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
