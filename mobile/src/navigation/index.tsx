import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../lib/auth";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import ScheduleScreen from "../screens/ScheduleScreen";
import ProgramsScreen from "../screens/ProgramsScreen";
import SessionScreen from "../screens/SessionScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerTitleStyle: { color: colors.brandDark },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="Today" component={HomeScreen} />
      <Tabs.Screen name="Schedule" component={ScheduleScreen} />
      <Tabs.Screen name="Programs" component={ProgramsScreen} />
    </Tabs.Navigator>
  );
}

export default function Navigation() {
  const { loading, session } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return (
    <NavigationContainer theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: colors.brand, background: "#fff" } }}>
      <Stack.Navigator>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Session" component={SessionScreen} options={{ title: "Workout", headerBackTitle: "Back" }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
