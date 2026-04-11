const { URLSearchParams } = require('url');
const { createClient } = require('@supabase/supabase-js');
const { sendReviewNotification } = require('./_email');

exports.handler = async (event) => {
  // Twilio sends POST with application/x-www-form-urlencoded
  const params = new URLSearchParams(event.body || '');

  // Keep phone in E.164 format (+61XXXXXXXXX) — matches what send-sms stores
  const from = params.get('From') || '';
  const messageBody = (params.get('Body') || '').trim();

  console.log('Incoming SMS from:', from, '| Body:', messageBody);

  // Parse rating (1-5) and optional comment
  const match = messageBody.match(/^([1-5])\s*(.*)/s);
  let rating = null;
  let comment = '';

  if (match) {
    rating = parseInt(match[1], 10);
    comment = match[2].trim();
  }

  if (!rating) {
    console.warn('No valid rating found in message:', messageBody);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, we didn't get that. Please reply with a number from 1 to 5. Example: 5</Message>
</Response>`;
    return { statusCode: 200, headers: { 'Content-Type': 'text/xml' }, body: twiml };
  }

  // Initialise Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Look up the most recent review_request for this phone number
  const { data: reviewRequest, error: lookupError } = await supabase
    .from('review_requests')
    .select('id, customer_name, business_name, business_id')
    .eq('customer_phone', from)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lookupError) {
    console.warn('No review_request found for:', from, lookupError.message);
  }

  // Save the review
  const { error: insertError } = await supabase
    .from('reviews')
    .insert([{
      customer_phone: from,
      customer_name: reviewRequest ? reviewRequest.customer_name : null,
      business_name: reviewRequest ? reviewRequest.business_name : null,
      business_id: reviewRequest ? reviewRequest.business_id : null,
      rating: rating,
      comment: comment || null,
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    console.error('Supabase insert error:', insertError.message);
  } else {
    console.log('Review saved — phone:', from, '| rating:', rating);
    // Send email notification to business
    if (reviewRequest && reviewRequest.business_id) {
      const { data: biz } = await supabase.from('businesses').select('email, name').eq('id', reviewRequest.business_id).maybeSingle();
      if (biz && biz.email) {
        await sendReviewNotification({
          to: biz.email,
          businessName: biz.name || reviewRequest.business_name,
          customerName: reviewRequest.customer_name,
          rating,
          comment: comment || null,
        });
      }
    }
  }

  // Reply to customer
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your ${rating}/5 rating! We really appreciate your feedback. 🙏</Message>
</Response>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: twiml,
  };
};
