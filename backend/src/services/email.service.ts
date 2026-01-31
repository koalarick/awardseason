import sgMail from '@sendgrid/mail';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME;

class EmailService {
  private initialized = false;

  private ensureInitialized(): boolean {
    if (this.initialized) {
      return true;
    }

    if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
      console.warn('SendGrid not configured: missing SENDGRID_API_KEY or SENDGRID_FROM_EMAIL');
      return false;
    }

    sgMail.setApiKey(SENDGRID_API_KEY);
    this.initialized = true;
    return true;
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    if (!this.ensureInitialized()) {
      return;
    }

    const fromEmail = SENDGRID_FROM_EMAIL as string;
    const fromName = SENDGRID_FROM_NAME || 'Academy Awards Pool';

    try {
      await sgMail.send({
        to: payload.to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      console.log(
        `SendGrid: sent email to=${payload.to} subject="${payload.subject}" from=${fromEmail}`,
      );
    } catch (error) {
      console.error(
        `SendGrid: failed to send email to=${payload.to} subject="${payload.subject}" from=${fromEmail}`,
        error,
      );
      throw error;
    }
  }

  async sendWelcomeEmail(to: string): Promise<void> {
    const subject = 'Welcome to Award Season Fun!';
    const text = 'Thanks for joining! You can now join pools and submit your picks.';
    const html = `
      <p>Thanks for joining!</p>
      <p>You can now join pools and submit your picks.</p>
    `;

    await this.sendEmail({ to, subject, text, html });
  }

  async sendNewUserAlert(to: string, newUserEmail: string, provider: string): Promise<void> {
    const subject = 'New user joined the Award Season Fun!';
    const text = `New user: ${newUserEmail} (provider: ${provider})`;
    const html = `
      <p><strong>New user joined</strong></p>
      <p>Email: ${newUserEmail}</p>
      <p>Provider: ${provider}</p>
    `;

    await this.sendEmail({ to, subject, text, html });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your Award Season Fun password';
    const text = `We received a request to reset your password. Use this link to set a new one: ${resetUrl}\n\nIf you did not request a reset, you can ignore this email.`;
    const html = `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Click here to set a new password</a></p>
      <p>If you did not request a reset, you can ignore this email.</p>
    `;

    await this.sendEmail({ to, subject, text, html });
  }
}

export const emailService = new EmailService();
