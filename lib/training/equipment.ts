/**
 * Buckets an athlete's raw equipment list into the coarse equipment_context
 * used by corpus retrieval scoring (corpus-retrieval-spec.md) and stored on
 * ProgramDraft.input_snapshot.situation for phase_builder drafts. Shared by
 * the Phase Builder route and the review-flow chat-edit regeneration path so
 * a re-generated draft uses the exact same bucketing as the original.
 */
export function bucketEquipment(
  equipment: string[]
): "full_gym" | "limited" | "bodyweight_only" {
  if (equipment.length === 1 && equipment[0] === "bodyweight_only") return "bodyweight_only";
  if (
    equipment.includes("barbell_rack") &&
    (equipment.includes("dumbbells") || equipment.includes("kettlebell"))
  ) {
    return "full_gym";
  }
  return "limited";
}
