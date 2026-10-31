import nodemailer, { type SendMailOptions } from 'nodemailer';
import { renderOtpEmail } from './templates/otpEmailTemplate.js';
import { renderOnboardingEmail } from './templates/onboardingEmailTemplate.js';
import { renderWorkflowEmail, WorkflowEmailProps } from './templates/workflowEmailTemplate.js';

export async function sendLoginOtp({
  recipient,
  name,
  otp,
  projectRoot,
  expiryMinutes,
}: {
  recipient: string;
  name: string;
  otp: string;
  projectRoot: string;
  expiryMinutes: number;
}): Promise<void> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();

  if (!smtpUser || !smtpPass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP credentials are not configured for production OTP delivery.');
    }
    console.warn('[SMTP WARNING] SMTP_USER or SMTP_PASS not set. Falling back to console output.');
    console.log(`\n========================================\n[DEV OTP] For: ${recipient} | Code: ${otp}\n========================================\n`);
    return;
  }

  const isGmail = smtpHost.includes('gmail') || smtpUser.endsWith('@gmail.com');
  const transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass },
        }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        }
  );

  const { html, text } = renderOtpEmail({ name, otp, expiryMinutes });
  const mailOptions: SendMailOptions = {
    from: `TQI Secure Access <${smtpFrom}>`,
    to: recipient,
    subject: `${otp} is your TQI sign-in code`,
    text,
    html,
    headers: {
      'X-Auto-Response-Suppress': 'All',
      'Auto-Submitted': 'auto-generated',
    },
  };

  try {
    console.log(`[SMTP] Sending OTP email to ${recipient}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] OTP email sent successfully to ${recipient} (Message ID: ${info.messageId})`);
  } catch (error: any) {
    console.error(`[SMTP ERROR] Failed to send email via SMTP to ${recipient}:`, error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n========================================\n[DEV FALLBACK OTP] For: ${recipient} | Code: ${otp}\n========================================\n`);
    }
    throw new Error(`Email delivery failed: ${error.message}`);
  }
}

export async function sendOnboardingCredentialsEmail({
  recipient,
  name,
  temporaryPassword,
  role,
  clusterName,
  projectRoot,
  loginUrl,
}: {
  recipient: string;
  name: string;
  temporaryPassword: string;
  role: string;
  clusterName?: string;
  projectRoot: string;
  loginUrl?: string;
}): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();

  if (!smtpUser || !smtpPass) {
    console.warn('[SMTP WARNING] SMTP credentials not set. Onboarding email was not sent.');
    console.log(`\n========================================================`);
    console.log(`[ONBOARDING EMAIL NOT SENT] User: ${name} (${recipient})`);
    console.log(`[ONBOARDING EMAIL NOT SENT] Role: ${role} | Scope: ${clusterName || 'Central'}`);
    console.log(`========================================================\n`);
    return false;
  }

  const isGmail = smtpHost.includes('gmail') || smtpUser.endsWith('@gmail.com');
  const transporter = nodemailer.createTransport(
    isGmail
      ? {
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass },
        }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        }
  );

  const { html, text } = renderOnboardingEmail({
    name,
    email: recipient,
    temporaryPassword,
    role,
    clusterName,
    loginUrl,
  });
  const mailOptions: SendMailOptions = {
    from: `TQI Administration <${smtpFrom}>`,
    to: recipient,
    subject: `Welcome to TQI ERP — Your Account Credentials`,
    text,
    html,
    headers: {
      'X-Auto-Response-Suppress': 'All',
      'Auto-Submitted': 'auto-generated',
    },
  };

  try {
    console.log(`[SMTP] Sending onboarding email to ${recipient}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Onboarding email delivered to ${recipient} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`[SMTP ERROR] Failed to send onboarding email to ${recipient}:`, error.message);
    console.log(`\n========================================================`);
    console.log(`[FALLBACK ONBOARDING EMAIL] User: ${name} (${recipient})`);
    console.log(`========================================================\n`);
    return false;
  }
}

export async function sendWorkflowEmail({
  recipient,
  projectRoot,
  ...template
}: WorkflowEmailProps & { recipient: string; projectRoot: string }): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpFrom = (process.env.SMTP_FROM || smtpUser).trim();
  const { html, text } = renderWorkflowEmail(template);
  if (!smtpUser || !smtpPass) {
    console.warn(`[SMTP WARNING] SMTP credentials not set. Workflow email for ${recipient} was not sent.`);
    return false;
  }
  const isGmail = smtpHost.includes('gmail') || smtpUser.endsWith('@gmail.com');
  const transporter = nodemailer.createTransport(isGmail
    ? { service: 'gmail', auth: { user: smtpUser, pass: smtpPass } }
    : { host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } });
  const mailOptions: SendMailOptions = {
    from: `TQI Workflow <${smtpFrom}>`,
    to: recipient,
    subject: template.title.startsWith('TQI') ? template.title : `TQI ERP: ${template.title}`,
    text,
    html,
    headers: { 'X-Auto-Response-Suppress': 'All', 'Auto-Submitted': 'auto-generated' },
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Workflow email sent to ${recipient}: ${template.title}`);
    return true;
  } catch (error: any) {
    console.error(`[SMTP ERROR] Workflow email failed for ${recipient}:`, error.message);
    return false;
  }
}


