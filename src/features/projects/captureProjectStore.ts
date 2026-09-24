import type { ProjectContext } from './myWorkService';

export async function rememberProjectContext(
  _userId: string,
  _context: ProjectContext,
) {}

export async function readRememberedProjectContext(_userId: string) {
  return null as ProjectContext | null;
}

export async function forgetRememberedProjectContext(_userId: string) {}
