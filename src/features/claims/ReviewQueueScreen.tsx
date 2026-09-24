import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ShellPage, shellStyles } from '@/features/navigation/shellUi';

import { candidateReasons, reviewStateLabels } from './reviewContracts';
import { useReviewQueue } from './useReviewQueue';

import type { CandidateMatch } from './reviewContracts';
import type { ReviewQueueItem } from './reviewQueueService';

function dateLabel(value: string | null) {
  if (!value) return 'Not recorded';
  const date = value.includes('T')
    ? new Date(value)
    : new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function detailLabel(value: string | null) {
  return value || 'Not recorded';
}

function sourceLabel(source: ReviewQueueItem['report']['source_kind']) {
  return {
    text: 'Text report',
    voice: 'Voice report',
    spreadsheet: 'Spreadsheet report',
  }[source];
}

function CandidateCard({
  candidate,
  staleRevision,
}: {
  candidate: ReviewQueueItem['candidates'][number];
  staleRevision: boolean;
}) {
  const activity = candidate.activity;
  return (
    <View style={styles.candidate}>
      <View style={styles.row}>
        <Text style={styles.candidateRank}>Candidate {candidate.rank}</Text>
        <Text style={styles.score}>
          Match score {Math.round(candidate.score * 100)}%
        </Text>
      </View>
      <Text style={styles.candidateTitle}>
        {activity
          ? `${activity.externalId} · ${activity.name}`
          : `Activity ${candidate.activity_id.slice(0, 8)}`}
      </Text>
      <Text style={styles.detail}>
        {activity?.location || 'Activity unavailable in the active schedule'}
      </Text>
      {candidateReasons(candidate as CandidateMatch).map((reason) => (
        <Text key={reason} style={styles.reason}>
          • {reason}
        </Text>
      ))}
      {staleRevision && (
        <Text style={styles.revisionNotice}>
          Candidate belongs to the report’s earlier schedule revision.
        </Text>
      )}
    </View>
  );
}

function ReviewCard({
  item,
  expanded,
  onToggle,
}: {
  item: ReviewQueueItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const facts = item.claim.facts;
  const headline = facts.activityHint || facts.evidenceQuote;
  return (
    <View style={shellStyles.card}>
      <Text style={styles.identifier}>
        FR-{item.report.id.slice(0, 8).toUpperCase()} ·{' '}
        {facts.kind.replaceAll('_', ' ')}
      </Text>
      <Text style={styles.badge}>{reviewStateLabels[item.claim.state]}</Text>
      <Text accessibilityRole="header" style={shellStyles.cardTitle}>
        {headline}
      </Text>
      <Text style={styles.detail}>
        {item.reporterName} · {sourceLabel(item.report.source_kind)} · Received{' '}
        {dateLabel(item.report.received_at)}
      </Text>
      {(item.claim.validation_flags[0] || item.claim.manual_review) && (
        <Text style={styles.flag}>
          {item.claim.validation_flags[0] || 'Manual review required'}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.open}
      >
        <Text style={shellStyles.linkText}>
          {expanded ? 'Hide report context' : 'Review report context'}
        </Text>
      </Pressable>
      {expanded && (
        <View style={styles.expanded}>
          <Text style={styles.sectionTitle}>Original field report</Text>
          <Text selectable style={styles.source}>
            {item.original.source_text}
          </Text>
          <Text style={styles.detail}>
            Original work date: {dateLabel(item.original.work_date)}
          </Text>

          <Text style={styles.sectionTitle}>Extracted claim</Text>
          <Text style={styles.quote}>“{facts.evidenceQuote}”</Text>
          <Text style={styles.detail}>
            Event date: {dateLabel(facts.eventDate)}
          </Text>
          <Text style={styles.detail}>
            Location: {detailLabel(facts.location)}
          </Text>
          <Text style={styles.detail}>Stage: {detailLabel(facts.stage)}</Text>
          <Text style={styles.detail}>
            Scope: {facts.scope} ·{' '}
            {facts.fullScope ? 'Full scope reported' : 'Partial scope reported'}
          </Text>
          {facts.quantity && (
            <Text style={styles.detail}>
              Quantity: {facts.quantity.value} {facts.quantity.unit} ·{' '}
              {facts.quantity.mode}
            </Text>
          )}
          {facts.qualifiers.map((qualifier) => (
            <Text key={qualifier} style={styles.reason}>
              • {qualifier}
            </Text>
          ))}

          {(item.claim.validation_flags.length > 0 ||
            facts.missingFields.length > 0) && (
            <>
              <Text style={styles.sectionTitle}>Why it needs review</Text>
              {item.claim.validation_flags.map((flag) => (
                <Text key={flag} style={styles.reason}>
                  • {flag}
                </Text>
              ))}
              {facts.missingFields.map((field) => (
                <Text key={field} style={styles.reason}>
                  • Missing: {field}
                </Text>
              ))}
            </>
          )}

          <Text style={styles.sectionTitle}>Candidate activities</Text>
          {item.candidates.length ? (
            item.candidates.map((candidate) => (
              <CandidateCard
                key={candidate.activity_id}
                candidate={candidate}
                staleRevision={candidate.revision_id !== item.currentRevisionId}
              />
            ))
          ) : (
            <Text style={styles.flag}>
              No candidate activity was recorded. This claim needs manual
              review.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export function ReviewQueueScreen() {
  const [requestedPage, setRequestedPage] = useState({
    projectId: undefined as string | undefined,
    value: 0,
  });
  const [expanded, setExpanded] = useState<{
    projectId: string;
    claimId: string;
  } | null>(null);
  const { project, queue, refresh, authorized, page } = useReviewQueue(
    requestedPage.value,
    requestedPage.projectId,
  );
  const projectId = project.data?.project.id;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const data = queue.data;
  const error = project.error || queue.error;
  const busy = project.isFetching || queue.isFetching;

  return (
    <ShellPage title="Review queue" eyebrow="MANAGER · FIELD EVIDENCE">
      <Text style={shellStyles.body}>
        Inspect unresolved field claims, their original report and proposed
        activity matches.
      </Text>
      <View style={styles.toolbar}>
        <Text style={styles.detail}>
          {project.data?.project.name || 'No project selected'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: project.offline || busy }}
          disabled={project.offline || busy}
          onPress={() => void refresh()}
          style={[styles.refresh, (project.offline || busy) && styles.disabled]}
        >
          <Text style={shellStyles.linkText}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
      {project.offline && (
        <Text accessibilityRole="alert" style={styles.notice}>
          {data && !error
            ? 'Offline · Showing the previously loaded review page. Claim states may have changed.'
            : 'Offline · Connect to load the review queue.'}
        </Text>
      )}
      {error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Review queue unavailable
          </Text>
          <Text style={shellStyles.body}>{error.message}</Text>
        </View>
      ) : project.isPending ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'Project access has not been loaded.'
              : 'Loading your project access…'}
          </Text>
        </View>
      ) : !project.data ? (
        <View style={styles.state}>
          <Text style={shellStyles.cardTitle}>No active project access</Text>
          <Text style={shellStyles.body}>
            Ask an administrator to check your project membership.
          </Text>
        </View>
      ) : !authorized ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={shellStyles.cardTitle}>
            Manager access required
          </Text>
          <Text style={shellStyles.body}>
            Your selected project role cannot read candidate matches or review
            claims.
          </Text>
        </View>
      ) : !data ? (
        <View style={styles.state}>
          {!project.offline && <ActivityIndicator color="#266b8c" />}
          <Text style={shellStyles.body}>
            {project.offline
              ? 'No review page has been loaded for this project.'
              : 'Loading unresolved claims…'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.count}>
            {data.total} unresolved {data.total === 1 ? 'claim' : 'claims'}
          </Text>
          {!data.items.length && data.total === 0 ? (
            <View style={styles.state}>
              <Text style={shellStyles.cardTitle}>Queue is clear</Text>
              <Text style={shellStyles.body}>
                This project has no pending, clarification, verification or
                disputed claims.
              </Text>
            </View>
          ) : (
            data.items.map((item) => (
              <ReviewCard
                key={item.claim.id}
                item={item}
                expanded={
                  expanded?.projectId === projectId &&
                  expanded?.claimId === item.claim.id
                }
                onToggle={() =>
                  projectId &&
                  setExpanded((current) =>
                    current?.projectId === projectId &&
                    current.claimId === item.claim.id
                      ? null
                      : { projectId, claimId: item.claim.id },
                  )
                }
              />
            ))
          )}
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: page === 0 || busy }}
              disabled={page === 0 || busy}
              onPress={() => {
                setExpanded(null);
                setRequestedPage({ projectId, value: page - 1 });
              }}
              style={[
                styles.pageButton,
                (page === 0 || busy) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>Previous</Text>
            </Pressable>
            <Text style={styles.detail}>Page {page + 1}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !data.hasNext || busy }}
              disabled={!data.hasNext || busy}
              onPress={() => {
                setExpanded(null);
                setRequestedPage({ projectId, value: page + 1 });
              }}
              style={[
                styles.pageButton,
                (!data.hasNext || busy) && styles.disabled,
              ]}
            >
              <Text style={shellStyles.linkText}>Next</Text>
            </Pressable>
          </View>
        </>
      )}
    </ShellPage>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  refresh: {
    minHeight: 48,
    minWidth: 88,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
  },
  disabled: { opacity: 0.55 },
  detail: { color: '#627786', fontSize: 14, lineHeight: 22 },
  notice: {
    backgroundColor: '#e8eff3',
    color: '#17354c',
    padding: 16,
    marginVertical: 12,
    fontSize: 15,
    lineHeight: 24,
  },
  state: { marginTop: 24, gap: 12, alignItems: 'flex-start' },
  count: { color: '#17354c', fontSize: 16, lineHeight: 24, marginTop: 18 },
  identifier: {
    color: '#627786',
    fontSize: 13,
    lineHeight: 22,
    letterSpacing: 0.4,
  },
  badge: {
    color: '#76541d',
    backgroundColor: '#fff2d9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    lineHeight: 20,
  },
  flag: {
    color: '#8a3d2e',
    backgroundColor: '#fbeae6',
    padding: 10,
    fontSize: 14,
    lineHeight: 22,
  },
  open: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: '#d7e0e5',
    marginTop: 4,
    gap: 8,
  },
  sectionTitle: {
    color: '#17354c',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  source: { color: '#17354c', fontSize: 16, lineHeight: 26 },
  quote: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 25,
    fontStyle: 'italic',
  },
  candidate: {
    borderWidth: 1,
    borderColor: '#d7e0e5',
    padding: 14,
    gap: 5,
    backgroundColor: '#f8fafb',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  candidateRank: { color: '#627786', fontSize: 13, lineHeight: 20 },
  score: { color: '#266b8c', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  candidateTitle: {
    color: '#17354c',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  reason: { color: '#455d6d', fontSize: 14, lineHeight: 22 },
  revisionNotice: { color: '#76541d', fontSize: 13, lineHeight: 21 },
  pagination: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pageButton: {
    minHeight: 48,
    minWidth: 96,
    borderWidth: 1,
    borderColor: '#d7e0e5',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
