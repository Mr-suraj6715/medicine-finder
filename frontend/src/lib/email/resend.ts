import { Resend } from "resend";
import {
  getWelcomeEmailHtml,
  getPasswordResetEmailHtml,
  getEmailVerificationHtml,
} from "./templates";

// Initialize Resend instance using server-side environment variable only
const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey && resendApiKey !== "re_xxxxxxxxx" ? new Resend(resendApiKey) : null;

export function getFromEmail(): string {
  return process.env.EMAIL_FROM || "MediFind <onboarding@resend.dev>";
}

export function getAppUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Sends a welcome email to newly registered users
 */
export async function sendWelcomeEmail({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role?: string;
}): Promise<EmailResult> {
  const siteUrl = getAppUrl();
  const from = getFromEmail();
  const html = getWelcomeEmailHtml({ name, email, role, siteUrl });
  const subject = "Welcome to MediFind – Your Medicine Delivery Network";

  if (!resend) {
    console.log("\n=======================================================");
    console.log(`[RESEND SIMULATION] Welcome Email to: ${email}`);
    console.log(`[RESEND SIMULATION] Subject: ${subject}`);
    console.log(`[RESEND SIMULATION] User: ${name} (${role || "user"})`);
    console.log(`[RESEND SIMULATION] Site URL: ${siteUrl}`);
    console.log("=======================================================\n");
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("[RESEND_ERROR] Welcome email dispatch failed:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[RESEND_EXCEPTION] Failed to send welcome email:", err?.message || err);
    return { success: false, error: "Internal email dispatch error" };
  }
}

/**
 * Sends a password reset email with temporary secure link
 */
export async function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
  expiresMinutes = 20,
}: {
  email: string;
  name?: string;
  resetUrl: string;
  expiresMinutes?: number;
}): Promise<EmailResult> {
  const from = getFromEmail();
  const html = getPasswordResetEmailHtml({ name, email, resetUrl, expiresMinutes });
  const subject = "Reset your MediFind password";

  if (!resend) {
    console.log("\n=======================================================");
    console.log(`[RESEND SIMULATION] Password Reset Email to: ${email}`);
    console.log(`[RESEND SIMULATION] Subject: ${subject}`);
    console.log(`[RESEND SIMULATION] Secure Reset URL: ${resetUrl}`);
    console.log(`[RESEND SIMULATION] Valid for: ${expiresMinutes} minutes`);
    console.log("=======================================================\n");
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("[RESEND_ERROR] Password reset email dispatch failed:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[RESEND_EXCEPTION] Failed to send password reset email:", err?.message || err);
    return { success: false, error: "Internal email dispatch error" };
  }
}

/**
 * Sends an email verification link
 */
export async function sendEmailVerification({
  email,
  name,
  verificationUrl,
}: {
  email: string;
  name?: string;
  verificationUrl: string;
}): Promise<EmailResult> {
  const from = getFromEmail();
  const html = getEmailVerificationHtml({ name, email, verificationUrl });
  const subject = "Verify your MediFind email address";

  if (!resend) {
    console.log("\n=======================================================");
    console.log(`[RESEND SIMULATION] Email Verification to: ${email}`);
    console.log(`[RESEND SIMULATION] Subject: ${subject}`);
    console.log(`[RESEND SIMULATION] Verification URL: ${verificationUrl}`);
    console.log("=======================================================\n");
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("[RESEND_ERROR] Verification email dispatch failed:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error("[RESEND_EXCEPTION] Failed to send verification email:", err?.message || err);
    return { success: false, error: "Internal email dispatch error" };
  }
}
