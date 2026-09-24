export interface WelcomeTemplateProps {
  name: string;
  email: string;
  role?: string;
  siteUrl: string;
}

export interface PasswordResetTemplateProps {
  name?: string;
  email: string;
  resetUrl: string;
  expiresMinutes?: number;
}

export interface EmailVerificationTemplateProps {
  name?: string;
  email: string;
  verificationUrl: string;
}

const BRAND_COLOR = "#1E3A2F";
const ACCENT_COLOR = "#A3D1B5";

const getHeader = (subheading: string) => `
  <tr>
    <td style="background-color: ${BRAND_COLOR}; padding: 32px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; font-family: 'Times New Roman', Georgia, serif;">medifind</h1>
      <p style="color: ${ACCENT_COLOR}; margin: 6px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">${subheading}</p>
    </td>
  </tr>
`;

const getFooter = () => `
  <tr>
    <td style="background-color: #F8FAF9; padding: 24px 30px; text-align: center; border-top: 1px solid #E2EFE7;">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B;">
        Need help? Contact MediFind Support at <a href="mailto:support@medifind.com" style="color: ${BRAND_COLOR}; text-decoration: underline;">support@medifind.com</a>
      </p>
      <p style="margin: 0; font-size: 11px; color: #94A3B8;">
        &copy; ${new Date().getFullYear()} MediFind Healthcare Logistics Inc. All rights reserved.
      </p>
    </td>
  </tr>
`;

export function getWelcomeEmailHtml({ name, email, role, siteUrl }: WelcomeTemplateProps): string {
  const roleDisplay = role === "shop_owner" ? "Medical Shop Owner" : role === "rider" ? "Delivery Rider" : "Customer";
  const safeName = name || "Valued User";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MediFind</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #E2EFE7; overflow: hidden;" cellspacing="0" cellpadding="0">
          ${getHeader("Hyperlocal Medicine Delivery & Pharmacy Network")}
          
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0;">Welcome to MediFind, ${safeName}! 👋</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Your MediFind account has been successfully created. We are excited to have you join our healthcare delivery network.
              </p>

              <!-- Role Confirmation Badge -->
              <div style="background-color: #F0F6F2; border-left: 4px solid ${BRAND_COLOR}; padding: 14px 18px; border-radius: 12px; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #2D4A3E; line-height: 1.5;">
                  <strong>Account Role:</strong> ${roleDisplay}<br>
                  <strong>Registered Email:</strong> ${email}
                </p>
              </div>

              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                With MediFind, you get real-time price comparisons across local medical shops, instant routing with live map tracking, and emergency priority medicine delivery whenever you need it.
              </p>

              <!-- Primary Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}" target="_blank" style="background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 36px; font-size: 14px; font-weight: 700; border-radius: 9999px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(30, 58, 47, 0.25);">
                      Open MediFind Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; line-height: 1.6; color: #64748B; margin: 24px 0 0 0;">
                If the button above does not work, visit your portal directly at:<br>
                <a href="${siteUrl}" style="color: ${BRAND_COLOR}; word-break: break-all; font-weight: 600;">${siteUrl}</a>
              </p>
            </td>
          </tr>

          ${getFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getPasswordResetEmailHtml({ name, email, resetUrl, expiresMinutes = 20 }: PasswordResetTemplateProps): string {
  const safeName = name || "Valued User";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your MediFind Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #E2EFE7; overflow: hidden;" cellspacing="0" cellpadding="0">
          ${getHeader("Account Security & Recovery")}
          
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0;">Reset Your Password</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Hello <strong>${safeName}</strong>,<br><br>
                We received a request to reset the password for your MediFind account associated with <strong>${email}</strong>. Click the button below to choose a new secure password:
              </p>

              <!-- Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 38px; font-size: 14px; font-weight: 700; border-radius: 9999px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(30, 58, 47, 0.25);">
                      Reset Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #F0F6F2; border-left: 4px solid ${BRAND_COLOR}; padding: 14px 18px; border-radius: 12px; margin: 24px 0 20px 0;">
                <p style="margin: 0; font-size: 12px; color: #2D4A3E; line-height: 1.6;">
                  <strong>Important Security Notice:</strong><br>
                  &bull; This link is valid for <strong>${expiresMinutes} minutes</strong>.<br>
                  &bull; This link is single-use and will be invalidated once used.<br>
                  &bull; If you did not request a password reset, you can safely ignore this email; your account remains secure.
                </p>
              </div>

              <p style="font-size: 12px; line-height: 1.6; color: #64748B; margin: 20px 0 0 0;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: ${BRAND_COLOR}; word-break: break-all; font-weight: 600;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          ${getFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getEmailVerificationHtml({ name, email, verificationUrl }: EmailVerificationTemplateProps): string {
  const safeName = name || "Valued User";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your MediFind email address</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #E2EFE7; overflow: hidden;" cellspacing="0" cellpadding="0">
          ${getHeader("Account Verification")}
          
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 16px 0;">Verify Your Email Address</h2>
              
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                Hello <strong>${safeName}</strong>,<br><br>
                Thank you for signing up with MediFind (${email}). Please verify your email address by clicking the button below:
              </p>

              <!-- Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}" target="_blank" style="background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 38px; font-size: 14px; font-weight: 700; border-radius: 9999px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 14px rgba(30, 58, 47, 0.25);">
                      Verify Email Address &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; line-height: 1.6; color: #64748B; margin: 20px 0 0 0;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: ${BRAND_COLOR}; word-break: break-all; font-weight: 600;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          ${getFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
