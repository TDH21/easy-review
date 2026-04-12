const { createClient } = require('@supabase/supabase-js');
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

  const { business_id, user_email } = body;
  if (!business_id || !user_email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'business_id and user_email are required' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // --- 1. Find the auth user by email ---
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to list users' }) };
  }

  const authUser = users.find(u => u.email.toLowerCase() === user_email.toLowerCase());
  if (!authUser) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: `No account found for ${user_email}` }) };
  }

  // --- 2. Find any business already created by this user (from signup) ---
  const { data: signupBusiness } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', authUser.id)
    .neq('id', business_id)
    .maybeSingle();

  // --- 3. Link the pre-created business to this user ---
  const { error: linkError } = await supabase
    .from('businesses')
    .update({ user_id: authUser.id })
    .eq('id', business_id);

  if (linkError) {
    console.error('admin-link-business: link error:', linkError.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to link business' }) };
  }

  // --- 4. Delete the duplicate signup business (if one exists) ---
  if (signupBusiness) {
    const { error: deleteError } = await supabase
      .from('businesses')
      .delete()
      .eq('id', signupBusiness.id);

    if (deleteError) {
      console.warn('admin-link-business: could not delete duplicate:', deleteError.message);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, linked_user_id: authUser.id }),
  };
};
