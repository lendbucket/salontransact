interface SendSmsOptions {
  to: string;
  body: string;
}

export interface SendSmsResult {
  ok: boolean;
  sid: string | null;
  error: string | null;
  stubbed: boolean;
}

function envOk(): { accountSid: string; authToken: string; from: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  const { to, body } = opts;
  if (!to || !body) {
    return { ok: false, sid: null, error: "to and body are required", stubbed: false };
  }

  const env = envOk();
  if (!env) {
    const stubSid = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[SMS-STUB] No Twilio env vars set. Would have sent to ${to}:\n  ${body}\n  stubSid=${stubSid}`);
    return { ok: true, sid: stubSid, error: null, stubbed: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`;
  const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");
  const formBody = new URLSearchParams({ From: env.from, To: to, Body: body });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      const errMsg = data.message ?? `Twilio ${res.status}`;
      console.error(`[SMS] Send failed: ${errMsg}`, data);
      return { ok: false, sid: null, error: errMsg, stubbed: false };
    }
    return { ok: true, sid: data.sid ?? null, error: null, stubbed: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    console.error(`[SMS] Exception: ${msg}`);
    return { ok: false, sid: null, error: msg, stubbed: false };
  }
}
