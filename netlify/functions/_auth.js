const { createClient } = require('@supabase/supabase-js');

/**
 * Verifies the Supabase JWT from the Authorization header and returns
 * the matching business record from the businesses table.
 *
 * Usage inside a Netlify function:
 *
 *   const { getBusinessContext } = require('./_auth');
 *   const { business, errorResponse } = await getBusinessContext(event);
 *   if (errorResponse) return errorResponse;
 *   // business.id, business.name, business.slug are now available
 *
 * @param {object} event - The Netlify function event object
 * @param {object} headers - Response headers to include if returning an error
 * @returns {{ business: object } | { errorResponse: object }}
 */
async function getBusinessContext(event, headers = { 'Content-Type': 'application/json' }) {

  // --- 1. Extract token from Authorization header ---
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

  // --- 2. Verify the JWT and retrieve the auth user ---
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    const expired =
      authError?.message?.toLowerCase().includes('expired') ||
      authError?.message?.toLowerCase().includes('jwt expired');

    return {
      errorResponse: {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          error: expired
            ? 'Session has expired — please log in again'
            : 'Invalid authorisation token',
        }),
      },
    };
  }

  // --- 3. Look up the business linked to this auth user ---
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, slug, email, monthly_sms_limit')
    .eq('user_id', user.id)
    .maybeSingle();

  if (bizError) {
    console.error('_auth: business lookup error:', bizError.message);
    return {
      errorResponse: {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to load business context' }),
      },
    };
  }

  if (!business) {
    return {
      errorResponse: {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'No business account found for this user' }),
      },
    };
  }

  // --- 4. Return the business record ---
  return { business };
}

module.exports = { getBusinessContext };
