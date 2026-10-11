import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, ErrorText, Field, P } from "../components/ui";
import { supabase } from "../lib/supabase";
import { API_URL } from "../config";
import { resetEmailProblem } from "../lib/signup.core";
import { colors } from "../theme";

/** Sends the same reset email as the website; the link opens the website's reset page. */
export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const problem = resetEmailProblem(email);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${API_URL}/reset-password` });
    if (err) setError(err.message);
    else setSent(true);
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ gap: 14 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text }}>Reset your password</Text>
          {sent ? (
            <Card tone="green">
              <P>Check your email. If an account exists for {email.trim()}, we've sent a link to reset your password. It opens in your browser; come back here and sign in with the new password.</P>
            </Card>
          ) : (
            <>
              <P muted>Enter the email you signed up with and we'll send you a reset link.</P>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" onSubmitEditing={submit} />
              <ErrorText>{error}</ErrorText>
              <Button title="Send reset link" onPress={submit} loading={busy} />
            </>
          )}
          <Button title="Back to sign in" variant="link" onPress={() => navigation.navigate("Login")} style={{ alignSelf: "center" }} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
