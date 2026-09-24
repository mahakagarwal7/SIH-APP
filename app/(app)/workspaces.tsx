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
        Workspace selection does not change your project access. Project tools
        are not available yet.
      </Text>
    </ShellPage>
  );
}
