import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { renderOtpEmail } from './templates/otpEmailTemplate.js';
import { renderOnboardingEmail } from './templates/onboardingEmailTemplate.js';
import { renderWorkflowEmail, WorkflowEmailProps } from './templates/workflowEmailTemplate.js';

type SmtpError = Error & { code?: string; responseCode?: number };

const readSmtpConfig = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from = (process.env.SMTP_FROM || user).trim();

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
  }
  return { host, port, user, pass, from };
};

const createSmtpTransporter = (): Transporter => {
  const { host, port, user, pass } = readSmtpConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
};

const safeSmtpErrorCode = (error: unknown): string => {
  const smtpError = error as SmtpError | null;
  return String(smtpError?.code || smtpError?.responseCode || 'unknown').slice(0, 40);
};

async function sendMail(options: SendMailOptions): Promise<void> {
  const transporter = createSmtpTransporter();
  try {
    await transporter.sendMail(options);
  } catch (error) {
    // Never log recipient, message content, reset links, OTPs, or SMTP credentials.
    console.error(`[SMTP] Email delivery failed (code: ${safeSmtpErrorCode(error)}).`);
    throw new Error('Email delivery failed. Check the server SMTP configuration and mail-provider logs.');
  } finally {
    transporter.close();
  }
}

/** Verifies SMTP connectivity and authentication without sending an email. */
export async function verifySmtpConnection(): Promise<void> {
  const transporter = createSmtpTransporter();
  try {
    await transporter.verify();
  } catch (error) {
    console.error(`[SMTP] Connection or authentication verification failed (code: ${safeSmtpErrorCode(error)}).`);
    throw new Error('SMTP connection or authentication failed. Check server SMTP configuration.');
  } finally {
    transporter.close();
  }
}

export async function sendSmtpTestEmail(recipient: string): Promise<void> {
  const { from } = readSmtpConfig();
  await sendMail({
    from: `TQI Administration <${from}>`,
    to: recipient,
    subject: 'TQI ERP SMTP delivery test',
    text: 'This is a test message confirming that the TQI ERP SMTP configuration accepted an email for delivery.',
    html: '<p>This is a test message confirming that the TQI ERP SMTP configuration accepted an email for delivery.</p>',
    headers: { 'X-Auto-Response-Suppress': 'All', 'Auto-Submitted': 'auto-generated' },
  });
}

export async function sendLoginOtp({
  recipient,
  name,
  otp,
  projectRoot: _projectRoot,
  expiryMinutes,
}: {
  recipient: string;
  name: string;
  otp: string;
  projectRoot: string;
  expiryMinutes: number;
}): Promise<void> {
  const { from } = readSmtpConfig();
  const { html, text } = renderOtpEmail({ name, otp, expiryMinutes });
  await sendMail({
    from: `TQI Secure Access <${from}>`,
    to: recipient,
    subject: 'Your TQI sign-in verification code',
    text,
    html,
    headers: {
      'X-Auto-Response-Suppress': 'All',
      'Auto-Submitted': 'auto-generated',
    },
  });
}

export async function sendOnboardingCredentialsEmail({
  recipient,
  name,
  temporaryPassword,
  role,
  clusterName,
  projectRoot: _projectRoot,
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
  try {
    const { from } = readSmtpConfig();
    const { html, text } = renderOnboardingEmail({
      name,
      email: recipient,
      temporaryPassword,
      role,
      clusterName,
      loginUrl,
    });
    await sendMail({
      from: `TQI Administration <${from}>`,
      to: recipient,
      subject: 'Welcome to TQI ERP — Your Account Credentials',
      text,
      html,
      headers: {
        'X-Auto-Response-Suppress': 'All',
        'Auto-Submitted': 'auto-generated',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendWorkflowEmail({
  recipient,
  projectRoot: _projectRoot,
  ...template
}: WorkflowEmailProps & { recipient: string; projectRoot: string }): Promise<boolean> {
  try {
    const { from } = readSmtpConfig();
    const { html, text } = renderWorkflowEmail(template);
    await sendMail({
      from: `TQI Workflow <${from}>`,
      to: recipient,
      subject: template.title.startsWith('TQI') ? template.title : `TQI ERP: ${template.title}`,
      text,
      html,
      headers: { 'X-Auto-Response-Suppress': 'All', 'Auto-Submitted': 'auto-generated' },
    });
    return true;
  } catch {
    return false;
  }
}
