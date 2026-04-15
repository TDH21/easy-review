const { createClient } = require('@supabase/supabase-js');
const { getBusinessContext } = require('./_auth');
const { getAdminContext } = require('./_adminAuth');

exports.handler = async (event) => {
    const headers = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { id, featured, business_id: previewBusinessId } = body;
    if (id === undefined || featured === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and featured are required' }) };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    let businessId;

    // Try normal business auth first
    const bizCtx = await getBusinessContext(event, headers);
    if (!bizCtx.errorResponse) {
        businessId = bizCtx.business.id;
    } else if (bizCtx.errorResponse.statusCode === 403 && previewBusinessId) {
        // Admin preview mode
        const adminCtx = await getAdminContext(event, headers);
        if (adminCtx.errorResponse) return adminCtx.errorResponse;
        businessId = previewBusinessId;
    } else {
        return bizCtx.errorResponse;
    }

    const { error } = await supabase
      .from('reviews')
      .update({ featured })
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) {
          console.error('Supabase error:', error.message);
          return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
