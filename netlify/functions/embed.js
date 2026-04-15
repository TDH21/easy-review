const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/javascript',
  };

  const params = event.queryStringParameters || {};
  const businessId = params.id;
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
  if (el) el.innerHTML = '<p style="font-family:sans-serif;color:#999;text-align:center;padding:2rem 1rem;">No featured reviews yet.</p>';
})();`,
    };
  }

  const safe    = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const stars   = (r) => '\u2605'.repeat(Math.max(0, Math.min(5, r || 0)));
  const dateStr = (d) => d ? new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) : '';

  const avg   = (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1);
  const total = reviews.length;

  const cardsHtmlJson = JSON.stringify(
    reviews.map(r =>
      '<div class="er-card">' +
        '<div class="er-quote">\u201C</div>' +
        '<p class="er-text">' + safe(r.comment) + '</p>' +
        '<div class="er-stars">' + stars(r.rating) + '</div>' +
        '<div class="er-meta">' +
          '<span class="er-name">' + safe(r.customer_name || 'Verified Customer') + '</span>' +
          '<span class="er-date">' + dateStr(r.created_at) + '</span>' +
        '</div>' +
      '</div>'
    ).join('')
  );

  const badgeDataJson = JSON.stringify(
    reviews.slice(0, Math.min(reviews.length, 8)).map(r => ({
      n: safe(r.customer_name || 'Customer'),
      t: safe((r.comment || '').slice(0, 80))
    }))
  );

  const script = `(function(){
  /* Fonts: Playfair Display + Dancing Script */
  if (!document.getElementById('er-gfont')) {
    var lk = document.createElement('link');
    lk.id = 'er-gfont'; lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Dancing+Script:wght@600&display=swap';
    document.head.appendChild(lk);
  }

  var ER_AVG   = '${avg}';
  var ER_TOTAL = ${total};
  var ER_BADGE = ${badgeDataJson};
  var ER_CARDS = ${cardsHtmlJson};

  /* ---- CSS ---- */
  var css =
    /* Full-width breakout + navy background */
    '#er-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'background:linear-gradient(150deg,#132b4d 0%,#0c1e37 100%);' +
      'padding:4rem 0 3rem;box-sizing:border-box;overflow:hidden;' +
      'width:100vw;position:relative;left:50%;transform:translateX(-50%);}' +

    /* Header */
    '#er-header{text-align:center;padding:0 1.5rem;margin-bottom:2.5rem;}' +
    '#er-tag{font-size:0.7rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:0.75rem;}' +
    '#er-rating-row{display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-bottom:0.6rem;}' +
    '#er-avg{font-family:"Playfair Display",Georgia,serif;font-size:2rem;font-weight:700;color:#ffffff;line-height:1;}' +
    '#er-rat-stars{color:#c8a96e;font-size:1.05rem;letter-spacing:2px;text-shadow:0 1px 3px rgba(0,0,0,0.3);}' +
    '#er-rat-count{font-size:0.82rem;color:rgba(255,255,255,0.45);}' +
    '#er-gold-line{width:36px;height:2px;background:rgba(255,255,255,0.2);margin:0 auto 1rem;}' +
    '#er-heading{font-family:"Playfair Display",Georgia,serif;font-size:clamp(1.4rem,4vw,2rem);font-weight:700;color:#ffffff;margin:0;}' +

    /* Carousel */
    '#er-carousel{position:relative;padding:2rem 60px;}' +
    '#er-track-outer{overflow:hidden;}' +
    '#er-track{display:flex;gap:20px;align-items:center;transition:transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94);will-change:transform;}' +

    /* Cards — base (far) */
    '.er-card{flex:0 0 300px;background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.5);border-radius:18px;padding:1.75rem 1.5rem 1.4rem;box-sizing:border-box;position:relative;overflow:hidden;' +
      'transition:transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.55s ease,box-shadow 0.55s ease,background 0.55s ease;' +
      'transform:scale(0.82);opacity:0.35;cursor:pointer;user-select:none;}' +

    /* Adjacent cards */
    '.er-card.er-adj{transform:scale(0.91);opacity:0.65;}' +

    /* Active (featured) card */
    '.er-card.er-active{background:#ffffff;border:none;' +
      'box-shadow:0 4px 0 rgba(0,0,0,0.06),0 12px 40px rgba(0,0,0,0.18),0 32px 72px rgba(0,0,0,0.12);' +
      'transform:scale(1.07);opacity:1;cursor:default;z-index:2;}' +

    /* Quote mark */
    '.er-quote{position:absolute;top:-0.25rem;right:0.75rem;font-size:6rem;line-height:1;font-family:Georgia,serif;pointer-events:none;color:#c8a96e;opacity:0.15;}' +
    '.er-card.er-active .er-quote{opacity:0.1;}' +

    /* Review text */
    '.er-text{margin:0 0 1.1rem;font-size:0.85rem;line-height:1.72;color:rgba(255,255,255,0.75);font-style:italic;position:relative;}' +
    '.er-card.er-active .er-text{color:#2a2a2a;font-size:0.95rem;}' +

    /* Stars */
    '.er-stars{color:rgba(255,255,255,0.6);font-size:0.92rem;letter-spacing:2px;margin-bottom:1rem;}' +
    '.er-card.er-active .er-stars{color:#c8a96e;}' +

    /* Meta row */
    '.er-meta{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.25);padding-top:0.85rem;}' +
    '.er-card.er-active .er-meta{border-top-color:#ede8e1;}' +

    /* Name — Dancing Script */
    '.er-name{font-family:"Dancing Script",cursive;font-size:1.05rem;font-weight:600;color:rgba(255,255,255,0.65);}' +
    '.er-card.er-active .er-name{color:#1a1a1a;font-size:1.1rem;}' +

    /* Date */
    '.er-date{font-size:0.7rem;color:rgba(255,255,255,0.4);}' +
    '.er-card.er-active .er-date{color:#b0a89e;}' +

    /* Nav buttons */
    '.er-btn{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;' +
      'border:1.5px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);font-size:1.4rem;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;z-index:3;padding:0;line-height:1;}' +
    '.er-btn:hover:not([disabled]){background:rgba(255,255,255,0.18);color:#c8a96e;border-color:rgba(255,255,255,0.4);}' +
    '.er-btn[disabled]{opacity:0.2;cursor:default;}' +
    '#er-prev{left:0;}#er-next{right:0;}' +

    /* Dots */
    '#er-dots{display:flex;justify-content:center;gap:7px;margin-top:1.5rem;}' +
    '.er-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.25);border:none;padding:0;cursor:pointer;transition:all 0.25s;}' +
    '.er-dot.er-da{background:rgba(255,255,255,0.85);width:24px;border-radius:3px;}' +

    /* Footer */
    '#er-footer{text-align:center;margin-top:1.5rem;font-size:0.65rem;color:rgba(255,255,255,0.3);letter-spacing:0.05em;}' +
    '#er-footer a{color:rgba(255,255,255,0.45);text-decoration:none;}' +

    /* Floating badge (stays dark) */
    '#er-badge{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
    '#er-bp{background:#0d0d0d;border:1px solid rgba(200,169,110,0.38);border-radius:60px;padding:0.55rem 0.8rem 0.55rem 0.75rem;' +
      'display:flex;align-items:center;gap:0.55rem;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,0.55);transition:transform 0.2s,box-shadow 0.2s;}' +
    '#er-bp:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.65);}' +
    '#er-bl{display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;}' +
    '#er-ba{color:#fff;font-weight:700;font-size:0.88rem;line-height:1;}' +
    '#er-bs{color:#c8a96e;font-size:0.58rem;letter-spacing:1px;}' +
    '#er-bsep{width:1px;height:28px;background:rgba(200,169,110,0.22);flex-shrink:0;}' +
    '#er-brev{max-width:168px;}' +
    '#er-btxt{color:rgba(255,255,255,0.65);font-size:0.68rem;line-height:1.38;font-style:italic;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
    '#er-bname{color:rgba(255,255,255,0.3);font-size:0.6rem;margin-top:2px;}' +
    '#er-bclose{color:rgba(255,255,255,0.28);font-size:0.9rem;cursor:pointer;padding:0 2px;flex-shrink:0;line-height:1;background:none;border:none;}' +
    '#er-bclose:hover{color:#fff;}' +

    /* Responsive */
    '@media(max-width:860px){.er-card{flex:0 0 260px;}#er-carousel{padding:2rem 50px;}}' +
    '@media(max-width:520px){.er-card{flex:0 0 80vw;}#er-carousel{padding:2rem 40px;}#er-badge{bottom:1rem;right:1rem;}#er-brev{max-width:120px;}}';

  if (!document.getElementById('er-style')) {
    var st = document.createElement('style'); st.id = 'er-style'; st.textContent = css; document.head.appendChild(st);
  }

  /* ---- MAIN WIDGET ---- */
  var el = document.getElementById('easy-review-widget');
  if (el) {
    el.innerHTML =
      '<div id="er-root">' +
        '<div id="er-header">' +
          '<div id="er-tag">Customer Reviews</div>' +
          '<div id="er-rating-row">' +
            '<span id="er-avg">' + ER_AVG + '</span>' +
            '<span id="er-rat-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>' +
            '<span id="er-rat-count">' + ER_TOTAL + ' reviews</span>' +
          '</div>' +
          '<div id="er-gold-line"></div>' +
          '<h2 id="er-heading">What Our Customers Say</h2>' +
        '</div>' +
        '<div id="er-carousel">' +
          '<button class="er-btn" id="er-prev">&#8249;</button>' +
          '<div id="er-track-outer"><div id="er-track">' + ER_CARDS + '</div></div>' +
          '<button class="er-btn" id="er-next">&#8250;</button>' +
        '</div>' +
        '<div id="er-dots"></div>' +
        '<div id="er-footer">Powered by <a href="https://easyreviewer.netlify.app" target="_blank" rel="noopener">Easy Review</a></div>' +
      '</div>';

    var track    = document.getElementById('er-track');
    var trackOut = document.getElementById('er-track-outer');
    var prevBtn  = document.getElementById('er-prev');
    var nextBtn  = document.getElementById('er-next');
    var dotsEl   = document.getElementById('er-dots');
    var idx = 0;
    var n   = track.children.length;
    var timer;

    function goTo(i) {
      idx = Math.max(0, Math.min(i, n - 1));
      var cw  = track.children[0] ? track.children[0].offsetWidth : 300;
      var gap = 20;
      var off = (trackOut.offsetWidth / 2) - (cw / 2) - idx * (cw + gap);
      track.style.transform = 'translateX(' + off + 'px)';
      var cards = track.querySelectorAll('.er-card');
      cards.forEach(function(c, j) {
        var d = Math.abs(j - idx);
        c.className = 'er-card' + (d === 0 ? ' er-active' : d === 1 ? ' er-adj' : '');
        if (d > 0) {
          c.onclick = (function(j){ return function(){ stopAuto(); goTo(j); startAuto(); }; })(j);
        } else {
          c.onclick = null;
        }
      });
      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx >= n - 1;
      dotsEl.querySelectorAll('.er-dot').forEach(function(d, j){ d.className = 'er-dot' + (j === idx ? ' er-da' : ''); });
    }

    for (var i = 0; i < n; i++) {
      (function(i){
        var d = document.createElement('button');
        d.className = 'er-dot';
        d.setAttribute('aria-label', 'Review ' + (i + 1));
        d.addEventListener('click', function(){ stopAuto(); goTo(i); startAuto(); });
        dotsEl.appendChild(d);
      })(i);
    }

    prevBtn.addEventListener('click', function(){ if (idx > 0) { stopAuto(); goTo(idx - 1); startAuto(); } });
    nextBtn.addEventListener('click', function(){ if (idx < n - 1) { stopAuto(); goTo(idx + 1); startAuto(); } });

    function startAuto() { timer = setInterval(function(){ goTo(idx < n - 1 ? idx + 1 : 0); }, 5500); }
    function stopAuto()  { clearInterval(timer); }
    startAuto();
    el.addEventListener('mouseenter', stopAuto);
    el.addEventListener('mouseleave', startAuto);

    var sx = 0;
    track.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, {passive:true});
    track.addEventListener('touchend',   function(e){
      var dx = sx - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 40) { stopAuto(); goTo(dx > 0 ? idx + 1 : idx - 1); startAuto(); }
    }, {passive:true});

    window.addEventListener('resize', function(){ goTo(idx); });
    setTimeout(function(){ goTo(0); }, 80);
  }

  /* ---- FLOATING BADGE ---- */
  if (document.getElementById('er-badge') || sessionStorage.getItem('er-bd')) return;

  var badge = document.createElement('div');
  badge.id = 'er-badge';
  badge.innerHTML =
    '<div id="er-bp">' +
      '<div id="er-bl">' +
        '<span id="er-ba">' + ER_AVG + '&#9733;</span>' +
        '<span id="er-bs">&#9733;&#9733;&#9733;&#9733;&#9733;</span>' +
      '</div>' +
      '<div id="er-bsep"></div>' +
      '<div id="er-brev"><div id="er-btxt"></div><div id="er-bname"></div></div>' +
      '<button id="er-bclose" aria-label="Dismiss">&times;</button>' +
    '</div>';
  document.body.appendChild(badge);

  var btxt  = document.getElementById('er-btxt');
  var bname = document.getElementById('er-bname');
  var bi = 0;

  function setBadge(i) {
    var r = ER_BADGE[i % ER_BADGE.length];
    var t = r.t.length > 68 ? r.t.slice(0, 68) + '...' : r.t;
    btxt.textContent  = '\u201C' + t + '\u201D';
    bname.textContent = '\u2014 ' + r.n;
  }
  setBadge(0);
  setInterval(function(){ bi = (bi + 1) % ER_BADGE.length; setBadge(bi); }, 4500);

  document.getElementById('er-bclose').addEventListener('click', function(e){
    e.stopPropagation(); badge.remove(); sessionStorage.setItem('er-bd', '1');
  });
  document.getElementById('er-bp').addEventListener('click', function(e){
    if (e.target.id === 'er-bclose') return;
    var w = document.getElementById('easy-review-widget');
    if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

})();`;

  return { statusCode: 200, headers, body: script };
};
