const { createClient } = require('@supabase/supabase-js');
const { getBusinessContext } = require('./_auth');
const { getAdminContext } = require('./_adminAuth');

exports.handler = async (event) => {
    const headers = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
          return { statusCode: 200, headers, body: '' };
    }

    const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let business;

    // Try normal business auth first
    const bizCtx = await getBusinessContext(event, headers);
    if (!bizCtx.errorResponse) {
        business = bizCtx.business;
    } else if (bizCtx.errorResponse.statusCode === 403) {
        // User is an admin — allow preview with ?business_id= param
        const adminCtx = await getAdminContext(event, headers);
        if (adminCtx.errorResponse) return adminCtx.errorResponse;

        const bizId = (event.queryStringParameters || {}).business_id;
        if (!bizId) return bizCtx.errorResponse; // no business_id, return original 403

        const { data: biz, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', bizId)
            .maybeSingle();

        if (bizError || !biz) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Business not found' }) };
        }
        business = biz;
    } else {
        return bizCtx.errorResponse;
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });

    if (error) {
          console.error('Supabase error:', error.message);
          return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    const { data: requests } = await supabase
      .from('review_requests')
      .select('id, created_at')
      .eq('business_id', business.id);

    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const smsThisMonth = (requests || []).filter(r => new Date(r.created_at) >= monthStart).length;

    return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
                  reviews: reviews || [],
                  requestsSent: requests ? requests.length : 0,
                  smsThisMonth,
                  smsLimit: business.monthly_sms_limit ?? 50,
                  business: { id: business.id, name: business.name, slug: business.slug, email: business.email, google_review_url: business.google_review_url || '' },
          }),
    };
};
