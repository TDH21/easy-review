const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { getBusinessContext } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
  const { name, phone } = body;
  if (!name || !phone) return { statusCode: 400, body: JSON.stringify({ error: 'name and phone are required' }) };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const siteUrl = process.env.SITE_URL || 'https://easyreviewer.netlify.app';

  const { business, errorResponse } = await getBusinessContext(event, {});
  if (errorResponse) return errorResponse;

  const businessId   = business.id;
  const businessName = business.name;
  const smsLimit     = business.monthly_sms_limit ?? 50;

  if (!accountSid || !authToken || !fromNumber) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Twilio credentials not configured' }) };
  }

  // Check monthly SMS usage
  const supabaseCheck = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { count: smsThisMonth } = await supabaseCheck
    .from('review_requests')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', monthStart.toISOString());

  if ((smsThisMonth || 0) >= smsLimit) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: `Monthly SMS limit reached (${smsThisMonth}/${smsLimit}). Contact support to increase your limit.` }),
    };
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const reviewLink = siteUrl + '/review.html?token=' + token;
  const message = `Hi ${name}! ${businessName} would love your feedback.\n\nTap here to leave a review:\n${reviewLink}\n\n(Link expires in 7 days)`;






  const client = twilio(accountSid, authToken);
  try {
    await client.messages.create({ body: message, from: fromNumber, to: phone });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error: insertError } = await supabase.from('review_requests').insert([{
      customer_name: name, customer_phone: phone, business_name: businessName, business_id: businessId || null,
      token, status: 'sent', used: false, expires_at: expiresAt, created_at: new Date().toISOString(),
    }]);
    if (insertError) console.error('Supabase insert error:', insertError.message);
    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'SMS sent successfully' }) };
  } catch (err) {
    console.error('Twilio error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Failed to send SMS' }) };
  }
};
