const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { id, featured } = body;
    if (id === undefined || featured === undefined) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and featured are required' }) };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase
      .from('reviews')
      .update({ featured })
      .eq('id', id);

    if (error) {
          console.error('Supabase error:', error.message);
          return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
