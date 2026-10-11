// Same locations and wording as the website's intake and injury pages.
export const INJURY_LABELS: Record<string, string> = {
  achilles_calf: "Achilles/calf",
  patellar_knee: "Patellar tendon/knee",
  acl_knee: "ACL/knee",
  hamstring: "Hamstring",
  groin_adductor: "Groin/adductor",
  abdominal: "Core / abdominal",
  hip_flexor: "Hip flexor",
  elbow: "Elbow",
  wrist: "Wrist",
  shoulder: "Shoulder",
  lower_back: "Lower back",
  ankle: "Ankle",
};
export const INJURY_LOCATIONS = Object.keys(INJURY_LABELS);
export const injuryLabel = (loc: string) => INJURY_LABELS[loc] ?? loc.replace(/_/g, " ");

export const CHARACTER_OPTIONS = [
  { value: "sharp_sudden", label: "Sharp / sudden onset" },
  { value: "tight_sore_gradual", label: "Tight/sore, gradual or after activity" },
];
