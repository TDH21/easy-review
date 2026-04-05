const twilio = require('twilio');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, phone } = body;

  if (!name || !phone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'name and phone are required' }) };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Twilio credentials not configured' }) };
  }

  const client = twilio(accountSid, authToken);

  const message = `Hi ${name}, thanks for visiting! We'd love your feedback. Reply to this message with your rating (1-5) and a comment. Example: "5 Great service!"`;

  try {
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'SMS sent successfully' })
    };
  } catch (err) {
    console.error('Twilio error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to send SMS' })
    };
  }
};
