/**
 * Twilio webhook — receives inbound SMS replies from customers.
 * Configure your Twilio number's "A message comes in" webhook to point here.
 * Expected message format: "<rating> <optional comment>"
 * Example: "5 Great service!"
 */

const { URLSearchParams } = require('url');

exports.handler = async (event) => {
  // Twilio sends POST with application/x-www-form-urlencoded
  const params = new URLSearchParams(event.body || '');

  const from = params.get('From') || '';
  const messageBody = (params.get('Body') || '').trim();

  // Parse rating and optional comment from the message
  const match = messageBody.match(/^([1-5])\s*(.*)/s);

  let rating = null;
  let comment = '';

  if (match) {
    rating = parseInt(match[1], 10);
    comment = match[2].trim();
  }

  const review = {
    phone: from,
    rating,
    body: comment || messageBody,
    raw: messageBody,
    createdAt: new Date().toISOString()
  };

  // TODO: persist review (e.g. to a database, Airtable, or Netlify Blobs)
  console.log('New review received:', JSON.stringify(review));

  // Respond with a TwiML acknowledgement
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your feedback${rating ? ` (${rating}/5)` : ''}! We really appreciate it.</Message>
</Response>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: twiml
  };
};
