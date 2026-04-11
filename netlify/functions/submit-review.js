const { createClient } = require('@supabase/supabase-js');
const { sendReviewNotification } = require('./_email');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (event.httpMethod === 'GET') {
    const token = event.queryStringParameters?.token;
    if (!token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token required' }) };
    const { data, error } = await supabase.from('review_requests').select('id, customer_name, business_name, used, expires_at').eq('token', token).single();
    if (error || !data) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid or expired link' }) };
    if (data.used) return { statusCode: 410, headers, body: JSON.stringify({ error: 'This review link has already been used' }) };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { statusCode: 410, headers, body: JSON.stringify({ error: 'This review link has expired' }) };
    return { statusCode: 200, headers, body: JSON.stringify({ customer_name: data.customer_name, business_name: data.business_name, request_id: data.id }) };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
    const { token, rating, comment } = body;
    if (!token || !rating) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token and rating are required' }) };
    if (!comment || !comment.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'A written review is required' }) };
    const { data: request, error: lookupError } = await supabase.from('review_requests').select('id, customer_name, customer_phone, business_name, business_id, used, expires_at').eq('token', token).single();
    if (lookupError || !request) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid link' }) };
    if (request.used) return { statusCode: 410, headers, body: JSON.stringify({ error: 'Already submitted' }) };
    if (request.expires_at && new Date(request.expires_at) < new Date()) return { statusCode: 410, headers, body: JSON.stringify({ error: 'Link expired' }) };
    const { error: insertError } = await supabase.from('reviews').insert([{
      customer_name: request.customer_name, customer_phone: request.customer_phone,
      business_name: request.business_name, business_id: request.business_id || null,
      rating: parseInt(rating, 10), comment: comment || null, featured: false, created_at: new Date().toISOString(),
    }]);
    if (insertError) { console.error('Insert error:', insertError.message); return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save review' }) }; }
    await supabase.from('review_requests').update({ used: true }).eq('id', request.id);
    // Send email notification to business
    if (request.business_id) {
      const { data: biz } = await supabase.from('businesses').select('email, name').eq('id', request.business_id).maybeSingle();
      if (biz && biz.email) {
        await sendReviewNotification({
          to: biz.email,
          businessName: biz.name || request.business_name,
          customerName: request.customer_name,
          rating: parseInt(rating, 10),
          comment,
        });
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
