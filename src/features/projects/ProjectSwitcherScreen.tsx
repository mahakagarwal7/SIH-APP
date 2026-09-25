import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useLocalization } from '@/features/localization/LocalizationProvider';
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

import type { ProjectContext } from './myWorkService';

function ProjectChoiceCard({
  context,
  selected,
  busy,
  disabled,
  onPress,
}: {
  context: ProjectContext;
  selected: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useLocalization();
  const roleLabel = {
    reporter: 'Reporter',
    supervisor: 'Supervisor',
    planner: 'Planner',
    manager: 'Manager',
  }[context.member.role];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        selected
          ? `${context.project.name}, ${t('Selected')}`
          : `${t('Select')} ${context.project.name}`
      }
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[shellStyles.card, selected && styles.selected]}
    >
      <View style={styles.row}>
        <Text style={shellStyles.cardTitle}>{context.project.name}</Text>
        <Text style={styles.badge}>
          {busy ? 'Changing…' : selected ? 'Selected' : 'Select'}
        </Text>
      </View>
      <Text style={shellStyles.body}>
        {context.member.display_name || 'Name not recorded'} · {roleLabel}
      </Text>
    </Pressable>
  );
}

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
        {!selection.isPending &&
        !selection.error &&
        selection.projects.length === 1
          ? 'This is the only project available to your account.'
          : 'Only projects with an active membership are available.'}
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
            <ProjectChoiceCard
              context={context}
              selected={selected}
              busy={busy}
              disabled={selection.offline || !!changing || selected}
              key={context.project.id}
              onPress={() => void choose(context.project.id)}
            />
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
    alignItems: 'flex-start',
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#e8eff3',
    borderRadius: 999,
    color: '#266b8c',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
});
