import React, { useEffect } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import { NavigationContainer, DarkTheme, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import ScheduleScreen from "../screens/ScheduleScreen";
import ProgramsScreen from "../screens/ProgramsScreen";
import ProgressScreen from "../screens/ProgressScreen";
import ExerciseHistoryScreen from "../screens/ExerciseHistoryScreen";
import SessionScreen from "../screens/SessionScreen";
import AccountScreen from "../screens/AccountScreen";
import EquipmentScreen from "../screens/EquipmentScreen";
import InjuriesScreen from "../screens/InjuriesScreen";
import RemindersScreen from "../screens/RemindersScreen";
import SeasonScreen from "../screens/SeasonScreen";
import TrainingDaysScreen from "../screens/TrainingDaysScreen";
import { syncReminders } from "../lib/reminders";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function ProfileButton() {
  const { athlete } = useAuth();
  const navigation = useNavigation<any>();
  const initial = (athlete?.name ?? athlete?.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <Pressable
      onPress={() => navigation.navigate("Account")}
      style={{ marginRight: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: colors.onBrand, fontWeight: "800" }}>{initial}</Text>
    </Pressable>
  );
}

/** Keeps the phone's scheduled workout reminders in step with the schedule. */
function ReminderSync() {
  const { athlete } = useAuth();
  useEffect(() => {
    if (!athlete) return;
    syncReminders(athlete.id);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") syncReminders(athlete.id); });
    return () => sub.remove();
  }, [athlete]);
  return null;
}

const icons: Record<string, [string, string]> = {
  Today: ["flash", "flash-outline"],
  Schedule: ["calendar", "calendar-outline"],
  Programs: ["albums", "albums-outline"],
  Progress: ["stats-chart", "stats-chart-outline"],
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontWeight: "800" },
        headerShadowVisible: false,
        headerRight: () => <ProfileButton />,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.faint,
        tabBarIcon: ({ focused, color, size }: any) => (
          <Ionicons name={(icons[route.name]?.[focused ? 0 : 1] ?? "ellipse") as any} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="Today" component={HomeScreen} />
      <Tabs.Screen name="Schedule" component={ScheduleScreen} />
      <Tabs.Screen name="Programs" component={ProgramsScreen} />
      <Tabs.Screen name="Progress" component={ProgressScreen} />
    </Tabs.Navigator>
  );
}

export default function Navigation() {
  const { loading, session } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return (
    <NavigationContainer
      theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.brand, background: colors.bg, card: colors.bg, text: colors.text, border: colors.line } }}
    >
      {session ? <ReminderSync /> : null}
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTitleStyle: { color: colors.text }, headerTintColor: colors.brand, headerShadowVisible: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Session" component={SessionScreen} options={{ title: "Workout", headerBackTitle: "Back" }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: "My info", headerBackTitle: "Back" }} />
            <Stack.Screen name="Season" component={SeasonScreen} options={{ title: "Season & game days", headerBackTitle: "Back" }} />
            <Stack.Screen name="TrainingDays" component={TrainingDaysScreen} options={{ title: "Training days", headerBackTitle: "Back" }} />
            <Stack.Screen name="Equipment" component={EquipmentScreen} options={{ title: "Equipment", headerBackTitle: "Back" }} />
            <Stack.Screen name="Injuries" component={InjuriesScreen} options={{ title: "Injury status", headerBackTitle: "Back" }} />
            <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: "Reminders", headerBackTitle: "Back" }} />
            <Stack.Screen name="ExerciseHistory" component={ExerciseHistoryScreen} options={{ title: "History", headerBackTitle: "Back" }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
