/**
 * Twilio webhook — receives inbound SMS replies from customers.
 * Configure your Twilio number's "A message comes in" webhook to point here.
 * Expected message format: "<rating> <optional comment>"
 * Example: "5 Great service!"
 */

const { URLSearchParams } = require('url');

// Converts Twilio's E.164 Australian format (+61XXXXXXXXX) to local format (0XXXXXXXXX)
function normaliseAustralianPhone(phone) {
  if (phone.startsWith('+61') && phone.length === 12) {
    return '0' + phone.slice(3);
  }
  return phone;
}

exports.handler = async (event) => {
  // Twilio sends POST with application/x-www-form-urlencoded
  const params = new URLSearchParams(event.body || '');

  const from = normaliseAustralianPhone(params.get('From') || '');
  const messageBody = (params.get('Body') || '').trim();

  // Parse rating and optional comment from the message
  const match = messageBody.match(/^([1-5])\s*(.*)/s);

  let rating = null;
  let comment = '';

  if (match) {
    rating = parseInt(match[1], 10);
    comment = match[2].trim();
  }

  // TODO: look up the pending review_request by phone number from your data store
  // Example: const reviewRequest = await db.findReviewRequestByPhone(from);
  const reviewRequest = null; // replace with real lookup

  if (!reviewRequest) {
    console.warn(`No matching review_request found for phone: ${from}`);
  }

  const review = {
    phone: from,
    reviewRequestId: reviewRequest ? reviewRequest.id : null,
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
