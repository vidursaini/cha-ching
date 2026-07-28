export type LicenseEmailInput = {
  licenseKey: string;
  downloadUrl: string;
  supportEmail: string;
};

export type LicenseEmail = {
  subject: string;
  html: string;
  text: string;
};

export type SendResendEmailInput = LicenseEmail & {
  apiKey: string;
  from: string;
  to: string;
  idempotencyKey?: string | undefined;
};

const productName = "Cha-Ching";

export function buildLicenseEmail(input: LicenseEmailInput): LicenseEmail {
  const safeLicenseKey = escapeHTML(input.licenseKey);
  const safeDownloadUrl = escapeHTML(input.downloadUrl);
  const safeSupportEmail = escapeHTML(input.supportEmail);

  return {
    subject: "Your Cha-Ching license",
    text: [
      "Thanks for buying Cha-Ching.",
      "",
      "Your license key:",
      input.licenseKey,
      "",
      "Download Cha-Ching:",
      input.downloadUrl,
      "",
      "Install steps:",
      "1. Open ChaChing.dmg.",
      "2. Drag ChaChing.app to Applications.",
      "3. Open Cha-Ching from Applications.",
      "4. Look for Cha-Ching in the Mac menu bar, choose Connect Cha-Ching, paste this license key, and activate this Mac.",
      "",
      `Need help? Reply to ${input.supportEmail}.`
    ].join("\n"),
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171a1f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;box-shadow:0 18px 50px rgba(20,24,30,0.10);overflow:hidden;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#18a849;">${productName}</p>
                <h1 style="margin:0 0 14px;font-size:30px;line-height:1.12;font-weight:800;color:#171a1f;">Your Mac is ready to celebrate revenue.</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#5d6570;">Thanks for buying Cha-Ching. Download the Mac app, drag it to Applications, then paste this license key into the app to connect this Mac to your hosted webhook feed.</p>
                <div style="margin:0 0 24px;padding:18px 20px;border-radius:16px;background:#edf9ef;border:1px solid #ccefd3;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#357246;">License key</p>
                  <code style="display:block;word-break:break-all;font-size:18px;line-height:1.45;font-weight:800;color:#111827;">${safeLicenseKey}</code>
                </div>
                <a href="${safeDownloadUrl}" style="display:inline-block;margin:0 0 20px;padding:14px 18px;border-radius:999px;background:#111827;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;">Download Cha-Ching DMG</a>
                <ol style="margin:0 0 16px;padding-left:22px;font-size:14px;line-height:1.65;color:#5d6570;">
                  <li>Open <strong>ChaChing.dmg</strong>.</li>
                  <li>Drag <strong>ChaChing.app</strong> to Applications.</li>
                  <li>Open Cha-Ching from Applications.</li>
                  <li>Look for Cha-Ching in the Mac menu bar, choose <strong>Connect Cha-Ching</strong>, paste your license key, then activate this Mac.</li>
                </ol>
                <p style="margin:0;font-size:14px;line-height:1.55;color:#5d6570;">Need help? Reply to <a href="mailto:${safeSupportEmail}" style="color:#12833a;font-weight:700;">${safeSupportEmail}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  };
}

export async function sendResendEmail(input: SendResendEmailInput): Promise<string | undefined> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.apiKey}`,
    "content-type": "application/json"
  };
  if (input.idempotencyKey) headers["idempotency-key"] = input.idempotencyKey;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  const payload = await response.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : response.statusText;
    throw new Error(`Resend email failed (${response.status}): ${message}`);
  }

  return typeof payload.id === "string" ? payload.id : undefined;
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
