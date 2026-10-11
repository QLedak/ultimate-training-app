import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorText, Field, P } from "../components/ui";
import { useAuth } from "../lib/auth";
import { colors } from "../theme";

export default function LoginScreen({ navigation }: any) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ gap: 14 }}>
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", letterSpacing: 2, color: colors.brand }}>TRUE</Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: colors.text }}>Ultimate Training</Text>
          </View>
          <P muted>Sign in with the same account you use on the website.</P>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" onSubmitEditing={submit} />
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" onPress={submit} loading={busy} />
          <Button title="Forgot password?" variant="link" onPress={() => navigation.navigate("ForgotPassword")} style={{ alignSelf: "center" }} />
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 6 }} />
          <P muted>New here?</P>
          <Button title="Create an account" variant="secondary" onPress={() => navigation.navigate("SignUp")} />
          <Button title="Browse programs and plans" variant="link" onPress={() => navigation.navigate("Plans")} style={{ alignSelf: "center" }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
