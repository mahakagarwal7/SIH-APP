import { Pressable, StyleSheet, View } from 'react-native';

import { LocalizedText as Text } from './LocalizedText';
import { useLocalization } from './LocalizationProvider';
import { languageNames } from './translations';

import type { AppLocale } from './translations';

const locales: AppLocale[] = ['en', 'hi'];

export function LanguageSelector() {
  const localization = useLocalization();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        Language
      </Text>
      <Text style={styles.help}>
        Choose the language used throughout Nirmaan.
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {locales.map((locale) => {
          const selected = localization.locale === locale;
          return (
            <Pressable
              accessibilityLabel={languageNames[locale]}
              accessibilityRole="radio"
              accessibilityState={{
                checked: selected,
                disabled: localization.saving,
              }}
              disabled={localization.saving}
              key={locale}
              onPress={() => void localization.setLocale(locale)}
              style={[styles.option, selected && styles.selected]}
            >
              <Text
                style={[styles.optionText, selected && styles.selectedText]}
              >
                {languageNames[locale]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {localization.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {localization.error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  heading: {
    color: '#17354c',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 28,
  },
  help: { color: '#586c7a', fontSize: 14, lineHeight: 22, marginTop: 4 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  option: {
    alignItems: 'center',
    borderColor: '#a9bac6',
    borderRadius: 3,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 112,
    padding: 12,
  },
  selected: { backgroundColor: '#17354c', borderColor: '#17354c' },
  optionText: { color: '#17354c', fontSize: 16, fontWeight: '600' },
  selectedText: { color: '#ffffff' },
  error: { color: '#873725', fontSize: 14, lineHeight: 22, marginTop: 10 },
});
