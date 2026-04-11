/**
 * Sends a new-review notification email via Resend.
 * Silently skips if RESEND_API_KEY is not configured.
 *
 * Usage:
 *   const { sendReviewNotification } = require('./_email');
 *   await sendReviewNotification({ to, businessName, customerName, rating, comment });
 */
async function sendReviewNotification({ to, businessName, customerName, rating, comment }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return;

  const fromEmail = process.env.EMAIL_FROM || 'Easy Review <notifications@easyreviewer.netlify.app>';
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const name = customerName || 'A customer';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `New ${rating}★ review from ${name}`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;padding:2rem;color:#1a1a1a;">
            <h2 style="font-family:Georgia,serif;font-size:1.4rem;margin-bottom:0.5rem;">New review for ${businessName}</h2>
            <div style="font-size:1.6rem;color:#c8a96e;margin-bottom:1rem;letter-spacing:2px;">${stars}</div>
            <blockquote style="border-left:3px solid #c8a96e;padding:0.75rem 1rem;margin:0 0 1rem;background:#faf8f5;border-radius:0 8px 8px 0;font-style:italic;color:#444;">
              "${comment}"
            </blockquote>
            <p style="color:#6b6560;font-size:0.875rem;">From: <strong>${name}</strong></p>
            <hr style="border:none;border-top:1px solid #e0dbd4;margin:1.5rem 0;" />
            <a href="https://easyreviewer.netlify.app/dashboard.html" style="display:inline-block;background:#c8a96e;color:#1a1a1a;text-decoration:none;padding:0.6rem 1.25rem;border-radius:8px;font-size:0.875rem;font-weight:600;">View dashboard →</a>
            <p style="color:#bbb;font-size:0.75rem;margin-top:1.5rem;">Sent by Easy Review</p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('_email: Resend error:', err);
    }
  } catch (err) {
    console.error('_email: fetch error:', err.message);
  }
}

module.exports = { sendReviewNotification };
