export interface OtpEmailProps {
  name: string;
  otp: string;
  expiryMinutes: number;
}

export function renderOtpEmail({ name, otp, expiryMinutes }: OtpEmailProps): { html: string; text: string } {
  const text = `Hello ${name},\n\nYour TQI sign-in verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes. If you did not request this code, please ignore this email.\n\n-- Talent Quest for India Trust`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>TQI Sign-in Verification</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <!-- Accent Top Bar -->
            <tr>
              <td style="height:6px;background:linear-gradient(90deg, #ef6c2f 0%, #ff8c42 100%);font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <!-- Header with Brand -->
            <tr>
              <td align="center" style="padding:32px 24px 20px 24px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ef6c2f;margin-bottom:6px;">Talent Quest for India Trust</div>
                <div style="font-size:24px;font-weight:800;color:#002869;letter-spacing:-0.5px;">Cluster Admin Portal</div>
                <div style="margin-top:6px;font-size:14px;color:#64748b;">Two-Factor Sign-in Verification</div>
              </td>
            </tr>
            <!-- Body Content -->
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <div style="font-size:16px;line-height:24px;font-weight:600;color:#1e293b;">Hello ${name},</div>
                <div style="margin-top:10px;font-size:14px;line-height:22px;color:#475569;">
                  You requested access to the TQI Cluster Admin dashboard. Use the single-use verification code below to complete your authentication.
                </div>
                
                <!-- OTP Code Display Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;background-color:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:24px 16px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Your Verification Code</div>
                      <div style="font-size:38px;font-weight:800;letter-spacing:12px;color:#002869;font-family:Consolas,Monaco,'Courier New',monospace;padding-left:12px;">${otp}</div>
                      <div style="margin-top:10px;font-size:12px;font-weight:500;color:#94a3b8;">
                        ⏱️ Expires in <span style="color:#ef6c2f;font-weight:700;">${expiryMinutes} minutes</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Security Warning Callout -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;background-color:#fff7ed;border-left:4px solid #ef6c2f;border-radius:0 8px 8px 0;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;line-height:20px;color:#9a3412;">
                      <strong>Security Tip:</strong> TQI staff or administrators will never ask for your verification code. If you did not initiate this login, please ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
                <div style="font-size:12px;font-weight:600;color:#64748b;">Talent Quest for India (TQI)</div>
                <div style="margin-top:4px;font-size:11px;color:#94a3b8;">Automated system security notification · Please do not reply</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}
