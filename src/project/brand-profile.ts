// Brand Profile — voice, tone, visual style, taboo topics, key messages

import type { BrandProfile, LanguageCode } from './types';
import { getProject, updateProject } from './project';

// ─── Read / Write ───────────────────────────────────────────────────────────

export async function getBrandProfile(
  projectId: string,
): Promise<BrandProfile> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return project.memory.brandProfile;
}

export async function updateBrandProfile(
  projectId: string,
  updates: Partial<BrandProfile>,
): Promise<BrandProfile> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const merged: BrandProfile = { ...project.memory.brandProfile, ...updates };
  const memory = { ...project.memory, brandProfile: merged };
  await updateProject(projectId, { memory });
  return merged;
}

// ─── Convenience Mutators ───────────────────────────────────────────────────

export async function addVoiceDescriptor(
  projectId: string,
  descriptor: string,
): Promise<void> {
  const profile = await getBrandProfile(projectId);
  if (!profile.voiceDescriptors.includes(descriptor)) {
    profile.voiceDescriptors.push(descriptor);
    await updateBrandProfile(projectId, {
      voiceDescriptors: profile.voiceDescriptors,
    });
  }
}

export async function addKeyMessage(
  projectId: string,
  message: string,
): Promise<void> {
  const profile = await getBrandProfile(projectId);
  if (!profile.keyMessages.includes(message)) {
    profile.keyMessages.push(message);
    await updateBrandProfile(projectId, {
      keyMessages: profile.keyMessages,
    });
  }
}

export async function addTabooTopic(
  projectId: string,
  topic: string,
): Promise<void> {
  const profile = await getBrandProfile(projectId);
  if (!profile.tabooTopics.includes(topic)) {
    profile.tabooTopics.push(topic);
    await updateBrandProfile(projectId, {
      tabooTopics: profile.tabooTopics,
    });
  }
}

export async function setLanguageNote(
  projectId: string,
  lang: LanguageCode,
  note: string,
): Promise<void> {
  const profile = await getBrandProfile(projectId);
  profile.languageNotes[lang] = note;
  await updateBrandProfile(projectId, {
    languageNotes: profile.languageNotes,
  });
}
