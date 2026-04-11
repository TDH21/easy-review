const { createClient } = require('@supabase/supabase-js');

/**
 * Verifies the Supabase JWT and confirms the user is in the admin_users table.
 *
 * Usage inside a Netlify function:
 *
 *   const { getAdminContext } = require('./_adminAuth');
 *   const { user, errorResponse } = await getAdminContext(event, headers);
 *   if (errorResponse) return errorResponse;
 *   // user.id and user.email are now available
 *
 * @param {object} event   - Netlify function event
 * @param {object} headers - Response headers to include in any error response
 * @returns {{ user: object } | { errorResponse: object }}
 */
async function getAdminContext(event, headers = { 'Content-Type': 'application/json' }) {

  // --- 1. Extract Bearer token ---
  const authHeader =
    event.headers.authorization ||
    event.headers.Authorization ||
    '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return {
      errorResponse: {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorisation token' }),
      },
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // --- 2. Verify JWT ---
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      errorResponse: {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired session' }),
      },
    };
  }

  // --- 3. Confirm user is in admin_users ---
  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError) {
    console.error('_adminAuth: lookup error:', adminError.message);
    return {
      errorResponse: {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to verify admin status' }),
      },
    };
  }

  if (!adminRow) {
    return {
      errorResponse: {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' }),
      },
    };
  }

  return { user };
}

module.exports = { getAdminContext };
