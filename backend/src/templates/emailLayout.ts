export interface TqiEmailDetail {
  label: string;
  value: string;
}

export interface TqiEmailLayoutProps {
  recipientName: string;
  title: string;
  summary: string;
  details?: TqiEmailDetail[];
  actionLabel?: string;
  actionUrl?: string;
  subtitle?: string;
  footerText?: string;
}

export const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const escapeAttribute = (value: string): string => escapeHtml(value);

const renderDetailValue = (label: string, value: string): string => {
  const normalizedLabel = label.toLowerCase();
  const safeValue = escapeHtml(value);
  if (normalizedLabel.includes('phone') || normalizedLabel.includes('mobile') || normalizedLabel.includes('contact')) {
    const phoneValue = value.replace(/[^\d+]/g, '');
    if (phoneValue) return `<a href="tel:${escapeAttribute(phoneValue)}" style="color:#2743ff;text-decoration:underline;">${safeValue}</a>`;
  }
  if (normalizedLabel.includes('email') || normalizedLabel.includes('account')) {
    const emailValue = value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return `<a href="mailto:${escapeAttribute(emailValue)}" style="color:#2743ff;text-decoration:underline;">${safeValue}</a>`;
  }
  return safeValue;
};

export function renderTqiEmail({
  recipientName,
  title,
  summary,
  details = [],
  actionLabel,
  actionUrl,
  subtitle = 'ACADEMIC ERP WORKFLOW',
  footerText = 'Automated notification from Talent Quest for India. Please do not reply.',
}: TqiEmailLayoutProps): { html: string; text: string } {
  const safeName = escapeHtml(recipientName);
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary);
  const detailText = details.map((detail) => `${detail.label}: ${detail.value}`).join('\n');
  const text = [
    'Talent Quest for India (TQI)',
    subtitle,
    '',
    `Hello ${recipientName},`,
    '',
    title,
    summary,
    details.length ? `\n${detailText}` : '',
    actionUrl ? `\n${actionLabel || 'Open TQI ERP'}: ${actionUrl}` : '',
    '',
    footerText,
  ].filter(Boolean).join('\n');

  const detailRows = details.map((detail) => `<tr>
    <td width="38%" valign="top" style="padding:11px 12px 11px 0;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:13px;line-height:20px;font-weight:600;">${escapeHtml(detail.label)}</td>
    <td valign="top" style="padding:11px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;line-height:20px;font-weight:600;word-break:break-word;">${renderDetailValue(detail.label, detail.value)}</td>
  </tr>`).join('');

  const action = actionUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto 0;">
    <tr>
      <td align="center" bgcolor="#2743ff" style="border-radius:5px;">
        <a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;padding:13px 22px;border:1px solid #2743ff;border-radius:5px;background:#2743ff;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">${escapeHtml(actionLabel || 'Open TQI ERP')}</a>
      </td>
    </tr>
  </table>` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;color:#111827;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #dfe3e8;">
          <tr>
            <td style="padding:22px 28px;background:#2743ff;">
              <div style="color:#ffffff;font-size:18px;line-height:24px;font-weight:700;">Talent Quest for India</div>
              <div style="margin-top:4px;color:#dbe4ff;font-size:10px;line-height:16px;letter-spacing:1.4px;font-weight:700;">${escapeHtml(subtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 28px;">
              <div style="color:#111827;font-size:15px;line-height:22px;font-weight:700;">Hello ${safeName},</div>
              <h1 style="margin:12px 0 10px;color:#111827;font-size:24px;line-height:31px;font-weight:700;">${safeTitle}</h1>
              <p style="margin:0;color:#4b5563;font-size:14px;line-height:22px;">${safeSummary}</p>
              ${details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:22px;border-top:1px solid #e5e7eb;">${detailRows}</table>` : ''}
              ${action}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;line-height:17px;text-align:center;">${escapeHtml(footerText)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
