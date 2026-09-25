import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { LocalizedText as Text } from '@/features/localization/LocalizedText';
import { useProjectSelection } from '@/features/projects/useProjectSelection';

import { NavLink, shellStyles } from './shellUi';

export function ShellHeader() {
  const { offline } = useAuth();
  const project = useProjectSelection();
  const pathname = usePathname();
  const workspace = pathname.startsWith('/field')
    ? 'FIELD'
    : pathname.startsWith('/manager')
      ? 'MANAGER'
      : 'MOBILE';
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View>
          <Text style={[shellStyles.heading, styles.brand]}>Nirmaan.</Text>
          <Text style={styles.workspace}>{workspace}</Text>
        </View>
        {pathname !== '/account' && <NavLink href="/account" label="Account" />}
      </View>
      <View style={[styles.row, styles.project]}>
        <Text style={styles.projectText}>
          {project.error
            ? 'Project unavailable'
            : (project.data?.project.name ??
              (project.isPending
                ? offline
                  ? 'Project not loaded'
                  : 'Loading project…'
                : 'No active project access'))}
        </Text>
        <View style={styles.switches}>
          <NavLink href="/workspaces" label="Switch workspace" />
          <NavLink href="/projects" label="Change project" />
        </View>
      </View>
      {offline && (
        <Text accessibilityRole="alert" style={styles.offline}>
          Offline · Connect to refresh your session.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d7e0e5',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  brand: { marginBottom: 0, fontSize: 30 },
  workspace: {
    color: '#627786',
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1,
  },
  project: { borderTopWidth: 1, borderTopColor: '#d7e0e5', paddingVertical: 0 },
  projectText: {
    color: '#627786',
    fontSize: 14,
    lineHeight: 22,
    flexShrink: 1,
  },
  switches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  offline: {
    color: '#17354c',
    backgroundColor: '#e8eff3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 22,
  },
});
