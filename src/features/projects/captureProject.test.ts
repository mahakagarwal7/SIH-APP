import { selectCaptureProject } from './captureProject';

import type { ProjectContext } from './myWorkService';

const remembered: ProjectContext = {
  member: {
    project_id: 'project',
    user_id: 'user',
    display_name: 'Reporter',
    role: 'reporter',
    active: true,
    version: 1,
  },
  project: { id: 'project', name: 'Site project' },
};

it('uses remembered verified access only while offline', () => {
  expect(selectCaptureProject(undefined, remembered, true)).toBe(remembered);
  expect(selectCaptureProject(undefined, remembered, false)).toBeUndefined();
});

it('always prefers current live access over remembered context', () => {
  const live = {
    ...remembered,
    project: { id: 'project', name: 'Renamed project' },
  };
  expect(selectCaptureProject(live, remembered, false)).toBe(live);
  expect(selectCaptureProject(live, remembered, true)).toBe(live);
});
