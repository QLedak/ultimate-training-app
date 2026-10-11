import React from "react";
import { Text, View } from "react-native";
import { Button } from "./ui";
import { reportError } from "../lib/errorReport";
import { colors } from "../theme";

type State = { error: Error | null };

/** Catches a crash while drawing a screen and shows a recovery screen instead of a frozen app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError(Object.assign(error, { stack: `${error.stack ?? ""}\n${info.componentStack ?? ""}` }), "screen-crash", true);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", textAlign: "center" }}>Something went wrong</Text>
        <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center" }}>
          The app hit an unexpected problem. We've been told about it. Your logged workouts are safe.
        </Text>
        <Button title="Try again" onPress={() => this.setState({ error: null })} style={{ alignSelf: "stretch" }} />
      </View>
    );
  }
}
