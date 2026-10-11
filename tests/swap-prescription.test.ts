/* Run: npx tsx tests/swap-prescription.test.ts */
import assert from "node:assert/strict";
import { adaptPrescription, exerciseMeasure, isUnilateral, targetMeasure, usesWeight } from "../lib/training/swap-prescription";

const plank = { exercise_name: "Copenhagen Plank (Straight Leg)", laterality: null };

// Timed -> rep-based: sets kept, reps from the new exercise's category
assert.equal(adaptPrescription("3x20s/side", plank, { exercise_name: "Copenhagen Dip (From Knee)", category: "Injury resilience" }), "3x8");
// Rep-based -> timed
assert.equal(adaptPrescription("3x10", { exercise_name: "Body Saw (Sliders)" }, { exercise_name: "Front Plank Hold", category: "Injury resilience" }), "3x20s");
// Like for like keeps text exactly (including RIR and notes)
assert.equal(
  adaptPrescription("4x8, RIR 3", { exercise_name: "Barbell Back Squat" }, { exercise_name: "Barbell Front Squat", category: "Absolute strength" }),
  "4x8, RIR 3"
);
// Bilateral -> single-sided adds /side, and the reverse removes it
assert.equal(adaptPrescription("3x8", { exercise_name: "Dumbbell Goblet Squat" }, { exercise_name: "Dumbbell Reverse Lunge", category: "Hypertrophy" }), "3x8/side");
assert.equal(adaptPrescription("3x8/side", { exercise_name: "Dumbbell Reverse Lunge" }, { exercise_name: "Dumbbell Goblet Squat", category: "Hypertrophy" }), "3x8");
// Distance work keeps its distance for another distance exercise, and reads it from the name otherwise
assert.equal(adaptPrescription("4x10 yd", { exercise_name: "Falling Start Sprint (10 yd)" }, { exercise_name: "3-Point Start Sprint (10-20 yd)", category: "Speed" }), "4x10 yd");
assert.equal(adaptPrescription("3x8", { exercise_name: "Dumbbell Row" }, { exercise_name: "Heavy Sled Sprint (10-20 yd)", category: "Conditioning" }), "3x10 yd");
// Unparseable prescriptions are left alone rather than guessed
assert.equal(adaptPrescription("as prescribed", plank, { exercise_name: "Front Plank Hold" }), "as prescribed");
assert.equal(adaptPrescription(null, plank, { exercise_name: "Front Plank Hold" }), null);

assert.equal(exerciseMeasure({ exercise_name: "Barbell Hang Power Clean" }), "reps", "hang cleans are not timed holds");
assert.equal(exerciseMeasure({ exercise_name: "Wall Sit" }), "seconds");
assert.equal(exerciseMeasure({ exercise_name: "Alternating-Leg Bound", category: "Plyometrics" }), "reps");
assert.equal(exerciseMeasure({ exercise_name: "Farmer's Carry" }), "distance");
assert.equal(isUnilateral({ exercise_name: "Single-Leg Calf Raise (Dumbbell)" }), true);
assert.equal(isUnilateral({ exercise_name: "Barbell Back Squat" }), false);
assert.equal(targetMeasure("3x20s/side"), "seconds");
assert.equal(targetMeasure("4x15 yd"), "distance");
assert.equal(targetMeasure("4x8, RIR 3"), "reps");

// Weight entry: anything loaded can take a weight, including a tier 3 calf raise
assert.equal(usesWeight({ equipment_all: ["dumbbells"], exercise_name: "Single-Leg Calf Raise (Dumbbell)", logging_tier: 3 }), true);
assert.equal(usesWeight({ equipment_all: ["sliders"], exercise_name: "Body Saw (Sliders)", logging_tier: 3 }), false);
assert.equal(usesWeight({ equipment_all: [], exercise_name: "Pull-Up", logging_tier: 1 }), true);

console.log("swap prescription tests passed");
