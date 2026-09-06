import { renderTqiEmail } from './emailLayout.js';

export interface OtpEmailProps {
  name: string;
  otp: string;
  expiryMinutes: number;
}

export function renderOtpEmail({ name, otp, expiryMinutes }: OtpEmailProps): { html: string; text: string } {
  return renderTqiEmail({
    recipientName: name,
    title: 'Sign-in Verification Code',
    summary: 'Use the single-use verification code below to complete your TQI Cluster Admin sign-in. If you did not request this code, please ignore this email.',
    details: [
      { label: 'Verification Code', value: otp },
      { label: 'Expires In', value: `${expiryMinutes} minutes` },
    ],
    subtitle: 'SECURE SIGN-IN',
    footerText: 'Automated security notification from Talent Quest for India. Please do not reply.',
  });
}
