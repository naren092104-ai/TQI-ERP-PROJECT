import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { sendSmtpTestEmail, verifySmtpConnection } from '../authMailer.js';

const envPaths = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env')];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false, quiet: true });
}

try {
  await verifySmtpConnection();
  console.info('[SMTP] Connectivity and authentication verified.');
  const testRecipient = (process.env.SMTP_TEST_RECIPIENT || '').trim();
  if (testRecipient) {
    await sendSmtpTestEmail(testRecipient);
    console.info('[SMTP] Provider accepted a test message for the configured recipient. Check that mailbox and its spam folder.');
  } else {
    console.info('[SMTP] No message was sent. Set SMTP_TEST_RECIPIENT to explicitly request a test delivery.');
  }
} catch {
  console.error('[SMTP] Verification failed. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM on the server.');
  process.exitCode = 1;
}
