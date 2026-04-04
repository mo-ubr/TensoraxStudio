// Project Memory — read/write/query learned facts, context, decisions, baselines

import type {
  LearnedFact,
  UserContextEntry,
  DecisionRecord,
  PerformanceBaseline,
  ProjectMemory,
} from './types';
import { getProject, updateProject } from './project';

// ─── Internal helpers ───────────────────────────────────────────────────────

async function getMemory(projectId: string): Promise<ProjectMemory> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.memory;
}

async function saveMemory(projectId: string, memory: ProjectMemory): Promise<void> {
  await updateProject(projectId, { memory });
}

// ─── Learned Facts ──────────────────────────────────────────────────────────

export async function addLearnedFact(
  projectId: string,
  fact: Omit<LearnedFact, 'id'>,
): Promise<LearnedFact> {
  const memory = await getMemory(projectId);
  const newFact: LearnedFact = {
    ...fact,
    id: crypto.randomUUID(),
  };
  memory.learnedFacts.push(newFact);
  await saveMemory(projectId, memory);
  return newFact;
}

export async function getLearnedFacts(
  projectId: string,
  filter?: { category?: LearnedFact['category']; stillValid?: boolean },
): Promise<LearnedFact[]> {
  const memory = await getMemory(projectId);
  let facts = memory.learnedFacts;
  if (filter?.category !== undefined) {
    facts = facts.filter((f) => f.category === filter.category);
  }
  if (filter?.stillValid !== undefined) {
    facts = facts.filter((f) => f.stillValid === filter.stillValid);
  }
  return facts;
}

export async function invalidateFact(
  projectId: string,
  factId: string,
): Promise<void> {
  const memory = await getMemory(projectId);
  const fact = memory.learnedFacts.find((f) => f.id === factId);
  if (!fact) throw new Error(`Fact ${factId} not found in project ${projectId}`);
  fact.stillValid = false;
  await saveMemory(projectId, memory);
}

export async function confirmFact(
  projectId: string,
  factId: string,
): Promise<void> {
  const memory = await getMemory(projectId);
  const fact = memory.learnedFacts.find((f) => f.id === factId);
  if (!fact) throw new Error(`Fact ${factId} not found in project ${projectId}`);
  fact.lastConfirmed = new Date();
  fact.evidenceCount += 1;
  await saveMemory(projectId, memory);
}

// ─── User Context ───────────────────────────────────────────────────────────

export async function addUserContext(
  projectId: string,
  entry: Omit<UserContextEntry, 'id' | 'addedAt'>,
): Promise<UserContextEntry> {
  const memory = await getMemory(projectId);
  const newEntry: UserContextEntry = {
    ...entry,
    id: crypto.randomUUID(),
    addedAt: new Date(),
  };
  memory.userContext.push(newEntry);
  await saveMemory(projectId, memory);
  return newEntry;
}

export async function getUserContext(
  projectId: string,
  filter?: { category?: UserContextEntry['category']; active?: boolean },
): Promise<UserContextEntry[]> {
  const memory = await getMemory(projectId);
  let entries = memory.userContext;
  if (filter?.category !== undefined) {
    entries = entries.filter((e) => e.category === filter.category);
  }
  if (filter?.active !== undefined) {
    entries = entries.filter((e) => e.active === filter.active);
  }
  return entries;
}

// ─── Decisions ──────────────────────────────────────────────────────────────

export async function addDecision(
  projectId: string,
  decision: Omit<DecisionRecord, 'id'>,
): Promise<DecisionRecord> {
  const memory = await getMemory(projectId);
  const newDecision: DecisionRecord = {
    ...decision,
    id: crypto.randomUUID(),
  };
  memory.decisions.push(newDecision);
  await saveMemory(projectId, memory);
  return newDecision;
}

export async function getDecisions(
  projectId: string,
): Promise<DecisionRecord[]> {
  const memory = await getMemory(projectId);
  return memory.decisions;
}

// ─── Performance Baselines ──────────────────────────────────────────────────

export async function updateBaseline(
  projectId: string,
  baseline: Omit<PerformanceBaseline, 'id'>,
): Promise<PerformanceBaseline> {
  const memory = await getMemory(projectId);

  // Replace existing baseline for same platform+metric, or add new
  const existingIndex = memory.baselines.findIndex(
    (b) => b.platform === baseline.platform && b.metric === baseline.metric,
  );

  const newBaseline: PerformanceBaseline = {
    ...baseline,
    id: existingIndex >= 0 ? memory.baselines[existingIndex].id : crypto.randomUUID(),
  };

  if (existingIndex >= 0) {
    memory.baselines[existingIndex] = newBaseline;
  } else {
    memory.baselines.push(newBaseline);
  }

  await saveMemory(projectId, memory);
  return newBaseline;
}

export async function getBaselines(
  projectId: string,
  platform?: string,
): Promise<PerformanceBaseline[]> {
  const memory = await getMemory(projectId);
  if (platform) {
    return memory.baselines.filter((b) => b.platform === platform);
  }
  return memory.baselines;
}
