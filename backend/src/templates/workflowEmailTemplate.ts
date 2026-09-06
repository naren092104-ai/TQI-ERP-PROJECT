export interface WorkflowEmailProps {
  recipientName: string;
  title: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  actionLabel?: string;
  actionUrl?: string;
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export function renderWorkflowEmail({ recipientName, title, summary, details, actionLabel, actionUrl }: WorkflowEmailProps): { html: string; text: string } {
  const detailText = details.map((item) => `${item.label}: ${item.value}`).join('\n');
  const text = `Talent Quest for India (TQI)\n\nHello ${recipientName},\n\n${title}\n${summary}\n\n${detailText}${actionUrl ? `\n\n${actionLabel || 'Open TQI ERP'}: ${actionUrl}` : ''}\n\nThis is an automated TQI workflow notification.`;
  const detailRows = details.map((item) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:600;width:38%;vertical-align:top">${escapeHtml(item.label)}</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:700;vertical-align:top">${escapeHtml(item.value)}</td></tr>`).join('');
  const button = actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2743ff;color:#fff;text-decoration:none;padding:13px 22px;border-radius:7px;font-size:14px;font-weight:700">${escapeHtml(actionLabel || 'Open TQI ERP')}</a>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:24px 12px;background:#f3f5fa;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden"><tr><td style="padding:22px 24px;background:#2743ff;color:#fff"><div style="font-size:18px;font-weight:800">Talent Quest for India</div><div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8;margin-top:4px">Academic ERP Workflow</div></td></tr><tr><td style="padding:26px 24px"><div style="font-size:15px;font-weight:700">Hello ${escapeHtml(recipientName)},</div><h1 style="font-size:22px;line-height:1.25;margin:12px 0 8px;color:#111827">${escapeHtml(title)}</h1><p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 18px">${escapeHtml(summary)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0">${detailRows}</table><div style="text-align:center;margin-top:24px">${button}</div></td></tr><tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;text-align:center">Automated notification from Talent Quest for India. Please do not reply.</td></tr></table></td></tr></table></body></html>`;
  return { html, text };
}
