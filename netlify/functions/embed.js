const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/javascript',
  };

  const businessId = event.queryStringParameters?.id;
  if (!businessId) return { statusCode: 400, headers, body: '// Missing business id' };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);

  const query = supabase
    .from('reviews')
    .select('customer_name, rating, comment, created_at')
    .eq('featured', true)
    .order('created_at', { ascending: false });

  const { data: reviews, error } = await (
    isUUID
      ? query.eq('business_id', businessId)
      : query.eq('business_name', decodeURIComponent(businessId))
  );

  if (error || !reviews || reviews.length === 0) {
    return {
      statusCode: 200, headers,
      body: `(function(){
        var el = document.getElementById('easy-review-widget');
        if (el) el.innerHTML = '<p style="font-family:sans-serif;color:#999;text-align:center;">No featured reviews yet.</p>';
      })();`,
    };
  }

  // Fetch business name
  const { data: biz } = await supabase
    .from('businesses')
    .select('name')
    .eq(isUUID ? 'id' : 'name', isUUID ? businessId : decodeURIComponent(businessId))
    .maybeSingle();

  const businessName = biz ? biz.name : '';
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  const safe = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const stars = (r) => '★'.repeat(r) + '☆'.repeat(5 - r);
  const date = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const cardsJson = JSON.stringify(reviews.map(r => `
    <div class="er-card">
      <div class="er-quote">\u201C</div>
      <p class="er-comment">${safe(r.comment)}</p>
      <div class="er-stars">${stars(r.rating)}</div>
      <div class="er-meta">
        <span class="er-name">${safe(r.customer_name || 'Verified Customer')}</span>
        <span class="er-date">${date(r.created_at)}</span>
      </div>
    </div>
  `).join(''));

  const script = `(function(){
    var el = document.getElementById('easy-review-widget');
    if (!el) return;

    var cards = ${cardsJson};
    var bizName = ${JSON.stringify(businessName)};
    var avg = ${JSON.stringify(avgRating)};
    var total = ${reviews.length};

    var css = [
      '#er-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:100%;box-sizing:border-box;}',
      '#er-header{text-align:center;margin-bottom:1.75rem;}',
      '#er-avg{display:inline-flex;align-items:center;gap:0.5rem;background:#fffbf5;border:1px solid #f0e8d8;border-radius:100px;padding:0.5rem 1.25rem;margin-bottom:0.5rem;}',
      '#er-avg-num{font-size:1.5rem;font-weight:700;color:#1a1a1a;line-height:1;}',
      '#er-avg-stars{color:#c8a96e;font-size:1.1rem;letter-spacing:1px;}',
      '#er-avg-count{font-size:0.78rem;color:#888;margin-top:0.1rem;}',
      '#er-heading{font-size:0.85rem;color:#666;margin:0;}',
      '#er-wrap{position:relative;padding:0 44px;}',
      '#er-track-outer{overflow:hidden;border-radius:4px;}',
      '#er-track{display:flex;transition:transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94);gap:1rem;}',
      '.er-card{flex:0 0 calc(33.333% - 0.667rem);background:#fff;border:1px solid #ede8e1;border-radius:16px;padding:1.75rem 1.5rem 1.4rem;box-shadow:0 2px 16px rgba(0,0,0,0.06);box-sizing:border-box;position:relative;overflow:hidden;}',
      '.er-quote{position:absolute;top:0.8rem;right:1rem;font-size:4rem;line-height:1;color:#c8a96e;opacity:0.12;font-family:Georgia,serif;pointer-events:none;}',
      '.er-comment{margin:0 0 1.1rem;color:#2a2a2a;font-size:0.9rem;line-height:1.7;position:relative;}',
      '.er-stars{color:#c8a96e;font-size:1rem;letter-spacing:2px;margin-bottom:1rem;}',
      '.er-meta{display:flex;justify-content:space-between;align-items:flex-end;gap:0.5rem;border-top:1px solid #f0ece6;padding-top:0.9rem;margin-top:auto;}',
      '.er-name{font-size:0.8rem;font-weight:600;color:#333;}',
      '.er-date{font-size:0.72rem;color:#b0a89e;}',
      '.er-btn{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;border:1.5px solid #e5e0d8;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08);cursor:pointer;font-size:1rem;color:#555;display:flex;align-items:center;justify-content:center;transition:all 0.15s;z-index:2;padding:0;}',
      '.er-btn:hover:not(:disabled){background:#faf7f2;border-color:#c8a96e;color:#c8a96e;}',
      '.er-btn:disabled{opacity:0.25;cursor:default;}',
      '#er-prev{left:0;}',
      '#er-next{right:0;}',
      '#er-dots{display:flex;justify-content:center;gap:6px;margin-top:1.25rem;}',
      '.er-dot{width:6px;height:6px;border-radius:50%;background:#ddd;border:none;padding:0;cursor:pointer;transition:all 0.2s;}',
      '.er-dot.active{background:#c8a96e;width:18px;border-radius:3px;}',
      '#er-footer{text-align:center;margin-top:1rem;font-size:0.68rem;color:#ccc;letter-spacing:0.03em;}',
      '#er-footer a{color:#c8a96e;text-decoration:none;}',
      '@media(max-width:860px){.er-card{flex:0 0 calc(50% - 0.5rem);}}',
      '@media(max-width:520px){.er-card{flex:0 0 100%;}#er-wrap{padding:0 38px;}}'
    ].join('');

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var header = bizName
      ? '<div id="er-header">' +
          '<div id="er-avg"><span id="er-avg-num">' + avg + '</span><span id="er-avg-stars">★★★★★</span></div>' +
          '<p id="er-heading">What ' + bizName + ' customers say</p>' +
        '</div>'
      : '';

    el.innerHTML = header +
      '<div id="er-wrap">' +
        '<button class="er-btn" id="er-prev">&#8592;</button>' +
        '<div id="er-track-outer"><div id="er-track">' + cards + '</div></div>' +
        '<button class="er-btn" id="er-next">&#8594;</button>' +
      '</div>' +
      '<div id="er-dots"></div>' +
      '<div id="er-footer">Powered by <a href="https://easyreviewer.netlify.app" target="_blank">Easy Review</a></div>';

    var track = document.getElementById('er-track');
    var prev  = document.getElementById('er-prev');
    var next  = document.getElementById('er-next');
    var dots  = document.getElementById('er-dots');
    var idx   = 0;

    function perView() {
      var w = el.offsetWidth;
      if (w < 520) return 1;
      if (w < 860) return 2;
      return 3;
    }

    function cardCount() { return track.children.length; }
    function maxIdx()    { return Math.max(0, cardCount() - perView()); }

    function buildDots() {
      var m = maxIdx();
      dots.innerHTML = '';
      for (var i = 0; i <= m; i++) {
        var d = document.createElement('button');
        d.className = 'er-dot' + (i === idx ? ' active' : '');
        d.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        (function(i){ d.addEventListener('click', function(){ idx = i; update(); }); })(i);
        dots.appendChild(d);
      }
    }

    function update() {
      var gap = 16;
      var cardW = track.children[0] ? track.children[0].offsetWidth + gap : 0;
      track.style.transform = 'translateX(-' + (idx * cardW) + 'px)';
      prev.disabled = idx === 0;
      next.disabled = idx >= maxIdx();
      var dotEls = dots.querySelectorAll('.er-dot');
      dotEls.forEach(function(d, i){ d.className = 'er-dot' + (i === idx ? ' active' : ''); });
    }

    prev.addEventListener('click', function(){ if (idx > 0) { idx--; update(); } });
    next.addEventListener('click', function(){ if (idx < maxIdx()) { idx++; update(); } });
    window.addEventListener('resize', function(){ idx = Math.min(idx, maxIdx()); buildDots(); update(); });

    var startX = 0;
    track.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend',   function(e){
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) { if (diff > 0 && idx < maxIdx()) idx++; else if (diff < 0 && idx > 0) idx--; update(); }
    }, {passive:true});

    buildDots();
    update();
  })();`;

  return { statusCode: 200, headers, body: script };
};
