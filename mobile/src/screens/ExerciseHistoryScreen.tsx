import React from "react";
import { H1, Screen } from "../components/ui";
import { ExerciseHistoryView } from "../components/ExerciseHistoryView";

export default function ExerciseHistoryScreen({ route }: any) {
  const { exerciseId, name } = route.params;
  return (
    <Screen>
      <H1>{name ?? "History"}</H1>
      <ExerciseHistoryView exerciseId={exerciseId} />
    </Screen>
  );
}
