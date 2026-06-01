import { Firestore, FieldValue, Transaction } from 'firebase-admin/firestore';

/**
 * Queue an outbound email by writing a doc to the `mail` collection.
 *
 * The Firebase "Trigger Email from Firestore" extension watches that
 * collection and sends each doc as an email via the configured SMTP
 * provider. See `functions/MAIL_SETUP.md` for one-time install steps.
 *
 * When the extension is not installed yet, the docs accumulate but
 * nothing breaks. Once configured, the backlog gets sent.
 */
export interface QueueMailArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Stable key so we don't double-send if retried. */
  idempotencyKey?: string;
  /** Use to filter/disable by category client-side. */
  category?: string;
  replyTo?: string;
}

export async function queueMail(
  db: Firestore,
  args: QueueMailArgs,
): Promise<void> {
  const recipients = Array.isArray(args.to) ? args.to : [args.to];
  // Filter empty / falsy entries
  const cleaned = recipients
    .map((s) => (s || '').trim())
    .filter((s) => s.length > 0 && s.includes('@'));
  if (cleaned.length === 0) return;

  const ref = args.idempotencyKey
    ? db.collection('mail').doc(args.idempotencyKey)
    : db.collection('mail').doc();
  // Idempotency: if a doc with this key already exists, do nothing.
  if (args.idempotencyKey) {
    const snap = await ref.get();
    if (snap.exists) return;
  }
  await ref.set({
    to: cleaned,
    message: {
      subject: args.subject,
      html: args.html,
      text: args.text ?? stripHtml(args.html),
    },
    replyTo: args.replyTo ?? undefined,
    category: args.category ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Same as queueMail but inside a caller-supplied transaction. */
export function queueMailInTx(
  tx: Transaction,
  db: Firestore,
  args: QueueMailArgs,
): void {
  const recipients = Array.isArray(args.to) ? args.to : [args.to];
  const cleaned = recipients
    .map((s) => (s || '').trim())
    .filter((s) => s.length > 0 && s.includes('@'));
  if (cleaned.length === 0) return;
  const ref = args.idempotencyKey
    ? db.collection('mail').doc(args.idempotencyKey)
    : db.collection('mail').doc();
  tx.set(ref, {
    to: cleaned,
    message: {
      subject: args.subject,
      html: args.html,
      text: args.text ?? stripHtml(args.html),
    },
    replyTo: args.replyTo ?? undefined,
    category: args.category ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ----------------------------------------------------------------
// Shared HTML wrapper — keep all messages on the same identity.
// ----------------------------------------------------------------

export interface TemplateArgs {
  preheader?: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}

const BRAND_ORIGIN = 'https://vacaciones-dev-b3158.web.app';

export function wrapTemplate(args: TemplateArgs): string {
  const { preheader = '', title, bodyHtml, ctaLabel, ctaUrl } = args;
  const footer = args.footer ??
    `You're receiving this because you're a member of a Time Off crew. ` +
    `<a href="${BRAND_ORIGIN}" style="color:#D97757">Manage notifications</a>.`;
  const cta = ctaLabel && ctaUrl
    ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
         <tr><td style="background:#D97757;border-radius:8px;">
           <a href="${esc(ctaUrl)}" style="display:inline-block;padding:12px 24px;
              color:#1F1E1D;font-family:'Geist','Inter',sans-serif;font-weight:600;
              font-size:15px;text-decoration:none;">${esc(ctaLabel)}</a>
         </td></tr>
       </table>`
    : '';
  return `<!doctype html><html><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F4F3EE;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1F1E1D;">
    <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#F4F3EE;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</span>
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#F4F3EE;padding:32px 16px;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" width="560" style="background:#FFFFFF;border:1px solid #E0DCCF;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #F0EDE3;">
                <span style="color:#D97757;font-weight:700;font-size:14px;letter-spacing:0.5px;">TIME OFF</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1F1E1D;line-height:1.3;">${esc(title)}</h1>
                <div style="font-size:15px;line-height:1.55;color:#3A3935;">${bodyHtml}</div>
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#FBFAF6;border-top:1px solid #F0EDE3;font-size:12px;color:#7E7B73;line-height:1.5;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body></html>`;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const mailEsc = esc;
export const BRAND_URL = BRAND_ORIGIN;
