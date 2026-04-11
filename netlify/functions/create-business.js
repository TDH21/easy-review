const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // --- 1. Extract JWT ---
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };

  // --- 2. Parse body ---
  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const businessName = (body.businessName || '').trim();
  if (!businessName) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Business name is required' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // --- 3. Verify JWT and get auth user ---
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  // --- 4. Prevent duplicate: one business per user ---
  const { data: existing } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    return { statusCode: 409, headers, body: JSON.stringify({ error: 'A business account already exists for this user' }) };
  }

  // --- 5. Generate base slug from business name ---
  const baseSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // strip leading/trailing hyphens

  if (!baseSlug) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Business name could not be converted to a valid identifier' }) };
  }

  // --- 6. Find a unique slug (handle collisions) ---
  // Fetch any existing slugs that start with baseSlug to avoid a loop of DB calls
  const { data: slugMatches } = await supabase
    .from('businesses')
    .select('slug')
    .like('slug', `${baseSlug}%`);

  let slug = baseSlug;
  if (slugMatches && slugMatches.length > 0) {
    const taken = new Set(slugMatches.map(r => r.slug));
    if (taken.has(baseSlug)) {
      let counter = 2;
      while (taken.has(`${baseSlug}-${counter}`)) counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  // --- 7. Insert the businesses row ---
  const { data: business, error: insertError } = await supabase
    .from('businesses')
    .insert([{
      name: businessName,
      slug,
      email: user.email,
      user_id: user.id,
    }])
    .select('id, name, slug')
    .single();

  if (insertError) {
    console.error('Business insert error:', insertError.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create business account' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, business }),
  };
};
