import { Resend } from "resend";

// Fails soft on purpose. An email outage must never block an application
// submission or a moderation action — those already committed to the DB by
// the time this runs, so the worst case here is a missed notification, not
// a broken flow.
let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.error("sendMail: RESEND_API_KEY not set, skipping send to", params.to);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "PAC Africa Jobs <onboarding@resend.dev>";

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) console.error("sendMail failed:", error);
  } catch (err) {
    console.error("sendMail threw:", err);
  }
}
