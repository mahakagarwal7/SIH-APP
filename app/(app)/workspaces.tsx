import {} from 'react-native';

import { LocalizedText as Text } from '@/features/localization/LocalizedText';
import { NavLink, ShellPage, shellStyles } from '@/features/navigation/shellUi';

export default function Workspaces() {
  return (
    <ShellPage title="Choose your workspace" eyebrow="WELCOME TO NIRMAAN">
      <Text style={shellStyles.body}>
        Open the workspace for your work on site or in planning.
      </Text>
      <NavLink
        href="/field"
        label="Field"
        detail="Report progress and follow your assigned work."
      />
      <NavLink
        href="/manager"
        label="Manager"
        detail="Review field updates and follow the accepted plan."
      />
      <Text style={[shellStyles.body, { marginTop: 24 }]}>
        Both workspaces use the same project. Your role determines the actions
        available to you.
      </Text>
    </ShellPage>
  );
}
