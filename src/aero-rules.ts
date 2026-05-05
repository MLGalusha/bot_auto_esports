export const incidentCategories = [
  {
    value: "collision",
    label: "Collision / Contact",
    description: "Ramming, avoidable contact, excessive aggression.",
  },
  {
    value: "track_limits",
    label: "Track Limits",
    description: "Intentional or excessive track extension.",
  },
  {
    value: "blue_flag",
    label: "Blue Flag",
    description: "Backmarker behavior or unsafe yielding.",
  },
  {
    value: "yellow_flag",
    label: "Yellow Flag / Caution",
    description: "Passing, unsafe driving, position changes, damage.",
  },
  {
    value: "race_procedure",
    label: "Start / Restart Procedure",
    description: "Pace lap, formation, speed, restart, or qualifying procedure.",
  },
  {
    value: "reentry",
    label: "Track Re-entry / Spin",
    description: "Unsafe rejoin or turning around on track.",
  },
  {
    value: "pit_exit",
    label: "Pit Exit",
    description: "Crossing pit exit line or unsafe pit merge.",
  },
  {
    value: "build_livery",
    label: "Build / Handicap / Livery",
    description: "Incorrect build, bucket handicap, or required livery.",
  },
  {
    value: "competitive_integrity",
    label: "Cheating / Exploit",
    description: "Hacking, cheating, exploit use, or intentional rule abuse.",
  },
  {
    value: "voice_chat",
    label: "Voice / Conduct",
    description: "Arguing, verbal abuse, noise, chat disturbance.",
  },
  {
    value: "other",
    label: "Other Issue",
    description: "Anything that does not fit the listed categories.",
  },
] as const;

export type IncidentCategory = (typeof incidentCategories)[number]["value"];

export function getIncidentCategoryLabel(value: string): string {
  return incidentCategories.find((category) => category.value === value)?.label ?? value;
}

export const racePhases = [
  { value: "practice", label: "Practice", description: "Practice session before qualifying." },
  { value: "qualifying", label: "Qualifying", description: "Qualifying laps or qualifying procedure." },
  { value: "pace_lap", label: "Pace Lap / Start", description: "Initial pace lap, formation, or race start." },
  { value: "green_flag", label: "Green Flag Racing", description: "Normal racing conditions." },
  { value: "restart", label: "Restart", description: "Restart formation or green after caution." },
  { value: "final_laps", label: "Final 4 Laps", description: "Final 4 laps, where yellow flags do not apply." },
  { value: "post_race", label: "Post-Race / Lobby", description: "After race, lobby, party, or conduct issue." },
  { value: "pre_race", label: "Pre-Race Check", description: "Before official race start." },
  { value: "after_session", label: "After Session", description: "Issue noticed after session completed." },
  { value: "caution_call", label: "Caution Call / Criteria", description: "Whether a full-course yellow should or should not start." },
  { value: "during_caution", label: "During Caution", description: "After yellow was announced." },
  { value: "caution_lineup", label: "Caution Lineup", description: "Single-file order, spacing, or position issue." },
  { value: "caution_pits", label: "Pit Cycle Under Caution", description: "Pit entry/exit or rejoin during caution." },
  { value: "caution_restart", label: "Caution Restart", description: "Restart preparation or green after yellow." },
  { value: "final_4_caution", label: "Final 4 Laps Caution", description: "Caution issue during laps where yellows do not apply." },
  { value: "being_lapped", label: "Being Lapped", description: "Backmarker being approached by lead-lap car." },
  { value: "lead_pack_pass", label: "Lead Pack Passing", description: "Lead-lap cars passing a backmarker." },
  { value: "formation", label: "Formation / Spacing", description: "Single-file, double-file, 65 mph, or 2-car-length issue." },
  { value: "qualifying_reverse", label: "Reverse In Qualifying", description: "Driving in reverse at the start of qualifying." },
  { value: "race_voice", label: "Race Voice Chat", description: "Voice chat during active session." },
  { value: "lobby_voice", label: "Lobby / Party Chat", description: "Lobby or party chat conduct issue." },
] as const;

export const incidentImpacts = [
  { value: "steward_review", label: "Admin Review", description: "Let admins determine severity from the clip." },
  { value: "no_damage", label: "No Damage / Minimal Impact", description: "No clear damage or position impact." },
  { value: "position_loss", label: "Position Loss / Time Loss", description: "A driver lost time, position, or momentum." },
  { value: "minor_damage", label: "Minor Damage", description: "Light damage, car still competitive." },
  { value: "significant_damage", label: "Significant Damage", description: "Damage affected pace or race outcome." },
  { value: "severe_obstacle", label: "Severe Damage / Obstacle", description: "Slow car became a track obstacle." },
  { value: "repeated_behavior", label: "Repeated Behavior", description: "Repeated track limits, conduct, or rule abuse." },
  { value: "conduct_only", label: "Conduct Only", description: "Voice chat, arguing, abuse, or disruption." },
  { value: "unsafe_yield", label: "Unsafe Yielding", description: "Lifted/braked/held line unsafely while being passed." },
  { value: "illegal_pass", label: "Illegal Pass / Position Gain", description: "Position gained where passing is restricted." },
  { value: "procedure_issue", label: "Procedure Issue", description: "Lineup, spacing, formation, or instruction issue." },
  { value: "eligibility_issue", label: "Eligibility / Compliance Issue", description: "Build, handicap, livery, or race eligibility issue." },
  { value: "integrity_issue", label: "Cheating / Exploit Issue", description: "Hacking, cheating, exploit use, or intentional rule abuse." },
] as const;

export const evidenceReadiness = [
  { value: "strong_clip", label: "Clip Shows Before + After", description: "Best evidence for admin review." },
  { value: "short_clip", label: "Short Clip", description: "May need more context from admins." },
  { value: "stream_replay", label: "Stream / Replay Available", description: "Evidence exists in stream or replay." },
  { value: "needs_upload", label: "Need to Upload Clip", description: "Submit now, add evidence from the status screen." },
  { value: "no_clip", label: "No Clip Yet", description: "May not be enough for action under AERO rules." },
] as const;

export function getRacePhaseLabel(value?: string): string {
  return racePhases.find((phase) => phase.value === value)?.label ?? "Not selected";
}

export function getIncidentImpactLabel(value?: string): string {
  return incidentImpacts.find((impact) => impact.value === value)?.label ?? "Not selected";
}

export function getEvidenceReadinessLabel(value?: string): string {
  return evidenceReadiness.find((evidence) => evidence.value === value)?.label ?? "Not selected";
}

const phaseValuesByCategory: Record<string, string[]> = {
  collision: ["green_flag", "pace_lap", "restart", "qualifying", "during_caution"],
  track_limits: ["green_flag", "qualifying", "final_laps"],
  blue_flag: ["being_lapped", "lead_pack_pass", "final_laps"],
  yellow_flag: ["caution_call", "during_caution", "caution_lineup", "caution_pits", "caution_restart", "final_4_caution"],
  race_procedure: ["pace_lap", "formation", "restart", "caution_restart", "qualifying_reverse", "qualifying"],
  reentry: ["green_flag", "qualifying", "final_laps"],
  pit_exit: ["green_flag", "caution_pits"],
  build_livery: ["pre_race", "practice", "qualifying", "after_session"],
  competitive_integrity: ["practice", "qualifying", "green_flag", "after_session"],
  voice_chat: ["race_voice", "lobby_voice", "post_race"],
  other: racePhases.map((phase) => phase.value),
};

const impactValuesByCategory: Record<string, string[]> = {
  collision: ["steward_review", "position_loss", "minor_damage", "significant_damage", "severe_obstacle", "no_damage"],
  track_limits: ["steward_review", "repeated_behavior", "position_loss"],
  blue_flag: ["steward_review", "unsafe_yield", "position_loss", "minor_damage", "significant_damage"],
  yellow_flag: ["steward_review", "procedure_issue", "illegal_pass", "position_loss", "minor_damage", "significant_damage", "severe_obstacle"],
  race_procedure: ["steward_review", "procedure_issue", "illegal_pass", "position_loss", "minor_damage", "significant_damage", "no_damage"],
  reentry: ["steward_review", "position_loss", "minor_damage", "significant_damage", "severe_obstacle", "no_damage"],
  pit_exit: ["steward_review", "illegal_pass", "position_loss", "minor_damage", "significant_damage", "no_damage"],
  build_livery: ["eligibility_issue"],
  competitive_integrity: ["steward_review", "integrity_issue", "eligibility_issue", "position_loss", "repeated_behavior"],
  voice_chat: ["conduct_only", "repeated_behavior"],
  other: incidentImpacts.map((impact) => impact.value),
};

const evidenceValuesByCategory: Record<string, string[]> = {
  voice_chat: ["strong_clip", "stream_replay", "short_clip", "needs_upload", "no_clip"],
  build_livery: ["strong_clip", "short_clip", "stream_replay", "needs_upload", "no_clip"],
};

export function getRacePhaseOptions(category?: string) {
  return filterOptions(racePhases, phaseValuesByCategory[category ?? "other"]);
}

export function getIncidentImpactOptions(category?: string) {
  return filterOptions(incidentImpacts, impactValuesByCategory[category ?? "other"]);
}

export function getEvidenceReadinessOptions(category?: string) {
  return filterOptions(evidenceReadiness, evidenceValuesByCategory[category ?? "other"]);
}

export function getDefaultIntakeValues(category: string): {
  impact?: string;
  evidenceReadiness?: string;
} {
  switch (category) {
    case "build_livery":
      return { impact: "eligibility_issue", evidenceReadiness: "strong_clip" };
    case "voice_chat":
      return { impact: "conduct_only", evidenceReadiness: "strong_clip" };
    default:
      return { evidenceReadiness: "strong_clip" };
  }
}

export function shouldShowImpactSelect(category?: string): boolean {
  return category !== "build_livery" && category !== "voice_chat";
}

export function shouldShowEvidenceSelect(category?: string): boolean {
  return false;
}

function filterOptions<T extends readonly { value: string }[]>(
  options: T,
  values = options.map((option) => option.value),
) {
  return values
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is T[number] => Boolean(option));
}
