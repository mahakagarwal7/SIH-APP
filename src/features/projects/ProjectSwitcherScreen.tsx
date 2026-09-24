import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  LocalizedText as Text,
  LocalizedPressable as Pressable,
} from '@/features/localization/LocalizedText';
import {
  BackButton,
  ShellPage,
  shellStyles,
} from '@/features/navigation/shellUi';

import { useProjectSelection } from './useProjectSelection';

export function ProjectSwitcherScreen() {
  const router = useRouter();
  const selection = useProjectSelection();
  const [changing, setChanging] = useState<string>();
  const [changeError, setChangeError] = useState('');

  async function choose(projectId: string) {
    if (
      changing ||
      selection.offline ||
      projectId === selection.data?.project.id
    )
      return;
    setChanging(projectId);
    setChangeError('');
    try {
      await selection.select(projectId);
      if (router.canGoBack()) router.back();
      else router.replace('/workspaces');
    } catch {
      setChangeError(
        'The project could not be selected. Refresh your access and try again.',
      );
    } finally {
      setChanging(undefined);
    }
  }

  return (
    <ShellPage>
      <BackButton />
      <Text accessibilityRole="header" style={shellStyles.heading}>
        Choose a project
      </Text>
      <Text style={shellStyles.body}>
        Only projects with an active membership are available.
      </Text>
      {selection.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          Offline · Your last verified project remains selected. Connect before
          changing projects.
        </Text>
      )}
      {!!changeError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {changeError}
        </Text>
      )}
      {selection.error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Projects unavailable
          </Text>
          <Text style={shellStyles.body}>{selection.error.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: selection.offline }}
            disabled={selection.offline}
            onPress={() => void selection.refetch()}
            style={styles.retry}
          >
            <Text style={shellStyles.linkText}>Refresh access</Text>
          </Pressable>
        </View>
      ) : selection.isPending ? (
        <View style={styles.state}>
          {!selection.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>Loading project access…</Text>
        </View>
      ) : selection.projects.length === 0 && !selection.data ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>No active project access</Text>
          <Text style={shellStyles.body}>
            Ask a project manager to check your membership.
          </Text>
        </View>
      ) : (
        selection.projects.map((context) => {
          const selected = context.project.id === selection.data?.project.id;
          const busy = changing === context.project.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${context.project.name}`}
              accessibilityState={{
                selected,
                disabled: selection.offline || !!changing,
              }}
              disabled={selection.offline || !!changing}
              key={context.project.id}
              onPress={() => void choose(context.project.id)}
              style={[shellStyles.card, selected && styles.selected]}
            >
              <View style={styles.row}>
                <Text style={shellStyles.cardTitle}>
                  {context.project.name}
                </Text>
                <Text style={styles.badge}>
                  {busy ? 'Changing…' : selected ? 'Selected' : 'Select'}
                </Text>
              </View>
              <Text style={shellStyles.body}>
                {context.member.display_name || 'Name not recorded'} ·{' '}
                {context.member.role}
              </Text>
            </Pressable>
          );
        })
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 16,
    marginTop: 20,
    fontSize: 15,
    lineHeight: 24,
  },
  error: {
    backgroundColor: '#fff0ed',
    color: '#8a2e25',
    padding: 16,
    marginTop: 20,
    fontSize: 15,
    lineHeight: 24,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  retry: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
  },
  selected: { borderLeftColor: '#17354c', backgroundColor: '#f8fbfc' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  badge: { color: '#266b8c', fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
