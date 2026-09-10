import { renderTqiEmail } from './emailLayout.js';

export function renderOnboardingEmail({
  name,
  email,
  temporaryPassword: _temporaryPassword,
  role,
  clusterName,
  loginUrl,
}: {
  name: string;
  email: string;
  temporaryPassword?: string;
  role: string;
  clusterName?: string;
  loginUrl?: string;
}): { html: string; text: string } {
  const portalUrl = loginUrl || process.env.APP_URL || 'http://localhost:5173';
  const roleDisplay = role === 'SUPER_ADMIN' || role === 'Super Admin' ? 'Super Admin' : 'Cluster Admin';

  return renderTqiEmail({
    recipientName: name,
    title: 'TQI Account Setup',
    summary: 'Your TQI administrative account has been created. Use the secure account link below to access the portal and complete setup. Do not share account links or passwords.',
    details: [
      { label: 'Role', value: roleDisplay },
      { label: 'Cluster', value: clusterName || 'Central Administration' },
      { label: 'Login Email', value: email },
    ],
    actionLabel: 'Access TQI Portal',
    actionUrl: portalUrl,
    subtitle: 'ACADEMIC ERP WORKFLOW',
    footerText: 'Automated account notification from Talent Quest for India. Please do not reply.',
  });
}
