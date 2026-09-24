import { openDatabaseAsync } from 'expo-sqlite';

import { createCaptureProjectIndex } from './captureProjectIndex';

import type { ProjectContext } from './myWorkService';

const index = openDatabaseAsync('nirmaan-drafts.db').then(
  createCaptureProjectIndex,
);

export async function rememberProjectContext(
  userId: string,
  context: ProjectContext,
) {
  if (context.member.user_id !== userId || !context.member.active)
    throw new Error('Only verified active project access can be remembered.');
  await (await index).put(userId, context);
}

export async function readRememberedProjectContext(userId: string) {
  const context = await (await index).get(userId);
  if (!context) return null;
  if (
    context.member.user_id !== userId ||
    context.member.project_id !== context.project.id ||
    !context.member.active
  )
    return null;
  return context;
}

export async function forgetRememberedProjectContext(userId: string) {
  await (await index).remove(userId);
}
