import { renderTqiEmail, TqiEmailDetail } from './emailLayout.js';

export interface WorkflowEmailProps {
  recipientName: string;
  title: string;
  summary: string;
  details: TqiEmailDetail[];
  actionLabel?: string;
  actionUrl?: string;
}

export function renderWorkflowEmail({ recipientName, title, summary, details, actionLabel, actionUrl }: WorkflowEmailProps): { html: string; text: string } {
  return renderTqiEmail({ recipientName, title, summary, details, actionLabel, actionUrl });
}
