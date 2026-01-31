import { Router, Response } from 'express';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';
import { emailService } from '../services/email.service';

const router = Router();

router.post('/test', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const { to, subject, text, html } = req.body || {};

    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      res.status(500).json({ error: 'SendGrid not configured' });
      return;
    }

    if (!to) {
      res.status(400).json({ error: 'Missing required field: to' });
      return;
    }

    const safeSubject = subject || 'SendGrid Test Email';
    const safeText = text || 'This is a test email from Academy Awards Pool.';
    const safeHtml = html || `<p>${safeText}</p>`;

    console.log(`Email test requested by user=${req.user?.email} to=${to}`);
    await emailService.sendEmail({
      to,
      subject: safeSubject,
      text: safeText,
      html: safeHtml,
    });

    res.json({ status: 'sent' });
  } catch (error: any) {
    console.error('Email test failed:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
});

export default router;
