import { forwardRef } from 'react';
import {
  Alert as NativeAlert,
  Pressable as NativePressable,
  Text as NativeText,
  TextInput as NativeTextInput,
} from 'react-native';

import {
  getActiveLocaleTag,
  translateText,
  useLocalization,
} from './LocalizationProvider';

import type { ComponentProps, ComponentRef, ReactNode } from 'react';

function localizeNode(
  node: ReactNode,
  t: (source: string) => string,
): ReactNode {
  if (typeof node === 'string') {
    const leading = node.match(/^\s*/)?.[0] ?? '';
    const trailing = node.match(/\s*$/)?.[0] ?? '';
    const source = node.slice(leading.length, node.length - trailing.length);
    return source ? `${leading}${t(source)}${trailing}` : node;
  }
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, t));
  return node;
}

export function LocalizedText({
  children,
  ...props
}: ComponentProps<typeof NativeText>) {
  const { locale, t } = useLocalization();
  const accessibilityLabel = props.accessibilityLabel
    ? t(props.accessibilityLabel)
    : undefined;
  return (
    <NativeText
      {...props}
      accessibilityLabel={accessibilityLabel}
      style={[props.style, locale === 'hi' && styles.hindi]}
    >
      {localizeNode(children, t)}
    </NativeText>
  );
}

export const LocalizedPressable = forwardRef<
  ComponentRef<typeof NativePressable>,
  ComponentProps<typeof NativePressable>
>(function LocalizedPressable({ accessibilityLabel, ...props }, ref) {
  const { t } = useLocalization();
  return (
    <NativePressable
      {...props}
      accessibilityLabel={
        accessibilityLabel ? t(accessibilityLabel) : undefined
      }
      ref={ref}
    />
  );
});

export const LocalizedTextInput = forwardRef<
  ComponentRef<typeof NativeTextInput>,
  ComponentProps<typeof NativeTextInput>
>(function LocalizedTextInput(
  { accessibilityLabel, placeholder, ...props },
  ref,
) {
  const { locale, t } = useLocalization();
  return (
    <NativeTextInput
      {...props}
      accessibilityLabel={
        accessibilityLabel ? t(accessibilityLabel) : undefined
      }
      placeholder={placeholder ? t(placeholder) : undefined}
      ref={ref}
      style={[props.style, locale === 'hi' && styles.hindi]}
    />
  );
});

export const LocalizedAlert = {
  alert: (...args: Parameters<typeof NativeAlert.alert>) => {
    const [title, message, buttons, options] = args;
    NativeAlert.alert(
      translateText(title),
      message ? translateText(message) : undefined,
      buttons?.map((button) => ({
        ...button,
        text: button.text ? translateText(button.text) : undefined,
      })),
      options,
    );
  },
  prompt: NativeAlert.prompt,
};

export function formatDate(value: string | number | Date) {
  return new Intl.DateTimeFormat(getActiveLocaleTag(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat(getActiveLocaleTag(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));
}

const styles = {
  hindi: { fontFamily: undefined },
} as const;
