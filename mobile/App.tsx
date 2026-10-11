import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/lib/auth";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { installGlobalErrorHandler } from "./src/lib/errorReport";
import Navigation from "./src/navigation";

installGlobalErrorHandler();

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <Navigation />
          <StatusBar style="light" />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
