import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NavLink, ShellPage, shellStyles } from '@/features/navigation/shellUi';

import { groupMyWork, siteToday } from './myWork';
import { useMyWork } from './useMyWork';
import { useProjectRecentReports } from './useProjectRecentReports';

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function FieldHomeScreen() {
  const [focused, setFocused] = useState(false);
  const { project, work, refresh, offline } = useMyWork();
  const recent = useProjectRecentReports(project.data?.project.id, focused);
  const refreshReports = recent.refetch;
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void refresh();
      void refreshReports();
      return () => setFocused(false);
    }, [refresh, refreshReports]),
  );
  const context = project.data;
  const groups =
    context && work.data && !work.error
      ? groupMyWork(
          work.data.snapshot.activities,
          work.data.assignments,
          context.member.user_id,
          siteToday(),
        )
      : null;
  const current = groups?.find((group) => group.title === 'Today')?.items ?? [];

  return (
    <ShellPage title="Field home" eyebrow="FIELD · TODAY">
      <Text style={shellStyles.body}>
        Current assignments and the latest report outcomes for your selected
        project.
      </Text>
      {offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Showing project context already saved on this device. Server
          data may have changed.
        </Text>
      )}
      {project.error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Project unavailable
          </Text>
          <Text style={shellStyles.body}>{project.error.message}</Text>
        </View>
      ) : project.isPending ? (
        <View style={styles.state}>
          {!offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>Loading your project…</Text>
        </View>
      ) : !context ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>No active project access</Text>
          <Text style={shellStyles.body}>
            Ask a project manager to check your membership.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.projectRow}>
            <View style={styles.flex}>
              <Text style={styles.project}>{context.project.name}</Text>
              <Text style={styles.meta}>
                {context.member.role} · Membership v{context.member.version}
              </Text>
            </View>
            <NavLink href="/projects" label="Change" />
          </View>

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Current assignments
            </Text>
            <NavLink href="/field/work" label="View all" />
          </View>
          {work.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {work.error.message}
            </Text>
          ) : !work.data ? (
            <Text style={styles.empty}>
              {offline
                ? 'Connect to load assignments for this project.'
                : 'Loading assignments…'}
            </Text>
          ) : work.data.snapshot.revisionId === null ? (
            <Text style={styles.empty}>
              No active schedule for this project.
            </Text>
          ) : current.length === 0 ? (
            <Text style={styles.empty}>No assignment today.</Text>
          ) : (
            current.slice(0, 3).map(({ activity, assignment }) => (
              <View style={shellStyles.card} key={activity.id}>
                <Text style={styles.meta}>
                  {activity.externalId} · {activity.discipline}
                </Text>
                <Text style={shellStyles.cardTitle}>{activity.name}</Text>
                <Text style={shellStyles.body}>{activity.location}</Text>
                <Text style={styles.meta}>
                  Assigned through {assignment.effective_to}
                </Text>
              </View>
            ))
          )}
          <NavLink
            href="/field/report"
            label="Create a field report"
            detail="Record voice or add text and photos for this project."
          />

          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Recent reports
            </Text>
            <NavLink href="/field/reports" label="View all" />
          </View>
          {recent.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              Recent report data may be incomplete or stale because refresh
              failed.
            </Text>
          ) : null}
          {recent.error && !recent.items.length ? null : recent.isPending &&
            !recent.items.length ? (
            <Text style={styles.empty}>Loading recent reports…</Text>
          ) : recent.items.length === 0 ? (
            <Text style={styles.empty}>No reports for this project yet.</Text>
          ) : (
            recent.items.map((item) => (
              <View style={shellStyles.card} key={item.captureId}>
                <View style={styles.projectRow}>
                  <Text style={styles.status}>{item.status}</Text>
                  <Text style={styles.meta}>{shortDate(item.createdAt)}</Text>
                </View>
                <Text style={shellStyles.body}>
                  {item.summary || item.detail}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 16,
    marginVertical: 16,
    fontSize: 15,
    lineHeight: 24,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  projectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1, minWidth: 180 },
  project: {
    color: '#17354c',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
  },
  meta: { color: '#627786', fontSize: 13, lineHeight: 21 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
  },
  sectionTitle: {
    color: '#17354c',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
  },
  empty: {
    color: '#627786',
    fontSize: 15,
    lineHeight: 24,
    paddingVertical: 18,
  },
  error: {
    color: '#8a2e25',
    backgroundColor: '#fff0ed',
    padding: 16,
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  status: { color: '#266b8c', fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
