// api/enquiry.js — receives VEU enquiry submissions, emails info@unwindai.com.au
//
// Accepts both the hero "quick form" (name/email/phone/suburb/message) and the
// full enquiry form (adds upgrade, existing, optional file metadata).
//
// Required env var: RESEND_API_KEY
// Optional: ENQUIRY_EMAIL_TO (default info@unwindai.com.au)
//           CONTACT_EMAIL_FROM (default onboarding@resend.dev — switch to a verified domain)
const { Resend } = require('resend');

const TO = process.env.ENQUIRY_EMAIL_TO || 'info@unwindai.com.au';
const FROM = process.env.CONTACT_EMAIL_FROM || 'UnwindAI VEU <onboarding@resend.dev>';

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { name, email, phone, suburb, upgrade, existing, message, source } = req.body || {};
  if (!name || !email) {
    res.status(400).json({ error: 'Missing required fields: name, email' });
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('[enquiry] RESEND_API_KEY not set');
    res.status(500).json({ error: 'Email service not configured' });
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `VEU enquiry — ${name}${suburb ? ' (' + suburb + ')' : ''}`;
    const html = `
      <h2>New VEU enquiry</h2>
      <table style="border-collapse:collapse;font-family:Segoe UI,system-ui,sans-serif;font-size:14px">
        ${row('Name', name)}
        ${row('Email', email)}
        ${row('Phone', phone)}
        ${row('Suburb / postcode', suburb)}
        ${row('Upgrade interested in', upgrade)}
        ${row('Existing system', existing)}
        ${row('Source', source)}
      </table>
      ${message ? `<h3>Message</h3><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>` : ''}
    `;
    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      suburb ? `Suburb: ${suburb}` : null,
      upgrade ? `Upgrade: ${upgrade}` : null,
      existing ? `Existing: ${existing}` : null,
      source ? `Source: ${source}` : null,
      '',
      message ? `Message:\n${message}` : null,
    ].filter(Boolean).join('\n');

    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('[enquiry] resend error:', error);
      res.status(502).json({ error: 'Email delivery failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[enquiry] unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
