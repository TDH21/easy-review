const twilio = require('twilio');
const { getAdminContext } = require('./_adminAuth');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { user, errorResponse } = await getAdminContext(event, headers);
  if (errorResponse) return errorResponse;

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, phone } = body;
  if (!name || !phone) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'name and phone are required' }) };
  }

  // Normalise to E.164
  const toE164 = (p) => {
    p = p.replace(/[\s\-().]/g, '');
    if (p.startsWith('0') && p.length === 10) return '+61' + p.slice(1);
    if (p.startsWith('+')) return p;
    return p;
  };
  const formattedPhone = toE164(phone);

  const accountSid  = process.env.TWILIO_ACCOUNT_SID;
  const authToken   = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber  = process.env.TWILIO_PHONE_NUMBER;
  const siteUrl     = process.env.SITE_URL || 'https://easyreviewer.netlify.app';

  if (!accountSid || !authToken || !fromNumber) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Twilio credentials not configured' }) };
  }

  const signupUrl = siteUrl + '/signup.html';
  const message = `Hi ${name}! You've been invited to Easy Review — the simple way to collect customer reviews via SMS.\n\nTap here to create your free account:\n${signupUrl}`;

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({ body: message, from: fromNumber, to: formattedPhone });
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('admin-send-invite Twilio error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Failed to send SMS' }) };
  }
};
