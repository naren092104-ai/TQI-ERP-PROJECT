export function renderOnboardingEmail({
  name,
  email,
  temporaryPassword,
  role,
  clusterName,
  loginUrl,
}: {
  name: string;
  email: string;
  temporaryPassword: string;
  role: string;
  clusterName?: string;
  loginUrl?: string;
}): { html: string; text: string } {
  const portalUrl = loginUrl || process.env.APP_URL || 'http://localhost:5173';
  const roleDisplay = role === 'SUPER_ADMIN' || role === 'Super Admin' ? 'Super Admin (State Central)' : 'Cluster Admin (College SPOC)';
  const clusterDisplay = clusterName ? `${clusterName}` : 'All Clusters';

  const text = `Welcome to Talent Quest for India (TQI) ERP
Hello ${name},

Your administrative account has been provisioned on the TQI Cluster Management Platform.

Account Details:
- Role: ${roleDisplay}
- Scope / Cluster: ${clusterDisplay}
- Login Email: ${email}
- Temporary Password: ${temporaryPassword}

Portal Link: ${portalUrl}

IMPORTANT SECURITY NOTICE:
When you sign in for the first time with this temporary password, you will be prompted to set a new personal password.

If you have any questions or did not expect this account, please contact the TQI Central Administration team.

Best regards,
Talent Quest for India (TQI) Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TQI Cluster ERP</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f6f9;
      color: #1e293b;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 600px;
      margin: 24px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #002869;
      padding: 28px 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header p {
      color: #93c5fd;
      margin: 4px 0 0 0;
      font-size: 13px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .lead {
      font-size: 14px;
      color: #475569;
      margin-bottom: 24px;
    }
    .credentials-box {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #002869;
      border-radius: 6px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .credential-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13px;
    }
    .credential-row:last-child {
      margin-bottom: 0;
    }
    .credential-label {
      font-weight: 600;
      color: #64748b;
      min-width: 140px;
    }
    .credential-val {
      font-weight: 700;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .password-highlight {
      display: inline-block;
      background: #e0e7ff;
      color: #1e3a8a;
      padding: 3px 10px;
      border-radius: 4px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .notice {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 14px 16px;
      margin-bottom: 24px;
      font-size: 12.5px;
      color: #92400e;
    }
    .btn-container {
      text-align: center;
      margin-bottom: 28px;
    }
    .btn {
      display: inline-block;
      background-color: #ef6c2f;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 32px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 32px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Talent Quest for India</h1>
      <p>Cluster Administration ERP</p>
    </div>
    <div class="content">
      <div class="greeting">Hello ${name},</div>
      <div class="lead">
        Your account has been provisioned on the TQI Cluster ERP system. You can now access your regional dashboard to manage sessions, volunteers, colleges, and student programs.
      </div>

      <div class="credentials-box">
        <div class="credential-row">
          <span class="credential-label">Assigned Role:</span>
          <span class="credential-val" style="font-family: inherit;">${roleDisplay}</span>
        </div>
        <div class="credential-row">
          <span class="credential-label">Cluster Scope:</span>
          <span class="credential-val" style="font-family: inherit;">${clusterDisplay}</span>
        </div>
        <div class="credential-row">
          <span class="credential-label">Login Email:</span>
          <span class="credential-val">${email}</span>
        </div>
        <div class="credential-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
          <span class="credential-label">Temporary Password:</span>
          <span class="credential-val"><span class="password-highlight">${temporaryPassword}</span></span>
        </div>
      </div>

      <div class="notice">
        <strong>First-time Onboarding:</strong> Upon your first sign-in using this temporary password, the system will prompt you to set your own permanent password.
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" class="btn" target="_blank">Access TQI Portal</a>
      </div>
    </div>
    <div class="footer">
      This is an automated system notification from Talent Quest for India Trust.<br>
      Please do not share your login credentials with anyone.
    </div>
  </div>
</body>
</html>`;

  return { html, text };
}
