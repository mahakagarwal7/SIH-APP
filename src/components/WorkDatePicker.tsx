import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  LocalizedPressable as Pressable,
  LocalizedText as Text,
} from '@/features/localization/LocalizedText';

import {
  formatWorkDate,
  isSelectableWorkDate,
  toLocalWorkDate,
} from './workDate';

import type { WorkDatePickerProps } from './WorkDatePicker.native';
import type { ChangeEvent, CSSProperties } from 'react';

export function WorkDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  locale,
  now = new Date(),
}: WorkDatePickerProps) {
  const today = toLocalWorkDate(now);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} · {required ? 'Required' : 'Optional'}
      </Text>
      {createElement('input', {
        'aria-label': `Choose ${label.toLocaleLowerCase()}`,
        disabled,
        max: today,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          const next = event.currentTarget.value;
          if (!next) onChange(null);
          else if (isSelectableWorkDate(next, now)) onChange(next);
        },
        style: disabled
          ? { ...webFieldStyle, backgroundColor: '#e7edf0', opacity: 0.75 }
          : webFieldStyle,
        type: 'date',
        value: value ?? '',
      })}
      <Text style={styles.readable}>
        {value ? formatWorkDate(value, locale) : 'Not recorded'}
      </Text>
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
  label: { color: '#17354c', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  readable: { color: '#627786', fontSize: 14, marginTop: 6 },
  clear: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  clearText: { color: '#8a3d2e', fontSize: 14, fontWeight: '600' },
});

const webFieldStyle: CSSProperties = {
  minHeight: 52,
  border: '1px solid #aebdc7',
  backgroundColor: '#fff',
  color: '#17354c',
  fontSize: 16,
  padding: 14,
};
