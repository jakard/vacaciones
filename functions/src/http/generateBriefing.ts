import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

import { CALLABLE_OPTS } from '../options';

const Schema = z.object({
  teamId: z.string().trim().min(1),
  requestId: z.string().trim().min(1),
});

interface BriefingResult {
  content: string;
  generatedAtMs: number;
}

const REACHABILITY_LABELS: Record<string, string> = {
  unreachable: 'Unreachable (true shore leave)',
  'email-only-emergencies': 'Email only — emergencies',
  'phone-emergencies': 'Phone for P1 emergencies',
  'daily-check-in': 'Daily check-in',
};
const COVERAGE_KIND_LABELS: Record<string, string> = {
  inbox: 'inbox / email',
  meetings: 'standing meetings',
  escalations: 'open escalations',
  'one-on-ones': 'customer 1:1s',
  chat: 'Slack / chat',
  'on-call': 'on-call rotation',
};

export const generateBriefing = onCall<unknown, Promise<BriefingResult>>(
  { ...CALLABLE_OPTS, timeoutSeconds: 90 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { teamId, requestId } = parsed.data;
    const uid = request.auth.uid;
    const db = getFirestore();

    const [memberSnap, settingsSnap, bountySnap] = await Promise.all([
      db.doc(`teams/${teamId}/members/${uid}`).get(),
      db.doc(`teams/${teamId}/private/settings`).get(),
      db.doc(`teams/${teamId}/coverageRequests/${requestId}`).get(),
    ]);

    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'Not a member of this crew.');
    }
    if (!bountySnap.exists) {
      throw new HttpsError('not-found', 'Bounty not found.');
    }
    const bounty = bountySnap.data() as Record<string, unknown>;
    if (bounty['requesterUid'] !== uid) {
      throw new HttpsError(
        'permission-denied',
        'Only the requester can generate a briefing for their bounty.',
      );
    }

    const settings = settingsSnap.exists ? settingsSnap.data() : null;
    const apiKey = (settings as { geminiApiKey?: string } | null)?.geminiApiKey;
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'No Gemini API key configured. Ask your crew manager to set one in Settings.',
      );
    }

    const windowStart = (bounty['windowStart'] as Timestamp | undefined)?.toDate();
    const windowEnd = (bounty['windowEnd'] as Timestamp | undefined)?.toDate();
    const scope = (bounty['coverageScope'] as string | null) ?? '(not specified)';
    const accountsArr =
      (bounty['accounts'] as Array<{ id: string; name: string }> | undefined) ?? [];
    const accountNames = accountsArr
      .map((a) => a.name)
      .filter((n) => n && n.trim() !== '');
    const accountsLine =
      accountNames.length > 0 ? accountNames.join(', ') : scope;
    const sla = (bounty['sla'] as string | null) ?? '';
    const emergencyDef = (bounty['emergencyDef'] as string | null) ?? '';
    const reachArr = (bounty['reachability'] as string[] | undefined) ?? [];
    const kindsArr = (bounty['coverageKinds'] as string[] | undefined) ?? [];
    const meetings = (bounty['meetings'] as Array<Record<string, unknown>> | undefined) ?? [];

    const reachLabels = reachArr.map((r) => REACHABILITY_LABELS[r] ?? r).join(', ') || '(unspecified)';
    const kindLabels = kindsArr.map((k) => COVERAGE_KIND_LABELS[k] ?? k).join(', ') || '(unspecified)';
    const meetingsBlock = meetings.length === 0
      ? '(none selected)'
      : meetings
          .map((m) => {
            const summary = (m['summary'] as string) || '(no title)';
            const startMs = m['startMs'] as number;
            const endMs = m['endMs'] as number;
            const attendeesArr = m['attendees'] as Array<{ email: string; displayName?: string }> | undefined;
            return `  - ${summary} (${new Date(startMs).toISOString()} → ${new Date(endMs).toISOString()}, ${attendeesArr?.length ?? 0} attendees)`;
          })
          .join('\n');

    const prompt = `You are an experienced Technical Account Manager assistant. A TAM is going on vacation and needs to brief a coverer.

BOUNTY CONTEXT
- Vacation window: ${windowStart?.toISOString() ?? '(unspecified)'} to ${windowEnd?.toISOString() ?? '(unspecified)'}
- Accounts to cover: ${accountsLine}
- Coverage scope / extra notes: ${scope}
- Reachability while away: ${reachLabels}
- Types of work to cover: ${kindLabels}
- SLA the coverer must hold: ${sla || '(unspecified)'}
- What counts as a real emergency: ${emergencyDef || '(unspecified)'}
- Meetings to cover:
${meetingsBlock}

INSTRUCTIONS
Write a concise, structured BRIEFING for the coverer in markdown. Cover these sections (only include ones that have content; do NOT invent details that are not in the context):

1. **Quick orientation** — one paragraph: what kind of vacation, who's the coverer expected to be, what's the SLA.
2. **Accounts in scope** — brief list (one bullet per account if scope mentions specific account names).
3. **What you'll be doing** — short bulleted list summarising types of work.
4. **Meetings you'll be attending** — list the meetings, including times.
5. **Escalation protocol** — what "emergency" means and how to reach the original TAM.
6. **Open questions to confirm with the TAM before they leave** — 2-5 targeted questions the coverer should ask before the vacation starts.

Keep it tight: ~250-400 words. Use markdown headers (## Section). Do not write a preamble. Start directly with the first header. Do not invent specific customer names, deal sizes, or technical details that are not present in the input.`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(apiKey);
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 900,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new HttpsError(
        'internal',
        `Gemini API error (${res.status}): ${errText.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new HttpsError('internal', 'Gemini returned no content.');
    }

    const now = Date.now();
    await db.doc(`teams/${teamId}/coverageRequests/${requestId}`).update({
      aiBriefing: {
        content,
        generatedAtMs: now,
        generatedByUid: uid,
        model: 'gemini-2.0-flash',
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { content, generatedAtMs: now };
  },
);
