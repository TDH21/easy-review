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
        if (el) el.innerHTML = '<p style="font-family:sans-serif;color:#999;text-align:center;">No featured reviews yet.</p>';
      })();`,
    };
  }

  const safe = (s) => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const stars = (r) => '<span style="color:#c8a96e;">★</span>'.repeat(r) + '<span style="color:#ddd;">★</span>'.repeat(5 - r);
  const date = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const cardsJson = JSON.stringify(reviews.map(r => `
    <div class="er-card">
      <div class="er-stars">${stars(r.rating)}</div>
      <p class="er-comment">"${safe(r.comment)}"</p>
      <div class="er-meta">
        <span class="er-name">— ${safe(r.customer_name || 'Anonymous')}</span>
        <span class="er-date">${date(r.created_at)}</span>
      </div>
    </div>
  `).join(''));

  const script = `(function(){
    var el = document.getElementById('easy-review-widget');
    if (!el) return;

    var cards = ${cardsJson};

    var css = [
      '#er-wrap{font-family:Inter,system-ui,sans-serif;position:relative;padding:0 48px;}',
      '#er-track-outer{overflow:hidden;}',
      '#er-track{display:flex;transition:transform 0.35s ease;gap:1.25rem;}',
      '.er-card{flex:0 0 calc(33.333% - 0.834rem);background:#fff;border:1px solid #e8e4df;border-radius:14px;padding:1.5rem;box-shadow:0 2px 12px rgba(0,0,0,0.06);box-sizing:border-box;}',
      '.er-stars{font-size:1.15rem;margin-bottom:0.6rem;line-height:1;}',
      '.er-comment{margin:0 0 1rem;color:#333;font-size:0.92rem;line-height:1.65;font-style:italic;}',
      '.er-meta{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.25rem;}',
      '.er-name{font-size:0.8rem;font-weight:600;color:#555;}',
      '.er-date{font-size:0.75rem;color:#aaa;}',
      '.er-btn{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:1px solid #ddd;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.08);cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all 0.15s;z-index:2;}',
      '.er-btn:hover{background:#f5f2ed;border-color:#c8a96e;}',
      '.er-btn:disabled{opacity:0.3;cursor:default;}',
      '#er-prev{left:0;}',
      '#er-next{right:0;}',
      '#er-footer{text-align:center;margin-top:1.25rem;font-size:0.72rem;color:#bbb;letter-spacing:0.02em;}',
      '@media(max-width:900px){.er-card{flex:0 0 calc(50% - 0.625rem);}}',
      '@media(max-width:560px){.er-card{flex:0 0 100%;}#er-wrap{padding:0 40px;}}'
    ].join('');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    el.innerHTML = '<div id="er-wrap">' +
      '<button class="er-btn" id="er-prev">&#8592;</button>' +
      '<div id="er-track-outer"><div id="er-track">' + cards + '</div></div>' +
      '<button class="er-btn" id="er-next">&#8594;</button>' +
      '</div>' +
      '<div id="er-footer">Customer reviews collected by Easy Review</div>';

    var track = document.getElementById('er-track');
    var prev = document.getElementById('er-prev');
    var next = document.getElementById('er-next');
    var idx = 0;

    function perView() {
      var w = el.offsetWidth;
      if (w < 560) return 1;
      if (w < 900) return 2;
      return 3;
    }

    function total() { return track.children.length; }

    function maxIdx() { return Math.max(0, total() - perView()); }

    function update() {
      var cardW = track.children[0] ? track.children[0].offsetWidth + 20 : 0;
      track.style.transform = 'translateX(-' + (idx * cardW) + 'px)';
      prev.disabled = idx === 0;
      next.disabled = idx >= maxIdx();
    }

    prev.addEventListener('click', function(){ if (idx > 0) { idx--; update(); } });
    next.addEventListener('click', function(){ if (idx < maxIdx()) { idx++; update(); } });
    window.addEventListener('resize', function(){ idx = Math.min(idx, maxIdx()); update(); });

    // Touch/swipe support
    var startX = 0;
    track.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend', function(e){
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) { if (diff > 0 && idx < maxIdx()) idx++; else if (diff < 0 && idx > 0) idx--; update(); }
    }, {passive:true});

    update();
  })();`;

  return { statusCode: 200, headers, body: script };
};
