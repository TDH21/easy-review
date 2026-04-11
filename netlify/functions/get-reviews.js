const { createClient } = require('@supabase/supabase-js');
const { getBusinessContext } = require('./_auth');

exports.handler = async (event) => {
    const headers = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
          return { statusCode: 200, headers, body: '' };
    }

    // Resolve business_id: prefer auth, fall back to env var during transition
    let businessId;
    const { business, errorResponse } = await getBusinessContext(event, headers);
    if (errorResponse) {
      if (process.env.BUSINESS_ID) {
        businessId = process.env.BUSINESS_ID;
      } else {
        return errorResponse;
      }
    } else {
      businessId = business.id;
    }

    const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
          console.error('Supabase error:', error.message);
          return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    const { data: requests } = await supabase
      .from('review_requests')
      .select('id')
      .eq('business_id', businessId);

    return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
                  reviews: reviews || [],
                  requestsSent: requests ? requests.length : 0,
          }),
    };
};
