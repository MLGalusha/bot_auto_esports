import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const incidentStatuses = [
  "submitted",
  "queued_review",
  "under_review",
  "need_more_info",
  "no_action",
  "penalty",
  "closed",
] as const;

export type IncidentStatus = (typeof incidentStatuses)[number];

export type Incident = {
  id: string;
  guildId: string;
  submitterUserId: string;
  reporterGamertag?: string;
  category: string;
  racePhase: string;
  impact: string;
  evidenceReadiness: string;
  involvedUserIds: string[];
  involvedDriversText: string;
  event: string;
  lapOrTime: string;
  description: string;
  evidenceUrl?: string;
  status: IncidentStatus;
  reviewChannelId?: string;
  reviewMessageId?: string;
  reviewThreadId?: string;
  reviewThreadMessageId?: string;
  reviewDecisionMessageId?: string;
  assignedAdminUserId?: string;
  decisionDraft?: IncidentDecisionDraft;
  finalDecision?: IncidentFinalDecision;
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
  history: IncidentHistoryEvent[];
};

export type IncidentDecisionOutcome = "need_more_info" | "no_action" | "penalty";

export type IncidentDecisionDraft = {
  outcome: IncidentDecisionOutcome;
  createdByUserId: string;
  updatedByUserId: string;
  updatedAt: string;
  driver?: string;
  rule?: string;
  penalty?: string;
  summary: string;
  internalNote?: string;
};

export type IncidentFinalDecision = IncidentDecisionDraft & {
  finalizedByUserId: string;
  finalizedAt: string;
};

export type IncidentHistoryEvent = {
  actorUserId: string;
  action: string;
  status: IncidentStatus;
  note?: string;
  createdAt: string;
};

type IncidentStoreData = {
  nextNumber: number;
  incidents: Incident[];
};

const storePath = "data/incidents.json";

async function readStore(): Promise<IncidentStoreData> {
  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw) as IncidentStoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { nextNumber: 1, incidents: [] };
    }
    throw error;
  }
}

async function writeStore(data: IncidentStoreData): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function createIncident(input: {
  guildId: string;
  submitterUserId: string;
  reporterGamertag: string;
  category: string;
  racePhase: string;
  impact: string;
  evidenceReadiness: string;
  involvedUserIds: string[];
  involvedDriversText: string;
  event: string;
  lapOrTime: string;
  description: string;
  evidenceUrl?: string;
}): Promise<Incident> {
  const store = await readStore();
  const now = new Date().toISOString();
  const id = `INC-${String(store.nextNumber).padStart(4, "0")}`;
  const incident: Incident = {
    id,
    guildId: input.guildId,
    submitterUserId: input.submitterUserId,
    reporterGamertag: input.reporterGamertag,
    category: input.category,
    racePhase: input.racePhase,
    impact: input.impact,
    evidenceReadiness: input.evidenceReadiness,
    involvedUserIds: Array.from(new Set(input.involvedUserIds)),
    involvedDriversText: input.involvedDriversText,
    event: input.event,
    lapOrTime: input.lapOrTime,
    description: input.description,
    evidenceUrl: input.evidenceUrl,
    status: "queued_review",
    createdAt: now,
    updatedAt: now,
    history: [
      {
        actorUserId: input.submitterUserId,
        action: "submitted",
        status: "queued_review",
        createdAt: now,
      },
    ],
  };

  store.nextNumber += 1;
  store.incidents.push(incident);
  await writeStore(store);
  return incident;
}

export async function updateIncident(
  id: string,
  mutate: (incident: Incident) => Incident,
): Promise<Incident | undefined> {
  id = normalizeIncidentId(id);
  const store = await readStore();
  const index = store.incidents.findIndex((incident) => incident.id === id);
  if (index === -1) {
    return undefined;
  }

  const updated = mutate({ ...store.incidents[index] });
  updated.updatedAt = new Date().toISOString();
  store.incidents[index] = updated;
  await writeStore(store);
  return updated;
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  id = normalizeIncidentId(id);
  const store = await readStore();
  return store.incidents.find((incident) => incident.id === id);
}

export async function listIncidentsForUser(guildId: string, userId: string): Promise<Incident[]> {
  const store = await readStore();
  return store.incidents
    .filter(
      (incident) =>
        incident.guildId === guildId &&
        (incident.submitterUserId === userId || incident.involvedUserIds.includes(userId)),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function formatStatus(status: IncidentStatus): string {
  if (status === "queued_review") {
    return "Queued for Review";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatIncidentId(id: string): string {
  return id.replace(/^INC-/i, "");
}

export function normalizeIncidentId(id: string): string {
  const trimmed = id.trim().toUpperCase();
  return trimmed.startsWith("INC-") ? trimmed : `INC-${trimmed}`;
}
