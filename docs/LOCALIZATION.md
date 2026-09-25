# English and Hindi localization

Roadmap 6.3 completes the English/Hindi requirement for the mobile flows that
exist through Manager Overview. It does not translate project names, activity
names, report wording, evidence, user-entered text or other production data.

## Preference and fallback

The root `LocalizationProvider` starts safely in English and restores
`nirmaan.language` from the existing device SecureStore. The only persisted
values are the public locale identifiers `en` and `hi`. Changing the language
from either the sign-in page or Account waits for persistence to succeed; a
failed save leaves the current language unchanged and shows an actionable
message.

Tamil is not exposed. Invalid or future stored values fall back to English.
Language selection does not change the authenticated session, project, draft
ownership or production backend requests.

## Interface boundary

Localized primitives cover visible text, text-input hints, button and input
accessibility labels, and native confirmation alerts. Expo Router tab titles
and tab accessibility labels use the same locale context. Static English copy
is the translation key so an accidental missing entry remains readable, while
the source coverage test fails until Hindi copy is supplied.

Known interpolated accessibility sentences use explicit templates so activity
IDs, filenames, dates and counts remain intact. Backend and user content is
never passed through a translator.

Hindi text uses the platform system font instead of the English serif display
font. Existing flexible tab heights and React Native font scaling remain in
effect. Date and quantity formatters use `en-IN` or `hi-IN`; calendar-only
identifiers used in backend queries retain their contract format.

## Verification boundary

Automated coverage walks production TypeScript and TSX sources for visible
copy, conditional labels, status/detail mappings and UI messages. It requires a
non-empty Hindi value and verifies translated prose contains Devanagari. Unit
tests cover preference restoration, persistence, failure fallback, visible
copy and accessibility labels.

Physical-phone review still needs both languages at the largest supported font
size, TalkBack navigation, text/photo/voice controls, manager decision forms,
long project names and the date/time displays. These are manual presentation
checks; they do not require production writes.
