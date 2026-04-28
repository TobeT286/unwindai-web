// api/contact.js — receives contact-modal submissions, emails info@unwindai.com.au
//
// Required env var: RESEND_API_KEY
// Optional: CONTACT_EMAIL_TO (default info@unwindai.com.au)
//           CONTACT_EMAIL_FROM (default onboarding@resend.dev — switch to a verified domain)
const { Resend } = require('resend');

const TO = process.env.CONTACT_EMAIL_TO || 'info@unwindai.com.au';
const FROM = process.env.CONTACT_EMAIL_FROM || 'UnwindAI Contact <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { name, email, question } = req.body || {};
  if (!name || !email || !question) {
    res.status(400).json({ error: 'Missing required fields: name, email, question' });
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY not set');
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `Website contact — ${name}`;
    const html = `
      <h2>New website contact</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><strong>Question:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(question)}</pre>
    `;
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject,
      html,
      text: `Name: ${name}\nEmail: ${email}\n\nQuestion:\n${question}`,
    });
    if (error) {
      console.error('[contact] resend error:', error);
      res.status(502).json({ error: 'Email delivery failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
