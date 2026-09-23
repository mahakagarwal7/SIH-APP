import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

export function LaunchScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.masthead}>
        <Text style={styles.brand}>Nirmaan.</Text>
        <Text style={styles.edition}>MOBILE</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>FROM THE FIELD TO THE PLAN</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          Hello Nirmaan.
        </Text>
        <Text style={styles.introduction}>Field work, clearly recorded.</Text>

        <View style={styles.note}>
          <Text style={styles.noteHeading}>Every detail has a place.</Text>
          <Text style={styles.body}>
            A shared record of the work done, the evidence behind it, and what
            remains.
          </Text>
        </View>

        <Text style={styles.preview}>Mobile preview</Text>
      </View>
    </ScrollView>
  );
}

const serif = Platform.select({
  android: 'serif',
  ios: 'Georgia',
  default: 'Georgia, "Times New Roman", serif',
});

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: '#f2f4f5',
  },
  masthead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d7e0e5',
  },
  brand: {
    color: '#17354c',
    fontFamily: serif,
    fontSize: 30,
    fontWeight: '700',
  },
  edition: {
    color: '#627786',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 680,
    paddingHorizontal: 24,
    paddingVertical: 44,
  },
  eyebrow: {
    color: '#586c7a',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.1,
    marginBottom: 16,
  },
  heading: {
    color: '#17354c',
    fontFamily: serif,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 46,
    marginBottom: 12,
  },
  introduction: {
    color: '#586c7a',
    fontSize: 17,
    lineHeight: 27,
  },
  note: {
    marginTop: 36,
    padding: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e0e5',
    borderLeftWidth: 3,
    borderLeftColor: '#266b8c',
  },
  noteHeading: {
    color: '#17354c',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  body: {
    color: '#627786',
    fontSize: 16,
    lineHeight: 26,
  },
  preview: {
    color: '#586c7a',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 28,
  },
});
