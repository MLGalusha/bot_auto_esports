export type DevIncidentCase = {
  name: string;
  reporterGamertag: string;
  category: string;
  racePhase: string;
  impact: string;
  evidenceReadiness: string;
  event: string;
  lapOrTime: string;
  involvedDriversText: string;
  description: string;
  evidenceUrl?: string;
};

export const defaultDevEvidenceUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

export const devIncidentCases: DevIncidentCase[] = [
  {
    name: "avoidable-contact-penalty-review",
    reporterGamertag: "AERO_Test_Mason",
    category: "collision",
    racePhase: "green_flag",
    impact: "position_loss",
    evidenceReadiness: "strong_clip",
    event: "AERO Test Event - Maple Valley",
    lapOrTime: "Lap 6, Turn 2",
    involvedDriversText: "AERO_Test_Bravo, AERO_Test_Cobalt",
    description:
      "AERO_Test_Bravo brakes late into Turn 2 and hits AERO_Test_Cobalt from behind. Cobalt is pushed wide and loses two positions before corner exit.",
    evidenceUrl: defaultDevEvidenceUrl,
  },
  {
    name: "no-action-racing-incident",
    reporterGamertag: "AERO_Test_Riley",
    category: "collision",
    racePhase: "green_flag",
    impact: "no_damage",
    evidenceReadiness: "short_clip",
    event: "AERO Test Event - Road America",
    lapOrTime: "Lap 3, Canada Corner",
    involvedDriversText: "AERO_Test_Delta, AERO_Test_Echo",
    description:
      "Two cars run side-by-side through corner entry with light door contact. Neither driver appears to lose position or receive damage.",
    evidenceUrl: "https://youtu.be/dQw4w9WgXcQ",
  },
  {
    name: "need-more-info-short-clip",
    reporterGamertag: "AERO_Test_Jordan",
    category: "reentry",
    racePhase: "green_flag",
    impact: "significant_damage",
    evidenceReadiness: "short_clip",
    event: "AERO Test Event - Laguna Seca",
    lapOrTime: "Lap 8, Corkscrew exit",
    involvedDriversText: "AERO_Test_Frost, AERO_Test_Gale",
    description:
      "Clip starts after AERO_Test_Frost is already sideways. Report says Frost rejoined into Gale, but the current clip does not show the off-track moment.",
    evidenceUrl: defaultDevEvidenceUrl,
  },
  {
    name: "caution-procedure-review",
    reporterGamertag: "AERO_Test_Casey",
    category: "yellow_flag",
    racePhase: "caution_lineup",
    impact: "procedure_issue",
    evidenceReadiness: "stream_replay",
    event: "AERO Test Event - Watkins Glen",
    lapOrTime: "Caution lap 2, back straight",
    involvedDriversText: "AERO_Test_Harbor, AERO_Test_Ivory",
    description:
      "AERO_Test_Harbor appears to hold the wrong position in caution order after pit cycle instructions. Admins need to review chat timing and lineup.",
    evidenceUrl: defaultDevEvidenceUrl,
  },
  {
    name: "track-limits-repeat",
    reporterGamertag: "AERO_Test_Quinn",
    category: "track_limits",
    racePhase: "final_laps",
    impact: "repeated_behavior",
    evidenceReadiness: "strong_clip",
    event: "AERO Test Event - Silverstone",
    lapOrTime: "Laps 18-20, Club exit",
    involvedDriversText: "AERO_Test_Jade",
    description:
      "AERO_Test_Jade repeatedly extends beyond track limits on corner exit during the final stint and appears to maintain a gap because of it.",
    evidenceUrl: defaultDevEvidenceUrl,
  },
  {
    name: "unsafe-blue-flag-yield",
    reporterGamertag: "AERO_Test_Sam",
    category: "blue_flag",
    racePhase: "being_lapped",
    impact: "minor_damage",
    evidenceReadiness: "strong_clip",
    event: "AERO Test Event - Spa",
    lapOrTime: "Lap 14, Kemmel Straight",
    involvedDriversText: "AERO_Test_Kilo, AERO_Test_Lumen",
    description:
      "AERO_Test_Kilo lifts and moves unpredictably while being lapped. Lumen makes contact while attempting to pass safely on the straight.",
    evidenceUrl: "https://youtu.be/dQw4w9WgXcQ",
  },
  {
    name: "build-compliance-review",
    reporterGamertag: "AERO_Test_Taylor",
    category: "build_livery",
    racePhase: "pre_race",
    impact: "eligibility_issue",
    evidenceReadiness: "strong_clip",
    event: "AERO Test Event - Le Mans",
    lapOrTime: "Pre-race inspection",
    involvedDriversText: "AERO_Test_Mica",
    description:
      "AERO_Test_Mica appears to be running the wrong bucket handicap during lobby inspection. Admins need to verify the build against the event sheet.",
    evidenceUrl: defaultDevEvidenceUrl,
  },
  {
    name: "voice-conduct-review",
    reporterGamertag: "AERO_Test_Avery",
    category: "voice_chat",
    racePhase: "post_race",
    impact: "conduct_only",
    evidenceReadiness: "stream_replay",
    event: "AERO Test Event - Nürburgring GP",
    lapOrTime: "Post-race lobby",
    involvedDriversText: "AERO_Test_Nova, AERO_Test_Orion",
    description:
      "Post-race voice discussion becomes personal and disruptive after an incident. Admins need to decide whether this is a warning or conduct penalty.",
    evidenceUrl: defaultDevEvidenceUrl,
  },
];
