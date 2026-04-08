const { createClient } = require('@supabase/supabase-js');

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

    const businessName = process.env.BUSINESS_NAME || 'Easy Review';

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('business_name', businessName)
      .order('created_at', { ascending: false });

    if (error) {
          console.error('Supabase error:', error.message);
          return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    const { data: requests } = await supabase
      .from('review_requests')
      .select('id')
      .eq('business_name', businessName);

    return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
                  reviews: reviews || [],
                  requestsSent: requests ? requests.length : 0,
          }),
    };
};
