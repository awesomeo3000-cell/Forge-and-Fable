import { Resend } from "resend";
import { BRAND_NAME } from "@/lib/brand";

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  return new Resend(apiKey);
}

export function appUrl(requestOrigin?: string): string {
  const forwarded = requestOrigin?.trim();
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    || "http://localhost:3000";
  return (forwarded || configured).replace(/\/+$/, "");
}

export interface VerificationEmailParams {
  email: string;
  name: string;
  token: string;
  /** Origin of the registration request, used to prevent links pointing at a
      stale localhost/preview hostname when the app is deployed. */
  requestOrigin?: string;
}

/** Send a verification email via Resend. Returns the Resend API response id on
 *  success, or throws if the send fails. */
export async function sendVerificationEmail(
  params: VerificationEmailParams,
): Promise<string> {
  const resend = getResend();
  const verifyUrl = `${appUrl(params.requestOrigin)}/api/auth/verify?token=${encodeURIComponent(params.token)}`;

  const { data, error } = await resend.emails.send({
    from: `${BRAND_NAME} <noreply@dreamwright.gg>`,
    to: [params.email],
    subject: `Verify your email for ${BRAND_NAME}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#2c1810;background:#faf7f2;border:1px solid #d4b896;border-radius:8px">
        <h1 style="font-size:24px;margin:0 0 8px;color:#8b3a2a">${BRAND_NAME}</h1>
        <p style="font-size:16px;margin:0 0 16px">Welcome, ${escapeHtml(params.name)}.</p>
        <p style="font-size:16px;margin:0 0 24px">Click the button below to verify your email and open your vault.</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#8b3a2a;color:#fff;text-decoration:none;border-radius:4px;font-size:16px;font-weight:bold">Verify Email</a>
        <p style="font-size:13px;color:#6b5e4f;margin:24px 0 0">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      </div>`,
    text: `Welcome to ${BRAND_NAME}, ${params.name}.\n\nVerify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
