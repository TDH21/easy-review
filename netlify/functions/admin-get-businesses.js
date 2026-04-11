const { createClient } = require('@supabase/supabase-js');
const { getAdminContext } = require('./_adminAuth');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { user, errorResponse } = await getAdminContext(event, headers);
  if (errorResponse) return errorResponse;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // --- Fetch all businesses ---
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, slug, email, user_id, created_at')
    .order('created_at', { ascending: false });

  if (bizError) {
    console.error('admin-get-businesses: businesses error:', bizError.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: bizError.message }) };
  }

  // --- Fetch all auth users to get their emails ---
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });

  if (usersError) {
    console.error('admin-get-businesses: listUsers error:', usersError.message);
    // Return businesses without auth emails rather than failing entirely
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ businesses: businesses.map(b => ({ ...b, auth_email: null })) }),
    };
  }

  // Build a map of user_id → auth email
  const userEmailMap = {};
  users.forEach(u => { userEmailMap[u.id] = u.email; });

  const enriched = businesses.map(b => ({
    ...b,
    auth_email: b.user_id ? (userEmailMap[b.user_id] || null) : null,
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ businesses: enriched }),
  };
};
