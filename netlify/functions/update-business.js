const { createClient } = require('@supabase/supabase-js');
const { getBusinessContext } = require('./_auth');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email } = body;
  if (!name || !name.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Business name is required' }) };
  }

  const { business, errorResponse } = await getBusinessContext(event, headers);
  if (errorResponse) return errorResponse;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const updates = { name: name.trim() };
  if (email !== undefined) updates.email = email.trim() || null;

  const { data: updated, error: updateError } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', business.id)
    .select('id, name, slug, email')
    .single();

  if (updateError) {
    console.error('update-business:', updateError.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: updateError.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, business: updated }),
  };
};
