const { createClient } = require('@supabase/supabase-js');
const { getAdminContext } = require('./_adminAuth');

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

  const { id, name, slug, email, monthly_sms_limit } = body;
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id is required' }) };

  const { user, errorResponse } = await getAdminContext(event, headers);
  if (errorResponse) return errorResponse;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // --- Check slug uniqueness (excluding this business) ---
  if (slug !== undefined) {
    const { data: existing, error: slugError } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle();

    if (slugError) {
      console.error('admin-update-business: slug check error:', slugError.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to check slug uniqueness' }) };
    }

    if (existing) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Slug is already in use by another business' }) };
    }
  }

  // --- Build update payload (only include provided fields) ---
  const updates = {};
  if (name  !== undefined) updates.name  = name;
  if (slug  !== undefined) updates.slug  = slug;
  if (email !== undefined) updates.email = email;
  if (monthly_sms_limit !== undefined) updates.monthly_sms_limit = parseInt(monthly_sms_limit, 10) || 50;

  if (Object.keys(updates).length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No fields to update' }) };
  }

  const { data: updated, error: updateError } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', id)
    .select('id, name, slug, email, monthly_sms_limit, user_id, created_at')
    .single();

  if (updateError) {
    console.error('admin-update-business: update error:', updateError.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: updateError.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, business: updated }),
  };
};
