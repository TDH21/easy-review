const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/javascript',
  };

  const businessId = event.queryStringParameters?.id;
  if (!businessId) return { statusCode: 400, headers, body: '// Missing business id' };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('customer_name, rating, comment, created_at')
    .eq('business_name', decodeURIComponent(businessId))
    .eq('featured', true)
    .order('created_at', { ascending: false });

  if (error || !reviews || reviews.length === 0) {
    return {
      statusCode: 200, headers,
      body: `(function(){
  var el = document.getElementById('easy-review-widget');
  if (el) el.innerHTML = '<p style="font-family:sans-serif;color:#999;">No featured reviews yet.</p>';
})();`,
    };
  }

  const stars = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
  const cards = reviews.map(r => `
    <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:1.25rem 1.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="color:#c8a96e;font-size:1.2rem;margin-bottom:0.5rem;">${stars(r.rating)}</div>
      <p style="margin:0 0 0.75rem;color:#333;font-size:0.95rem;line-height:1.6;">${r.comment ? r.comment.replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''}</p>
      <div style="font-size:0.8rem;color:#999;">— ${(r.customer_name || 'Anonymous').replace(/</g,'&lt;')}</div>
    </div>
  `).join('');

  const script = `(function(){
  var el = document.getElementById('easy-review-widget');
  if (!el) return;
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;font-family:Inter,system-ui,sans-serif;">' + ${JSON.stringify(cards)} + '</div>';
})();`;

  return { statusCode: 200, headers, body: script };
};
