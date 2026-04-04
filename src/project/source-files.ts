// Source Files — upload tracking, linking to executions

import type { SourceFile } from './types';
import { getProject, updateProject } from './project';

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function addSourceFile(
  projectId: string,
  file: Omit<SourceFile, 'id' | 'uploadedAt'>,
): Promise<SourceFile> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const newFile: SourceFile = {
    ...file,
    id: crypto.randomUUID(),
    uploadedAt: new Date(),
  };

  const sourceFiles = [...project.sourceFiles, newFile];
  await updateProject(projectId, { sourceFiles });
  return newFile;
}

export async function getSourceFiles(
  projectId: string,
  filter?: { category?: SourceFile['category'] },
): Promise<SourceFile[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  let files = project.sourceFiles;
  if (filter?.category !== undefined) {
    files = files.filter((f) => f.category === filter.category);
  }
  return files;
}

export async function deleteSourceFile(
  projectId: string,
  fileId: string,
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const sourceFiles = project.sourceFiles.filter((f) => f.id !== fileId);
  if (sourceFiles.length === project.sourceFiles.length) {
    throw new Error(`Source file ${fileId} not found in project ${projectId}`);
  }

  await updateProject(projectId, { sourceFiles });
}

// ─── Execution Linking ──────────────────────────────────────────────────────

export async function linkFileToExecution(
  projectId: string,
  fileId: string,
  executionId: string,
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const file = project.sourceFiles.find((f) => f.id === fileId);
  if (!file) throw new Error(`Source file ${fileId} not found in project ${projectId}`);

  if (!file.linkedExecutions.includes(executionId)) {
    file.linkedExecutions.push(executionId);
    await updateProject(projectId, { sourceFiles: project.sourceFiles });
  }
}

export async function getFilesForExecution(
  executionId: string,
  projectId: string,
): Promise<SourceFile[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  return project.sourceFiles.filter((f) =>
    f.linkedExecutions.includes(executionId),
  );
}
