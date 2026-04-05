const { URLSearchParams } = require('url');
const { createClient } = require('@supabase/supabase-js');

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

  // Parse rating (1-5) and optional comment
  const match = messageBody.match(/^([1-5])\s*(.*)/s);
  let rating = null;
  let comment = '';

  if (match) {
    rating = parseInt(match[1], 10);
    comment = match[2].trim();
  }

  // Initialise Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Look up the most recent pending review_request for this phone number
  const { data: reviewRequest, error: lookupError } = await supabase
    .from('review_requests')
    .select('id')
    .eq('phone', from)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lookupError) {
    console.warn(`No review_request found for phone: ${from}`, lookupError.message);
  }

  // Save the review to Supabase
  const { error: insertError } = await supabase
    .from('reviews')
    .insert([{
      phone: from,
      review_request_id: reviewRequest ? reviewRequest.id : null,
      rating,
      body: comment || messageBody,
      raw: messageBody,
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    console.error('Supabase insert error:', insertError.message);
  } else {
    console.log(`Review saved — phone: ${from}, rating: ${rating}`);
  }

  // Always respond to Twilio with TwiML
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your feedback${rating ? ` (${rating}/5)` : ''}! We really appreciate it.</Message>
</Response>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: twiml,
  };
};
