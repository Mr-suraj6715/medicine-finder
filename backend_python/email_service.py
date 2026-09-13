import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional, Dict

# In-memory store for the latest dev reset tokens to support local testing
DEV_LAST_RESET_LINKS: Dict[str, dict] = {}

def get_frontend_url() -> str:
    """Get the frontend base URL from environment or fallback to localhost:3000."""
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

def send_password_reset_email(recipient_email: str, raw_token: str, user_name: Optional[str] = None) -> bool:
    """
    Sends a secure password reset email to the recipient with a 20-minute temporary link.
    If SMTP credentials are provided, dispatches via SMTP.
    Otherwise, logs the formatted email and stores the link in the dev store.
    """
    frontend_url = get_frontend_url()
    reset_url = f"{frontend_url}/reset-password?token={raw_token}"
    name_display = user_name or "Valued User"

    # Record in development cache
    DEV_LAST_RESET_LINKS[recipient_email.lower()] = {
        "email": recipient_email.lower(),
        "token": raw_token,
        "resetUrl": reset_url,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Plain text version
    plain_text = f"""Hello {name_display},

We received a request to reset the password for your MediFind account ({recipient_email}).

To reset your password, please click the link below or copy it into your browser:
{reset_url}

This link is valid for 20 minutes and can only be used once.

If you did not request this password reset, please ignore this email. Your password will remain completely secure.

Regards,
The MediFind Team
https://medifind.com
"""

    # Responsive HTML template with MediFind branding
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your MediFind Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #E2EFE7; overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1E3A2F; padding: 32px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">medifind</h1>
              <p style="color: #A3D1B5; margin: 6px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Security & Account Recovery</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 14px 0;">Reset Your Password</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Hello <strong>{name_display}</strong>,<br><br>
                We received a request to reset the password for your account associated with <strong>{recipient_email}</strong>. Click the button below to choose a new password:
              </p>

              <!-- Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="{reset_url}" target="_blank" style="background-color: #1E3A2F; color: #ffffff; text-decoration: none; padding: 14px 34px; font-size: 14px; font-weight: 700; border-radius: 9999px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(30, 58, 47, 0.25);">
                      Reset Your Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Card -->
              <div style="background-color: #F6FAF7; border-left: 4px solid #1E3A2F; padding: 14px 16px; border-radius: 8px; margin: 24px 0 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #2D4A3E; line-height: 1.5;">
                  <strong>Important Security Information:</strong><br>
                  &bull; This link will expire in <strong>20 minutes</strong>.<br>
                  &bull; This link is single-use and will automatically be invalidated once used.<br>
                  &bull; Never share this link or your credentials with anyone.
                </p>
              </div>

              <p style="font-size: 12px; line-height: 1.6; color: #64748B; margin: 20px 0 0 0;">
                If the button above does not work, copy and paste this secure link directly into your browser:<br>
                <a href="{reset_url}" style="color: #1E3A2F; word-break: break-all; font-weight: 600;">{reset_url}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 28px 0;" />

              <p style="font-size: 11px; line-height: 1.5; color: #94A3B8; margin: 0;">
                If you did not request this password reset, please ignore this email or contact support. Your password will remain completely secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAF9; padding: 20px 30px; text-align: center; border-top: 1px solid #EEF2F0;">
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                &copy; {datetime.now().year} MediFind Healthcare Logistics Inc. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user or "noreply@medifind.com")

    # If live SMTP credentials exist, send via SMTP
    if smtp_host and smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Reset Your MediFind Password"
            msg["From"] = f"MediFind Security <{from_email}>"
            msg["To"] = recipient_email

            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(from_email, [recipient_email], msg.as_string())
            print(f"[EMAIL_SERVICE] Successfully dispatched password reset email via SMTP to {recipient_email}")
            return True
        except Exception as err:
            print(f"[EMAIL_SERVICE] SMTP dispatch failed: {err}. Logging link to console.")

    # Development / Fallback logger
    print("\n" + "=" * 70)
    print(f"📧 [MEDIFIND DEV MAILER] Password Reset Requested for: {recipient_email}")
    print(f"🔗 Secure Reset Link: {reset_url}")
    print(f"⏱️  Valid for: 20 minutes (Expires: {datetime.now(timezone.utc).isoformat()})")
    print("=" * 70 + "\n")
    return True
