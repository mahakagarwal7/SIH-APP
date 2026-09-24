import {
  resolveProjectSelection,
  sameProjectContext,
} from './projectSelection';

import type { ProjectContext } from './myWorkService';

function context(
  projectId: string,
  userId = 'alice',
  version = 1,
): ProjectContext {
  return {
    member: {
      project_id: projectId,
      user_id: userId,
      display_name: 'Field worker',
      role: 'reporter',
      active: true,
      version,
    },
    project: { id: projectId, name: `Project ${projectId}` },
  };
}

it('keeps a remembered choice only while it remains in current memberships', () => {
  const first = context('one');
  const second = context('two');
  expect(resolveProjectSelection([first, second], second, false)).toBe(second);
  expect(resolveProjectSelection([first], second, false)).toBe(first);
  expect(resolveProjectSelection([], second, false)).toBeUndefined();
});

it('restores only the same-account remembered context while offline', () => {
  const remembered = context('two');
  expect(resolveProjectSelection(undefined, remembered, true)).toBe(remembered);
  expect(resolveProjectSelection(undefined, null, true)).toBeUndefined();
});

it('detects membership version and project-name changes before persistence is skipped', () => {
  const original = context('one');
  expect(sameProjectContext(original, { ...original })).toBe(true);
  expect(sameProjectContext(original, context('one', 'alice', 2))).toBe(false);
  expect(
    sameProjectContext(original, {
      ...original,
      project: { ...original.project, name: 'Renamed' },
    }),
  ).toBe(false);
});
