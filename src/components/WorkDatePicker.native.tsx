import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
} from '@/features/localization/LocalizedText';

import {
  formatWorkDate,
  isSelectableWorkDate,
  parseLocalWorkDate,
  startOfLocalDay,
  toLocalWorkDate,
} from './workDate';

import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

export type WorkDatePickerProps = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  locale?: string;
  now?: Date;
};

export function WorkDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  locale,
  now = new Date(),
}: WorkDatePickerProps) {
  const today = startOfLocalDay(now);
  const selected = value ? parseLocalWorkDate(value) : null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected ?? today);
  const display = value ? formatWorkDate(value, locale) : 'Not recorded';

  function openPicker() {
    if (disabled) return;
    setDraft(selected ?? today);
    setOpen(true);
  }

  function chooseDate(event: DateTimePickerEvent, date?: Date) {
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (!date) return;
    const next = toLocalWorkDate(date);
    if (!isSelectableWorkDate(next, today)) return;
    setDraft(startOfLocalDay(date));
    if (Platform.OS === 'android') {
      onChange(next);
      setOpen(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} · {required ? 'Required' : 'Optional'}
      </Text>
      <Pressable
        accessibilityLabel={`Choose ${label.toLocaleLowerCase()}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={[styles.field, disabled && styles.disabled]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {display}
        </Text>
        <Text style={styles.action}>Choose date</Text>
      </Pressable>
      {open && (
        <View style={styles.picker}>
          <DateTimePicker
            display="default"
            maximumDate={today}
            mode="date"
            onChange={chooseDate}
            value={draft}
          />
          {Platform.OS !== 'android' && (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(toLocalWorkDate(draft));
                  setOpen(false);
                }}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>Use date</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      {!!value && !disabled && (
        <Pressable
          accessibilityLabel={`Clear ${label.toLocaleLowerCase()}`}
          accessibilityRole="button"
          onPress={() => onChange(null)}
          style={styles.clear}
        >
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  label: {
    color: '#17354c',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  field: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#aebdc7',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  disabled: { backgroundColor: '#e7edf0', opacity: 0.75 },
  value: { color: '#17354c', fontSize: 16, lineHeight: 24 },
  placeholder: { color: '#627786' },
  action: { color: '#266b8c', fontSize: 14, fontWeight: '700' },
  picker: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#aebdc7',
    backgroundColor: '#fff',
    padding: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: '#266b8c', fontSize: 15, fontWeight: '600' },
  primary: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#17354c',
    paddingHorizontal: 16,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clear: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  clearText: { color: '#8a3d2e', fontSize: 14, fontWeight: '600' },
});
