/* Chata pod Belianskymi Tatrami — frontend logic.
   Data lives on the server (server/data.json), shared by every visitor.
   The admin password lives only on the server and never appears here. */

const MONTHS = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];
const PAGE_SLUGS = { home: '', pricing: 'cennik', gallery: 'galeria', nearby: 'okolie', faq: 'otazky', reviews: 'recenzie', contact: 'kontakt' };
// "kalendar" is a legacy URL from before Cenník and Kalendár were merged into one page —
// keep it resolving to the same page so old links/bookmarks still work.
const SLUG_ALIASES = { kalendar: 'pricing' };
const SLUG_TO_PAGE = Object.fromEntries(Object.entries(PAGE_SLUGS).map(([p, s]) => [s, p]));

let SITE = { heroTitle:'', heroTagline:'', aboutText:'', basePrice:120, maxGuests:4, capacityNote:'', minNights:3, maxNights:null, bookingHorizonDays:365, address:'Ždiar, Belianske Tatry, Slovensko', phone:'', email:'', facebookUrl:'', ratingBadgeEnabled:false, ratingBadgeScore:'', ratingBadgePlatform:'', ratingBadgeYear:'', heroHelperText:'', heroImageSummer:'', heroImageWinter:'' };
let GALLERY_CATEGORIES = [];
let CUSTOM_PAGES = [];
let SECTION_VISIBILITY = { quickCheck:true, highlights:true, about:true, lastMinute:true, specialOffers:true, reviewsTeaser:true, pageGallery:true, pageNearby:true, pageFaq:true, pageReviews:true };
let galleryFilter = 'all';
let PRICING_SEASONS = [];
let FAQ = [];
let heroSeason = 'summer';
let AMENITIES = [];
let FACTS = [];
let HIGHLIGHTS = [];
const PLACEHOLDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-4 4-3-3-4 4"/></svg>';
let GALLERY = [];
let DEALS = [];
let PRICE_RULES = [];
let STAY_RULES = [];
let SPECIAL_OFFERS = [];
let NEARBY = [];
let BLOCKS = [];
let REVIEWS = [];
let ADMIN_BLOCKS = [];
let ADMIN_REVIEWS = [];
let ADMIN_VOUCHERS = [];

let calYear, calMonth;
let selection = {start:null, end:null};
let currentPage = 'home';
let currentCustomSlug = null;
let pickedStars = 0;
let appliedVoucher = null; // {code, type, value}

/* ---------- tiny API helper ---------- */
async function api(method, url, body, isForm){
  const opts = { method, credentials:'same-origin' };
  if(body){
    if(isForm){ opts.body = body; }
    else { opts.headers = {'Content-Type':'application/json'}; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  let data = null;
  try{ data = await res.json(); }catch(e){}
  if(!res.ok){ throw new Error((data && data.error) || `Chyba servera (${res.status})`); }
  return data;
}

/* ---------- routing ---------- */
function parseLocation(){
  const parts = location.pathname.split('/').filter(Boolean);
  const slug = parts[0] || '';
  if(slug === '') return 'home';
  if(SLUG_ALIASES[slug]) return SLUG_ALIASES[slug];
  if(SLUG_TO_PAGE[slug] !== undefined) return SLUG_TO_PAGE[slug];
  // Not a fixed page — might be an admin-created custom page. Resolved once
  // CUSTOM_PAGES has loaded (see render()), since it isn't available yet
  // on the very first call before the initial state fetch completes.
  return 'unknown:' + slug;
}
function buildPath(page){ return '/' + (PAGE_SLUGS[page] || ''); }
function navigate(page){
  if(page === 'calendar') page = 'pricing'; // legacy alias from before pages were merged
  currentPage = page;
  history.pushState({}, '', buildPath(page));
  render();
}
function navigateToBooking(){
  navigate('pricing');
  setTimeout(()=>{
    const el = document.getElementById('calendarSection');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }, 60);
}
function navigateToCustomPage(slug){
  currentPage = 'custom';
  currentCustomSlug = slug;
  history.pushState({}, '', '/' + slug);
  render();
}
window.addEventListener('popstate', ()=>{ currentPage = parseLocation(); render(); });

function render(){
  if(typeof currentPage === 'string' && currentPage.startsWith('unknown:')){
    const slug = currentPage.slice(8);
    const match = CUSTOM_PAGES.find(p => p.slug === slug);
    if(match){ currentPage = 'custom'; currentCustomSlug = slug; }
    else { currentPage = 'home'; history.replaceState({}, '', buildPath('home')); }
  }
  const hiddenPageMap = { gallery:'pageGallery', nearby:'pageNearby', faq:'pageFaq', reviews:'pageReviews' };
  if(hiddenPageMap[currentPage] && SECTION_VISIBILITY[hiddenPageMap[currentPage]] === false){
    currentPage = 'home';
    history.replaceState({}, '', buildPath('home'));
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+currentPage).classList.add('active');
  document.querySelectorAll('nav.links a').forEach(a=>a.classList.toggle('active', a.dataset.page===currentPage));
  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo(0,0);
  updateMeta();
  renderAll();
}
function updateMeta(){
  const titles = {
    home: 'Chata pod Belianskymi Tatrami — ubytovanie v Ždiari',
    pricing: 'Cenník a termíny — Chata pod Belianskymi Tatrami',
    gallery: 'Galéria — Chata pod Belianskymi Tatrami',
    nearby: 'Okolie — Chata pod Belianskymi Tatrami',
    faq: 'Otázky — Chata pod Belianskymi Tatrami',
    contact: 'Kontakt — Chata pod Belianskymi Tatrami',
    reviews: 'Recenzie — Chata pod Belianskymi Tatrami'
  };
  if(currentPage === 'custom'){
    const page = CUSTOM_PAGES.find(p => p.slug === currentCustomSlug);
    document.title = (page ? (page.title || page.navLabel) + ' — ' : '') + 'Chata pod Belianskymi Tatrami';
  } else {
    document.title = titles[currentPage] || titles.home;
  }
  updateMetaTags();
}

/* ---------- loading public state ---------- */
async function loadState(){
  try{
    const data = await api('GET', '/api/state');
    applyState(data);
  }catch(e){
    console.error('Could not load site data — is the server running?', e);
    document.body.insertAdjacentHTML('afterbegin',
      `<div style="background:#f6e3df;color:#8a3a2d;padding:14px 20px;font-size:0.9rem;text-align:center;">
        Nepodarilo sa načítať dáta zo servera. Skontrolujte, či beží (npm start v priečinku server), a obnovte stránku.
      </div>`);
    return;
  }
  renderAll();
}
async function refreshPublicState(){
  try{ applyState(await api('GET', '/api/state')); renderAll(); }
  catch(e){ console.error(e); }
}
function applyState(data){
  SITE = data.site; AMENITIES = data.amenities; FACTS = data.facts || []; HIGHLIGHTS = data.highlights || []; GALLERY = data.gallery; DEALS = data.deals;
  PRICE_RULES = data.pricing; STAY_RULES = data.stayRules || []; SPECIAL_OFFERS = data.specialOffers || [];
  NEARBY = data.nearby; BLOCKS = data.blocks; REVIEWS = data.reviews;
  PRICING_SEASONS = data.pricingSeasons || []; FAQ = data.faq || [];
  GALLERY_CATEGORIES = data.galleryCategories || []; CUSTOM_PAGES = data.customPages || [];
  SECTION_VISIBILITY = data.sectionVisibility || SECTION_VISIBILITY;
}

function renderAll(){
  document.getElementById('heroTitle').textContent = SITE.heroTitle;
  document.getElementById('heroTagline').textContent = SITE.heroTagline;
  document.getElementById('aboutHeading').textContent = SITE.heroTitle;
  document.getElementById('aboutText').textContent = SITE.aboutText;
  document.getElementById('aboutPrice').textContent = SITE.basePrice + ' €/noc';
  document.getElementById('heroLocationText').textContent = (SITE.address || 'Ždiar, Belianske Tatry').toUpperCase();
  document.getElementById('heroHelperTextEl').textContent = SITE.heroHelperText || '';
  document.getElementById('contactPhone').textContent = SITE.phone || '';
  renderHeroFacts();
  renderHeroBackground();
  renderBrandLogo();
  renderHighlights();
  document.getElementById('aboutCapacity').textContent = SITE.maxGuests + ' osoby';
  document.getElementById('capacityNote').textContent = SITE.capacityNote || '';
  document.getElementById('bookingCapacityNote').textContent = SITE.capacityNote || '';
  document.getElementById('contactAddress').textContent = SITE.address || '';
  document.getElementById('contactMap').src = `https://www.google.com/maps?q=${encodeURIComponent(SITE.address || 'Ždiar, Slovensko')}&output=embed`;
  renderAmenities();
  renderGuestPickers();
  populateQuickCheckGuests();
  renderHeroRating();
  renderSpecialOffers();
  renderGallery();
  renderDeals();
  renderNearby();
  renderReviews();
  renderReviewsTeaser();
  renderPricingTable();
  renderFaq();
  renderFooter();
  applySectionVisibility();
  renderFooterPages();
  renderCustomPageContent();
  updateStructuredData();
  renderCalendar();
}

function renderFooter(){
  document.getElementById('footerPhone').textContent = SITE.phone || '';
  document.getElementById('footerEmail').textContent = SITE.email || '';
  document.getElementById('footerAddress').textContent = SITE.address || '';
  const fb = document.getElementById('footerFacebook');
  if(SITE.facebookUrl){ fb.href = SITE.facebookUrl; fb.style.display = 'inline'; } else { fb.style.display = 'none'; }
  const badge = document.getElementById('ratingBadge');
  if(SITE.ratingBadgeEnabled && SITE.ratingBadgeScore){
    badge.style.display = 'inline-flex';
    document.getElementById('ratingBadgeScore').textContent = SITE.ratingBadgeScore;
    document.getElementById('ratingBadgeText').textContent = `${SITE.ratingBadgePlatform || ''} ${SITE.ratingBadgeYear || ''}`.trim();
  } else { badge.style.display = 'none'; }
}

function renderFooterPages(){
  const wrap = document.getElementById('footerCustomPages');
  wrap.innerHTML = CUSTOM_PAGES.map(p => `
    <div>
      <a onclick="navigateToCustomPage('${p.slug}')">${p.navLabel}</a>
      <span class="edit-gear footer-page-delete" onclick="deleteCustomPage('${p.id}')" title="Odstrániť stránku">×</span>
    </div>
  `).join('');
}
function renderCustomPageContent(){
  const page = CUSTOM_PAGES.find(p => p.slug === currentCustomSlug);
  if(!page) return;
  document.getElementById('customPageTitle').textContent = page.title || page.navLabel;
  document.getElementById('customPageContent').textContent = page.content || '';
}

/* ---------- SEO: per-page meta description/canonical/og, and live structured data ---------- */
function updateMetaTags(){
  const base = 'https://chatapodbelianskymitatrami.sk';
  const path = location.pathname === '/' ? '' : location.pathname;
  const descriptions = {
    home: 'Súkromná zrubová chata priamo v Ždiari s výhľadom na Belianske Tatry. Sauna, krb, terasa — rezervujte si termín online.',
    pricing: 'Cenník a voľné termíny chaty pod Belianskymi Tatrami v Ždiari — skontrolujte dostupnosť a pošlite žiadosť o rezerváciu.',
    gallery: 'Fotogaléria chaty pod Belianskymi Tatrami — interiér, exteriér a okolie v Ždiari.',
    nearby: 'Turistika, cyklotrasy a výlety v okolí chaty v Ždiari, pod Belianskymi Tatrami.',
    faq: 'Odpovede na časté otázky o ubytovaní v chate pod Belianskymi Tatrami.',
    reviews: 'Recenzie hostí, ktorí boli ubytovaní v chate pod Belianskymi Tatrami v Ždiari.',
    contact: 'Kontaktujte nás ohľadom ubytovania v chate pod Belianskymi Tatrami v Ždiari.'
  };
  const desc = descriptions[currentPage] || descriptions.home;
  const descTag = document.querySelector('meta[name="description"]');
  if(descTag) descTag.setAttribute('content', desc);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if(ogDesc) ogDesc.setAttribute('content', desc);
  const canonical = document.querySelector('link[rel="canonical"]');
  if(canonical) canonical.setAttribute('href', base + path);
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if(ogUrl) ogUrl.setAttribute('content', base + path);
}
function updateStructuredData(){
  const script = document.querySelector('script[type="application/ld+json"]');
  if(!script) return;
  try{
    const data = JSON.parse(script.textContent);
    data.name = SITE.heroTitle || data.name;
    data.description = SITE.heroTagline || data.description;
    if(SITE.phone) data.telephone = SITE.phone;
    if(SITE.logo) data.image = location.origin + SITE.logo;
    script.textContent = JSON.stringify(data);
  }catch(e){ /* ignore malformed JSON-LD, non-critical */ }
}

function applySectionVisibility(){
  const set = (id, visible) => { const el = document.getElementById(id); if(el) el.style.display = visible ? '' : 'none'; };
  set('quickCheckWrap', SECTION_VISIBILITY.quickCheck !== false);
  set('highlightsSection', SECTION_VISIBILITY.highlights !== false);
  set('aboutSection', SECTION_VISIBILITY.about !== false);
  set('lastMinuteSection', SECTION_VISIBILITY.lastMinute !== false);
  const pageFlags = { gallery:'pageGallery', nearby:'pageNearby', faq:'pageFaq', reviews:'pageReviews' };
  Object.entries(pageFlags).forEach(([page, flag])=>{
    const visible = SECTION_VISIBILITY[flag] !== false;
    document.querySelectorAll(`[data-page="${page}"]`).forEach(a => { a.style.display = visible ? '' : 'none'; });
  });
}

function renderAmenities(){
  const list = document.getElementById('amenitiesList');
  list.innerHTML = AMENITIES.map(a => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l6 6L20 6"/></svg> ${a.text}</li>`).join('');
}
function renderHeroFacts(){
  const grid = document.getElementById('heroFactsGrid');
  grid.innerHTML = FACTS.map(f => `<div class="fact"><b>${f.value}</b><span>${f.label}</span></div>`).join('');
}
function renderHeroBackground(){
  const img = SITE[heroSeason === 'summer' ? 'heroImageSummer' : 'heroImageWinter'];
  const bg = document.getElementById('heroBg');
  const fallback = document.getElementById('heroFallback');
  const toggle = document.getElementById('heroSeasonToggle');
  const anyImage = SITE.heroImageSummer || SITE.heroImageWinter;
  toggle.style.display = anyImage ? 'flex' : 'none';
  if(img){ bg.style.backgroundImage = `url('${img}')`; bg.style.display = 'block'; fallback.style.display = 'none'; }
  else { bg.style.display = 'none'; fallback.style.display = 'block'; }
}
function setHeroSeason(season){
  heroSeason = season;
  document.querySelectorAll('.season-btn').forEach(b => b.classList.toggle('active', b.dataset.season === season));
  renderHeroBackground();
}
function populateQuickCheckGuests(){
  const sel = document.getElementById('qcGuests');
  if(!sel) return;
  sel.innerHTML = '';
  for(let i=1;i<=(SITE.maxGuests||4);i++){
    const opt = document.createElement('option'); opt.value = i; opt.textContent = i + (i===1?' osoba':' osoby');
    sel.appendChild(opt);
  }
  sel.value = Math.min(2, SITE.maxGuests||4);
}
function quickCheckAvailability(){
  const start = document.getElementById('qcStart').value;
  const end = document.getElementById('qcEnd').value;
  const box = document.getElementById('qcMsg');
  if(!start || !end || end<=start){ box.className='err'; box.textContent='Zadajte platný termín.'; return; }
  if(!isRangeFree(start, end)){ box.className='err'; box.textContent='Tento termín je bohužiaľ obsadený. Skúste iný v kalendári.'; return; }
  const nights = Math.round((new Date(end) - new Date(start)) / 86400000);
  const { min, max } = getMinMaxNights(start);
  if(nights < min){ box.className='err'; box.textContent=`Pre tento termín je minimálny pobyt ${min} ${nightsWord(min)}.`; return; }
  if(max && nights > max){ box.className='err'; box.textContent=`Pre tento termín je maximálny pobyt ${max} ${nightsWord(max)}.`; return; }
  const total = calcTotal(start, end);
  box.className='ok'; box.textContent = `Termín je voľný — ${nights} ${nightsWord(nights)} za ${total} €. Presuniete Vás do kalendára na dokončenie žiadosti...`;
  selection = {start, end};
  setTimeout(()=>navigateToBooking(), 700);
}

/* ---------- pricing table (Cenník) ---------- */
function renderPricingTable(){
  const wrap = document.getElementById('pricingTable');
  if(!PRICING_SEASONS.length){ wrap.innerHTML = '<p class="no-deals" style="padding:24px;">Cenník sa práve pripravuje — presnú cenu pre váš termín uvidíte v kalendári.</p>'; return; }
  let html = `<div class="pt-head"><span>Sezóna</span><span>Termín</span><span>Minimum</span><span>Cena / noc</span></div>`;
  PRICING_SEASONS.forEach(s=>{
    html += `<div class="pt-row">
      <span data-label="Sezóna" class="pt-name">${s.name}${s.isTop ? '<span class="pt-top-tag">TOP SEZÓNA</span>' : ''}</span>
      <span data-label="Termín">${s.dateRangeLabel}</span>
      <span data-label="Minimum">${s.minNights ? s.minNights + ' ' + nightsWord(s.minNights) : '—'}</span>
      <span data-label="Cena/noc" class="pt-price">${s.price} €</span>
    </div>`;
  });
  wrap.innerHTML = html;
}

/* ---------- FAQ accordion ---------- */
function renderFaq(){
  const list = document.getElementById('faqList');
  list.innerHTML = FAQ.map((f,i) => `
    <div class="faq-item" id="faqItem${i}">
      <button class="faq-question" onclick="toggleFaq(${i})">${f.question}<span class="faq-toggle-icon">+</span></button>
      <div class="faq-answer"><p>${f.answer}</p></div>
    </div>
  `).join('');
}
function toggleFaq(i){
  document.getElementById('faqItem'+i).classList.toggle('open');
}

function renderBrandLogo(){
  const el = document.getElementById('brandLogo');
  el.innerHTML = SITE.logo ? `<img src="${SITE.logo}" alt="Logo">` : PLACEHOLDER_ICON;
}
function renderHighlights(){
  const grid = document.getElementById('highlightsGrid');
  grid.innerHTML = HIGHLIGHTS.map(h => `
    <div class="highlight-card">
      <div class="hicon-wrap">${h.icon ? `<img src="${h.icon}" alt="">` : PLACEHOLDER_ICON}</div>
      <h3>${h.title}</h3><p>${h.text}</p>
    </div>
  `).join('');
}

function renderHeroRating(){
  const badge = document.getElementById('trustBadge');
  if(!REVIEWS.length){ badge.style.display = 'none'; return; }
  const avg = REVIEWS.reduce((s,r)=>s+r.rating,0) / REVIEWS.length;
  badge.style.display = 'inline-flex';
  document.getElementById('trustBadgeScore').textContent = avg.toFixed(1);
  document.getElementById('trustBadgeCount').textContent = `(${REVIEWS.length} ${REVIEWS.length===1?'recenzia':REVIEWS.length<5?'recenzie':'recenzií'})`;
}

/* ---------- special offers (public, multiple, colored) ---------- */
function renderSpecialOffers(){
  const wrap = document.getElementById('specialOffersWrap');
  const isAdmin = document.body.classList.contains('admin-mode');
  if(SECTION_VISIBILITY.specialOffers === false){ wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
  const gear = `<button class="edit-gear section-gear" style="position:static; margin-bottom:12px;" onclick="openAdmin(); showAdminTab('special')" title="Upraviť">⚙ Špeciálne ponuky</button>`;
  if(!SPECIAL_OFFERS.length){
    wrap.style.display = isAdmin ? 'block' : 'none';
    wrap.innerHTML = isAdmin ? gear : '';
    return;
  }
  wrap.style.display = 'block';
  wrap.innerHTML = (isAdmin ? gear : '') + SPECIAL_OFFERS.map(o => `
    <div class="special-offer special-offer--${o.color || 'amber'}">
      <span class="special-offer-badge">Špeciálna ponuka</span>
      ${o.title ? `<h3>${o.title}</h3>` : ''}
      ${o.text ? `<p>${o.text}</p>` : ''}
      ${o.ctaEnabled !== false ? `<button class="btn-primary special-offer-cta" onclick="navigateToBooking()">${o.ctaLabel || 'Rezervovať'}</button>` : ''}
    </div>
  `).join('');
}

/* ---------- gallery (real <img> tags for SEO/accessibility, with category filter) ---------- */
function renderGalleryFilters(){
  const wrap = document.getElementById('galleryFilters');
  if(!GALLERY_CATEGORIES.length){ wrap.innerHTML = ''; return; }
  const usedCats = new Set(GALLERY.map(g=>g.category).filter(Boolean));
  const relevant = GALLERY_CATEGORIES.filter(c=>usedCats.has(c.id));
  if(!relevant.length){ wrap.innerHTML = ''; return; }
  let html = `<button class="gallery-filter-btn ${galleryFilter==='all'?'active':''}" onclick="setGalleryFilter('all')">Všetky</button>`;
  relevant.forEach(c=>{
    html += `<button class="gallery-filter-btn ${galleryFilter===c.id?'active':''}" onclick="setGalleryFilter('${c.id}')">${c.name}</button>`;
  });
  wrap.innerHTML = html;
}
function setGalleryFilter(catId){
  galleryFilter = catId;
  renderGalleryFilters();
  renderGallery();
}
function renderGallery(){
  renderGalleryFilters();
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = "";
  const items = galleryFilter === 'all' ? GALLERY : GALLERY.filter(g => g.category === galleryFilter);
  items.forEach((g,i)=>{
    const fig = document.createElement('figure');
    if(i===0) fig.classList.add('big');
    fig.onclick = ()=>openLightbox(g.url, g.caption);
    if(g.url){
      const img = document.createElement('img');
      img.src = g.url; img.alt = g.caption || 'Fotka chaty pod Belianskymi Tatrami'; img.loading = 'lazy';
      fig.appendChild(img);
    } else {
      fig.style.background = g.tone || '#5B6F5C';
    }
    const cap = document.createElement('figcaption'); cap.textContent = g.caption || '';
    fig.appendChild(cap); grid.appendChild(fig);
  });
}
function openLightbox(url, caption){
  const img = document.getElementById('lightboxImg');
  if(url){ img.src = url; img.alt = caption || ''; img.style.display='block'; } else { img.style.display='none'; }
  document.getElementById('lightboxCap').textContent = caption || "";
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox(){ document.getElementById('lightbox').classList.remove('open'); }

/* ---------- deals ---------- */
function renderDeals(){
  const wrap = document.getElementById('dealCards');
  wrap.innerHTML = "";
  if(!DEALS.length){ wrap.innerHTML = '<p class="no-deals">Momentálne žiadne last-minute ponuky.</p>'; return; }
  DEALS.forEach(d=>{
    const price = SITE.basePrice * (1 - (d.discount||0)/100);
    const card = document.createElement('div'); card.className = 'deal-card';
    card.innerHTML = `<span class="tag">-${d.discount||0}%</span><h3>${d.title}</h3><div class="dates">${fmtShort(d.start)} – ${fmtShort(d.end)}${d.note ? ' · '+d.note : ''}</div><div class="price-line"><span class="old">${SITE.basePrice} €</span><span class="new">${price.toFixed(0)} €/noc</span></div>`;
    wrap.appendChild(card);
  });
}

/* ---------- nearby: optional image + expandable detail tags ---------- */
function renderNearby(){
  const grid = document.getElementById('nearbyGrid');
  grid.innerHTML = '';
  NEARBY.forEach(n=>{
    const card = document.createElement('div'); card.className = 'nearby-card';
    const img = n.image ? `<div class="nearby-card-img" style="background-image:url('${n.image}')"></div>` : '';
    const hasDetails = n.details && n.details.length;
    const tags = hasDetails ? n.details.map(d=>`<span class="nearby-detail-tag"><b>${d.label}:</b> ${d.value}</span>`).join('') : '';
    const toggleId = 'nb_' + n.id;
    card.innerHTML = `
      ${img}
      <div class="nearby-card-body">
        <div class="nb-top"><h3>${n.title}</h3><span class="nb-dist">${n.distance||''}</span></div>
        <p>${n.description}</p>
        ${hasDetails ? `<button class="nearby-toggle" onclick="toggleNearbyDetails('${toggleId}')">Zobraziť viac</button><div class="nearby-details" id="${toggleId}">${tags}</div>` : ''}
      </div>`;
    grid.appendChild(card);
  });
}
function toggleNearbyDetails(id){
  const el = document.getElementById(id);
  el.classList.toggle('open');
  const btn = el.previousElementSibling;
  btn.textContent = el.classList.contains('open') ? 'Skryť' : 'Zobraziť viac';
}

/* ---------- reviews (public display) ---------- */
function reviewCardHTML(r){
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5-r.rating);
  const date = new Date(r.createdAt).toLocaleDateString('sk-SK');
  const source = r.source ? `<span class="review-source">${r.source}</span>` : '';
  return `<div class="review-card"><div class="stars">${stars}</div><div class="review-name">${r.name} ${source}</div><p>${r.comment}</p><div class="review-date">${date}</div></div>`;
}
function renderReviews(){
  const list = document.getElementById('reviewsList');
  list.innerHTML = REVIEWS.length ? REVIEWS.map(reviewCardHTML).join('') : '<p class="no-deals">Zatiaľ žiadne zverejnené recenzie.</p>';
}
function renderReviewsTeaser(){
  const section = document.getElementById('reviewsTeaserSection');
  const wrap = document.getElementById('reviewsTeaser');
  if(!REVIEWS.length || SECTION_VISIBILITY.reviewsTeaser === false){ section.style.display = 'none'; return; }
  section.style.display = 'block';
  wrap.innerHTML = REVIEWS.slice(0,3).map(reviewCardHTML).join('');
}

/* ---------- review submission (verified by reservation reference, not a token) ---------- */
function renderStars(){
  document.querySelectorAll('#starPicker span').forEach(s=>{
    s.classList.toggle('filled', Number(s.dataset.star) <= pickedStars);
  });
}
document.addEventListener('click', (e)=>{
  if(e.target.closest('#starPicker span')){
    pickedStars = Number(e.target.closest('span').dataset.star);
    renderStars();
  }
});
async function submitReview(){
  const ref = document.getElementById('rvRef').value.trim();
  const name = document.getElementById('rvName').value.trim();
  const comment = document.getElementById('rvComment').value.trim();
  const box = document.getElementById('reviewFormMsg');
  if(!ref || !name || !pickedStars || !comment){
    box.className = 'form-msg err'; box.textContent = 'Vyplňte prosím kód rezervácie, meno, hodnotenie a text recenzie.'; return;
  }
  try{
    await api('POST', '/api/reviews', { ref, name, rating: pickedStars, comment });
    box.className = 'form-msg ok'; box.textContent = 'Ďakujeme za Vašu recenziu! Po krátkej kontrole ju zverejníme.';
    document.getElementById('reviewFormWrap').querySelectorAll('input,textarea').forEach(el=>el.value='');
    pickedStars = 0; renderStars();
  }catch(e){
    box.className = 'form-msg err'; box.textContent = e.message || 'Nepodarilo sa odoslať recenziu.';
  }
}

/* ---------- calendar / pricing core ---------- */
function pad(n){ return n<10 ? '0'+n : ''+n; }
function toISO(y,m,d){ return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayISO(){ const t=new Date(); return toISO(t.getFullYear(), t.getMonth(), t.getDate()); }
function getBlockForDate(iso){ return BLOCKS.find(b => iso >= b.start && iso < b.end); }
function getPriceRuleForDate(iso){
  for(let i=PRICE_RULES.length-1; i>=0; i--){ const r = PRICE_RULES[i]; if(iso >= r.start && iso < r.end) return r; }
  return null;
}
function getNightPrice(iso){ const r = getPriceRuleForDate(iso); return r ? r.price : SITE.basePrice; }
function getStayRuleForDate(iso){
  for(let i=STAY_RULES.length-1; i>=0; i--){ const r = STAY_RULES[i]; if(iso >= r.start && iso < r.end) return r; }
  return null;
}
function getMinMaxNights(startISO){
  const rule = getStayRuleForDate(startISO);
  return {
    min: (rule && rule.minNights) || SITE.minNights || 1,
    max: (rule && rule.maxNights) || SITE.maxNights || null
  };
}
function isRangeFree(startISO, endISO){
  let d = new Date(startISO); const end = new Date(endISO);
  while(d < end){ const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate()); if(getBlockForDate(iso)) return false; d.setDate(d.getDate()+1); }
  return true;
}
function calcTotal(startISO, endISO){
  let d = new Date(startISO); const end = new Date(endISO); let total = 0;
  while(d < end){ total += getNightPrice(toISO(d.getFullYear(), d.getMonth(), d.getDate())); d.setDate(d.getDate()+1); }
  return total;
}
function shiftMonth(delta){
  calMonth += delta;
  if(calMonth<0){calMonth=11; calYear--;}
  if(calMonth>11){calMonth=0; calYear++;}
  renderCalendar();
}
function renderCalendar(){
  if(calYear === undefined){ const t = new Date(); calYear = t.getFullYear(); calMonth = t.getMonth(); }
  document.getElementById('calMonthLabel').textContent = MONTHS[calMonth] + ' ' + calYear;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  const first = new Date(calYear, calMonth, 1);
  let startOffset = first.getDay(); startOffset = (startOffset === 0) ? 6 : startOffset - 1;
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const tISO = todayISO();
  const horizon = new Date(); horizon.setDate(horizon.getDate() + (SITE.bookingHorizonDays || 365));
  const horizonISO = toISO(horizon.getFullYear(), horizon.getMonth(), horizon.getDate());

  for(let i=0;i<startOffset;i++){ const blank = document.createElement('div'); blank.className = 'cal-day blank'; grid.appendChild(blank); }
  for(let d=1; d<=daysInMonth; d++){
    const iso = toISO(calYear, calMonth, d);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;
    const block = getBlockForDate(iso);
    const isPast = iso < tISO;
    const isTooFar = iso > horizonISO;
    let inSelection = false;
    if(selection.start && !selection.end && iso === selection.start) inSelection = true;
    if(selection.start && selection.end && iso >= selection.start && iso <= selection.end) inSelection = true;

    if(isPast){ cell.classList.add('past'); }
    else if(isTooFar){ cell.classList.add('toofar'); cell.title = `Rezervácie sú momentálne možné najviac ${SITE.bookingHorizonDays} dní vopred.`; }
    else if(block){ cell.classList.add(block.status); }
    else { cell.classList.add('available'); cell.onclick = ()=>onDayClick(iso); }

    if(!isPast && !isTooFar && !block){
      const price = getNightPrice(iso);
      if(price < SITE.basePrice){
        cell.title = `${price} €/noc — zľavnená cena`;
        const tri = document.createElement('span'); tri.className='price-triangle'; cell.appendChild(tri);
      } else {
        cell.title = price + ' €/noc';
      }
    }
    if(inSelection) cell.classList.add('selected');
    if(iso === tISO) cell.classList.add('today');
    grid.appendChild(cell);
  }
  updateSelectionBar();
}
function onDayClick(iso){
  if(!selection.start || selection.end){ selection = {start: iso, end: null}; }
  else if(iso <= selection.start){ selection = {start: iso, end: null}; }
  else {
    if(!isRangeFree(selection.start, iso)){
      alert('Vybraný rozsah obsahuje už obsadené alebo blokované dni. Skúste iný rozsah.');
      selection = {start: iso, end: null};
    } else {
      const nights = Math.round((new Date(iso) - new Date(selection.start)) / 86400000);
      const { min, max } = getMinMaxNights(selection.start);
      if(nights < min){
        alert(`Pre tento termín je minimálny pobyt ${min} ${nightsWord(min)}. Vyberte neskorší deň odchodu.`);
        return;
      }
      if(max && nights > max){
        alert(`Pre tento termín je maximálny pobyt ${max} ${nightsWord(max)}. Vyberte skorší deň odchodu.`);
        return;
      }
      selection.end = iso;
    }
  }
  renderCalendar();
}
function clearSelection(){ selection = {start:null,end:null}; renderCalendar(); }
function nightsCount(){ if(!selection.start || !selection.end) return 0; return Math.round((new Date(selection.end) - new Date(selection.start)) / 86400000); }
function fmtShort(iso){ const [y,m,d] = iso.split('-'); return `${d}.${m}.${y}`; }
function nightsWord(n){ return n===1 ? 'noc' : (n>=2 && n<=4) ? 'noci' : 'nocí'; }

function currentTotal(){
  if(!selection.start || !selection.end) return 0;
  let total = calcTotal(selection.start, selection.end);
  if(appliedVoucher){
    total = appliedVoucher.type === 'percent'
      ? Math.max(0, Math.round(total * (1 - appliedVoucher.value/100)))
      : Math.max(0, Math.round(total - appliedVoucher.value));
  }
  return total;
}
function updateSelectionBar(){
  const bar = document.getElementById('selectionBar');
  const submitBtn = document.getElementById('bkSubmitBtn');
  const stayNote = document.getElementById('stayLengthNote');
  if(selection.start && selection.end){
    const n = nightsCount();
    bar.classList.remove('empty');
    bar.innerHTML = `<span>Vybraný termín: <b>${fmtShort(selection.start)} – ${fmtShort(selection.end)}</b> (${n} ${nightsWord(n)})</span><button class="link" onclick="clearSelection()">Zrušiť výber</button>`;
    submitBtn.disabled = false; submitBtn.textContent = 'Odoslať žiadosť o rezerváciu';
    stayNote.textContent = '';
  } else if(selection.start){
    bar.classList.add('empty'); bar.textContent = `Príchod: ${fmtShort(selection.start)} — teraz kliknite na deň odchodu.`;
    submitBtn.disabled = true; submitBtn.textContent = 'Najprv vyberte termín v kalendári';
    const { min, max } = getMinMaxNights(selection.start);
    stayNote.textContent = max
      ? `Pre tento termín: minimálne ${min} ${nightsWord(min)}, maximálne ${max} ${nightsWord(max)}.`
      : `Pre tento termín: minimálny pobyt ${min} ${nightsWord(min)}.`;
  } else {
    bar.classList.add('empty'); bar.textContent = 'Zatiaľ ste nevybrali žiadny termín.';
    submitBtn.disabled = true; submitBtn.textContent = 'Najprv vyberte termín v kalendári';
    stayNote.textContent = '';
  }
  const n = nightsCount();
  document.getElementById('sumDates').textContent = (selection.start && selection.end) ? `${fmtShort(selection.start)} – ${fmtShort(selection.end)}` : '–';
  document.getElementById('sumNights').textContent = n || '–';
  const note = document.getElementById('sumNote');
  const discountLine = document.getElementById('sumDiscountLine');
  if(n){
    const base = calcTotal(selection.start, selection.end);
    const total = currentTotal();
    document.getElementById('sumTotal').textContent = total.toFixed(0) + ' €';
    if(appliedVoucher){
      discountLine.style.display = 'flex';
      document.getElementById('sumDiscount').textContent = '−' + (base - total).toFixed(0) + ' € (' + appliedVoucher.code + ')';
    } else { discountLine.style.display = 'none'; }
    const avg = base / n;
    note.textContent = Math.abs(avg - SITE.basePrice) > 0.5 ? `Priemerná cena ${avg.toFixed(0)} €/noc — termín obsahuje sezónnu cenu.` : `${SITE.basePrice} €/noc, bez sezónnej úpravy.`;
  } else {
    document.getElementById('sumTotal').textContent = '–';
    discountLine.style.display = 'none';
    note.textContent = '';
  }
}

/* ---------- voucher check ---------- */
async function applyVoucher(){
  const code = document.getElementById('bkVoucher').value.trim();
  const box = document.getElementById('voucherMsg');
  if(!code){ appliedVoucher = null; box.textContent = ''; updateSelectionBar(); return; }
  try{
    const res = await api('POST', '/api/vouchers/validate', { code });
    appliedVoucher = { code: code.toUpperCase(), type: res.type, value: res.value };
    box.className = 'ok';
    box.textContent = res.type === 'percent' ? `Kód platný — zľava ${res.value}%.` : `Kód platný — zľava ${res.value} €.`;
    updateSelectionBar();
  }catch(e){
    appliedVoucher = null;
    box.className = 'err';
    box.textContent = e.message || 'Neplatný kód.';
    updateSelectionBar();
  }
}

/* ---------- guest steppers (adults/kids, connected) ---------- */
function adultsWord(n){ return n===1 ? 'dospelý' : 'dospelí'; }
function kidsWord(n){ return n===1 ? 'dieťa' : 'deti'; }
let guestAdults = 2, guestKids = 0;
function maxAdultsAllowed(){ return Math.max(1, (SITE.maxGuests || 4) - 1); }
function maxKidsAllowed(){ return Math.max(0, (SITE.maxGuests || 4) - guestAdults); }
function clampGuests(){
  const maxA = maxAdultsAllowed();
  if(guestAdults > maxA) guestAdults = maxA;
  if(guestAdults < 1) guestAdults = 1;
  const maxK = maxKidsAllowed();
  if(guestKids > maxK) guestKids = maxK;
  if(guestKids < 0) guestKids = 0;
}
function renderGuestPickers(){
  clampGuests();
  document.getElementById('adultsCount').textContent = guestAdults;
  document.getElementById('kidsCount').textContent = guestKids;
  document.getElementById('adultsMinus').disabled = guestAdults <= 1;
  document.getElementById('adultsPlus').disabled = guestAdults >= maxAdultsAllowed();
  document.getElementById('kidsMinus').disabled = guestKids <= 0;
  document.getElementById('kidsPlus').disabled = guestKids >= maxKidsAllowed();
}
function changeAdults(delta){
  guestAdults += delta;
  if(guestAdults < 1) guestAdults = 1;
  if(guestAdults > maxAdultsAllowed()) guestAdults = maxAdultsAllowed();
  if(guestAdults + guestKids > (SITE.maxGuests || 4)) guestKids = Math.max(0, (SITE.maxGuests || 4) - guestAdults);
  renderGuestPickers();
}
function changeKids(delta){
  guestKids += delta;
  if(guestKids < 0) guestKids = 0;
  if(guestAdults + guestKids > (SITE.maxGuests || 4)) guestKids = Math.max(0, (SITE.maxGuests || 4) - guestAdults);
  renderGuestPickers();
}
function guestsLabel(){
  return guestKids === 0 ? `${guestAdults} ${adultsWord(guestAdults)}` : `${guestAdults} ${adultsWord(guestAdults)} + ${guestKids} ${kidsWord(guestKids)}`;
}

/* ---------- booking submit ---------- */
async function submitBooking(){
  if(!selection.start || !selection.end) return;
  const name = document.getElementById('bkName').value.trim();
  const email = document.getElementById('bkEmail').value.trim();
  const guests = guestsLabel();
  const phone = document.getElementById('bkPhone').value.trim();
  const msg = document.getElementById('bkMsg').value.trim();
  const box = document.getElementById('bookingMsg');
  if(!name || !email){ box.className = 'form-msg err'; box.textContent = 'Vyplňte prosím meno a e-mail.'; return; }

  try{
    const result = await api('POST', '/api/reservations', {
      name, email, phone, guests, start:selection.start, end:selection.end, msg,
      voucherCode: appliedVoucher ? appliedVoucher.code : undefined
    });
    box.className = 'form-msg ok';
    box.innerHTML = result.emailSent
      ? `Žiadosť odoslaná e-mailom, termín je dočasne pridržaný. Váš kód rezervácie: <span class="ref-code">${result.ref}</span>.`
      : `Termín je dočasne pridržaný (kód <span class="ref-code">${result.ref}</span>). Automatický e-mail sa nepodarilo odoslať — skúsime Vás kontaktovať iným spôsobom.`;
    ['bkName','bkEmail','bkPhone','bkMsg','bkVoucher'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('voucherMsg').textContent = '';
    appliedVoucher = null;
    guestAdults = 2; guestKids = 0; renderGuestPickers();
    selection = {start:null,end:null};
    await refreshPublicState();
  }catch(e){
    box.className = 'form-msg err';
    box.textContent = e.message || 'Nepodarilo sa odoslať žiadosť, skúste znova.';
    if(String(e.message).includes('obsadený')) refreshPublicState();
  }
}

/* ---------- contact ---------- */
async function submitContact(){
  const name = document.getElementById('ctName').value.trim();
  const email = document.getElementById('ctEmail').value.trim();
  const message = document.getElementById('ctMsg').value.trim();
  const box = document.getElementById('contactMsg');
  if(!name || !email || !message){ box.className='form-msg err'; box.textContent='Vyplňte prosím všetky polia.'; return; }
  try{
    const result = await api('POST', '/api/contact', {name, email, message});
    box.className = result.emailSent ? 'form-msg ok' : 'form-msg warn';
    box.textContent = result.emailSent ? 'Správa odoslaná, ozveme sa čo najskôr.' : 'Uložené, skúsime Vás kontaktovať iným spôsobom.';
    ['ctName','ctEmail','ctMsg'].forEach(i=>document.getElementById(i).value='');
  }catch(e){
    box.className = 'form-msg err'; box.textContent = e.message || 'Chyba.';
  }
}

/* ---------- admin ---------- */
function openAdmin(){ document.getElementById('adminOverlay').classList.add('open'); }
function closeAdmin(){ document.getElementById('adminOverlay').classList.remove('open'); }

async function checkAdminSession(){
  try{ const res = await api('GET', '/api/admin/check'); if(res.isAdmin){ document.body.classList.add('admin-mode'); showAdminMain(); } }catch(e){}
}
async function tryAdminLogin(){
  const val = document.getElementById('adminPass').value;
  try{ await api('POST', '/api/admin/login', {password: val}); document.body.classList.add('admin-mode'); showAdminMain(); }
  catch(e){ document.getElementById('adminLoginMsg').textContent = e.message || 'Nesprávne heslo.'; }
}
async function adminLogout(){
  await api('POST', '/api/admin/logout');
  document.body.classList.remove('admin-mode');
  document.getElementById('adminLoginView').style.display='block';
  document.getElementById('adminMainView').style.display='none';
  document.getElementById('adminPass').value = '';
  closeAdmin();
}
function showAdminMain(){
  document.getElementById('adminLoginView').style.display='none';
  document.getElementById('adminMainView').style.display='block';
  populateAdminForms();
}
function showAdminTab(tab){
  document.querySelectorAll('.atab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.admin-panel-view').forEach(v=>v.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
}
async function populateAdminForms(){
  document.getElementById('adm_heroTitle').value = SITE.heroTitle;
  document.getElementById('adm_heroTagline').value = SITE.heroTagline;
  document.getElementById('adm_aboutText').value = SITE.aboutText;
  document.getElementById('adm_basePrice').value = SITE.basePrice;
  document.getElementById('adm_maxGuests').value = SITE.maxGuests;
  document.getElementById('adm_capacityNote').value = SITE.capacityNote || '';
  document.getElementById('adm_minNights').value = SITE.minNights || 3;
  document.getElementById('adm_maxNights').value = SITE.maxNights || '';
  document.getElementById('adm_bookingHorizon').value = SITE.bookingHorizonDays || 365;
  document.getElementById('adm_address').value = SITE.address || '';
  document.getElementById('adm_phone').value = SITE.phone || '';
  document.getElementById('adm_email').value = SITE.email || '';
  document.getElementById('adm_facebookUrl').value = SITE.facebookUrl || '';
  document.getElementById('adm_ratingBadgeEnabled').checked = !!SITE.ratingBadgeEnabled;
  document.getElementById('adm_ratingBadgeScore').value = SITE.ratingBadgeScore || '';
  document.getElementById('adm_ratingBadgePlatform').value = SITE.ratingBadgePlatform || '';
  document.getElementById('adm_ratingBadgeYear').value = SITE.ratingBadgeYear || '';
  document.getElementById('adm_heroHelperText').value = SITE.heroHelperText || '';
  try{ ADMIN_BLOCKS = await api('GET','/api/admin/blocks'); }catch(e){ ADMIN_BLOCKS = []; }
  try{ ADMIN_REVIEWS = await api('GET','/api/admin/reviews'); }catch(e){ ADMIN_REVIEWS = []; }
  try{ ADMIN_VOUCHERS = await api('GET','/api/admin/vouchers'); }catch(e){ ADMIN_VOUCHERS = []; }
  renderRequestsAdmin(); renderBlocksAdmin(); renderPricingAdmin(); renderStayRulesAdmin();
  renderVouchersAdmin(); renderGalleryAdmin(); renderGalleryCategoriesAdmin(); renderNearbyAdmin(); renderDealsAdmin();
  renderReviewsAdmin(); renderAmenitiesAdmin(); renderSpecialOffersAdmin(); renderFactsAdmin(); renderHighlightsAdmin();
  renderLogoPreview(); renderHeroImagePreviews(); renderCennikAdmin(); renderFaqAdmin(); renderPagesAdmin();
  populateVisibilityForm();
}
async function saveContent(){
  try{
    const res = await api('PUT', '/api/admin/content', {
      heroTitle: document.getElementById('adm_heroTitle').value,
      heroTagline: document.getElementById('adm_heroTagline').value,
      aboutText: document.getElementById('adm_aboutText').value,
      basePrice: parseFloat(document.getElementById('adm_basePrice').value),
      maxGuests: parseInt(document.getElementById('adm_maxGuests').value, 10),
      capacityNote: document.getElementById('adm_capacityNote').value,
      minNights: parseInt(document.getElementById('adm_minNights').value, 10),
      maxNights: document.getElementById('adm_maxNights').value ? parseInt(document.getElementById('adm_maxNights').value, 10) : null,
      bookingHorizonDays: parseInt(document.getElementById('adm_bookingHorizon').value, 10),
      address: document.getElementById('adm_address').value,
      phone: document.getElementById('adm_phone').value,
      email: document.getElementById('adm_email').value,
      facebookUrl: document.getElementById('adm_facebookUrl').value,
      ratingBadgeEnabled: document.getElementById('adm_ratingBadgeEnabled').checked,
      ratingBadgeScore: document.getElementById('adm_ratingBadgeScore').value,
      ratingBadgePlatform: document.getElementById('adm_ratingBadgePlatform').value,
      ratingBadgeYear: document.getElementById('adm_ratingBadgeYear').value,
      heroHelperText: document.getElementById('adm_heroHelperText').value
    });
    SITE = res.site;
    document.getElementById('contentSaveMsg').textContent = 'Uložené.';
    renderAll();
  }catch(e){ document.getElementById('contentSaveMsg').textContent = e.message || 'Chyba pri ukladaní.'; }
}
/* -- custom pages (freely add/remove, e.g. legal notices, house rules, anything) -- */
function renderPagesAdmin(){
  const list = document.getElementById('pagesAdminList'); list.innerHTML = '';
  if(!CUSTOM_PAGES.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne vlastné stránky.</div>'; return; }
  CUSTOM_PAGES.forEach(p=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span><b>${p.navLabel}</b> <span class="meta">— /${p.slug}</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await deleteCustomPage(p.id); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addCustomPage(){
  const navLabel = document.getElementById('adm_pageNavLabel').value.trim();
  const title = document.getElementById('adm_pageTitle').value.trim();
  const content = document.getElementById('adm_pageContent').value.trim();
  if(!navLabel) return;
  try{
    await api('POST', '/api/admin/pages', {navLabel, title, content});
    ['adm_pageNavLabel','adm_pageTitle','adm_pageContent'].forEach(id=>document.getElementById(id).value='');
    await refreshPublicState(); renderPagesAdmin();
  }catch(e){ alert(e.message); }
}
async function deleteCustomPage(id){
  await api('DELETE', `/api/admin/pages/${id}`);
  await refreshPublicState(); renderPagesAdmin();
}

/* -- section visibility -- */
const VISIBILITY_KEYS = ['quickCheck','highlights','about','lastMinute','specialOffers','reviewsTeaser','pageGallery','pageNearby','pageFaq','pageReviews'];
function populateVisibilityForm(){
  VISIBILITY_KEYS.forEach(key=>{
    const el = document.getElementById('vis_'+key);
    if(el) el.checked = SECTION_VISIBILITY[key] !== false;
  });
}
async function saveSectionVisibility(){
  const payload = {};
  VISIBILITY_KEYS.forEach(key=>{
    const el = document.getElementById('vis_'+key);
    if(el) payload[key] = el.checked;
  });
  try{
    const res = await api('PUT', '/api/admin/section-visibility', payload);
    SECTION_VISIBILITY = res.sectionVisibility;
    document.getElementById('visibilitySaveMsg').textContent = 'Uložené.';
    applySectionVisibility();
  }catch(e){ document.getElementById('visibilitySaveMsg').textContent = e.message || 'Chyba pri ukladaní.'; }
}

/* -- hero background images (summer/winter) -- */
function renderHeroImagePreviews(){
  document.getElementById('adm_heroImgSummerPreview').innerHTML = SITE.heroImageSummer ? `<img src="${SITE.heroImageSummer}" alt="">` : PLACEHOLDER_ICON;
  document.getElementById('adm_heroImgWinterPreview').innerHTML = SITE.heroImageWinter ? `<img src="${SITE.heroImageWinter}" alt="">` : PLACEHOLDER_ICON;
}
async function handleHeroImageUpload(season, fileList){
  if(!fileList || !fileList.length) return;
  try{
    const blob = await compressImageFile(fileList[0], 1800, 0.85);
    const form = new FormData(); form.append('photo', blob, 'hero.jpg'); form.append('season', season);
    const res = await api('POST', '/api/admin/hero-image/upload', form, true);
    SITE = res.site;
    renderHeroImagePreviews(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}
async function removeHeroImage(season){
  try{
    const res = await api('PUT', '/api/admin/hero-image', {season, url:''});
    SITE = res.site;
    renderHeroImagePreviews(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}

/* -- pricing list ("Cenník") -- */
function renderCennikAdmin(){
  const list = document.getElementById('cennikAdminList'); list.innerHTML = '';
  if(!PRICING_SEASONS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne riadky cenníka.</div>'; return; }
  PRICING_SEASONS.forEach(s=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const topTxt = s.isTop ? ' · TOP sezóna' : '';
    row.innerHTML = `<span><b>${s.name}</b> <span class="meta">— ${s.dateRangeLabel}, ${s.minNights ? 'min '+s.minNights+' nocí, ' : ''}${s.price} €/noc${topTxt}</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/pricing-seasons/${s.id}`); await refreshPublicState(); renderCennikAdmin(); renderPricingAdmin(); renderStayRulesAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addPricingSeason(){
  const name = document.getElementById('adm_seasonName').value.trim();
  const dateRangeLabel = document.getElementById('adm_seasonLabel').value.trim();
  const start = document.getElementById('adm_seasonStart').value;
  const end = document.getElementById('adm_seasonEnd').value;
  const minNights = document.getElementById('adm_seasonMin').value;
  const price = document.getElementById('adm_seasonPrice').value;
  const isTop = document.getElementById('adm_seasonTop').checked;
  if(!name || !start || !end || end<=start || !price) return;
  try{
    await api('POST', '/api/admin/pricing-seasons', {name, dateRangeLabel, start, end, minNights: minNights || null, price, isTop});
    ['adm_seasonName','adm_seasonLabel','adm_seasonStart','adm_seasonEnd','adm_seasonMin','adm_seasonPrice'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('adm_seasonTop').checked = false;
    await refreshPublicState(); renderCennikAdmin(); renderPricingAdmin(); renderStayRulesAdmin();
  }catch(e){ alert(e.message); }
}

/* -- FAQ -- */
function renderFaqAdmin(){
  const list = document.getElementById('faqAdminList'); list.innerHTML = '';
  if(!FAQ.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne otázky.</div>'; return; }
  FAQ.forEach(f=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span><b>${f.question}</b><span class="meta"> — ${f.answer}</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/faq/${f.id}`); await refreshPublicState(); renderFaqAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addFaq(){
  const question = document.getElementById('adm_faqQuestion').value.trim();
  const answer = document.getElementById('adm_faqAnswer').value.trim();
  if(!question || !answer) return;
  try{
    await api('POST', '/api/admin/faq', {question, answer});
    document.getElementById('adm_faqQuestion').value=''; document.getElementById('adm_faqAnswer').value='';
    await refreshPublicState(); renderFaqAdmin();
  }catch(e){ alert(e.message); }
}

/* -- facts (hero strip: fully free-form value/label pairs) -- */
function renderFactsAdmin(){
  const list = document.getElementById('factsAdminList'); list.innerHTML = '';
  if(!FACTS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne fakty.</div>'; return; }
  FACTS.forEach(f=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const valueInput = document.createElement('input');
    valueInput.value = f.value; valueInput.style.cssText = 'width:80px; border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.85rem;';
    const labelInput = document.createElement('input');
    labelInput.value = f.label; labelInput.style.cssText = 'flex:1; min-width:0; border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.85rem;';
    const save = async ()=>{ await api('PATCH', `/api/admin/facts/${f.id}`, {value: valueInput.value.trim(), label: labelInput.value.trim()}); await refreshPublicState(); };
    valueInput.onchange = save; labelInput.onchange = save;
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex; gap:8px; flex:1;';
    wrap.appendChild(valueInput); wrap.appendChild(labelInput);
    row.appendChild(wrap);
    const btn = document.createElement('button'); btn.className = 'small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/facts/${f.id}`); await refreshPublicState(); renderFactsAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addFact(){
  const value = document.getElementById('adm_factValue').value.trim();
  const label = document.getElementById('adm_factLabel').value.trim();
  if(!value || !label) return;
  try{
    await api('POST', '/api/admin/facts', {value, label});
    document.getElementById('adm_factValue').value = ''; document.getElementById('adm_factLabel').value = '';
    await refreshPublicState(); renderFactsAdmin();
  }catch(e){ alert(e.message); }
}

/* -- logo (nav) -- */
function renderLogoPreview(){
  const el = document.getElementById('adm_logoPreview');
  el.innerHTML = SITE.logo ? `<img src="${SITE.logo}" alt="Logo">` : PLACEHOLDER_ICON;
}
async function handleLogoUpload(fileList){
  if(!fileList || !fileList.length) return;
  try{
    const blob = await compressImageFile(fileList[0], 400, 0.9);
    const form = new FormData(); form.append('photo', blob, 'logo.jpg');
    const res = await api('POST', '/api/admin/logo/upload', form, true);
    SITE.logo = res.logo;
    renderLogoPreview(); await refreshPublicState();
  }catch(e){ alert(e.message); }
  document.getElementById('adm_logoFile').value = '';
}
async function removeLogo(){
  try{
    await api('PUT', '/api/admin/logo', {url:''});
    SITE.logo = '';
    renderLogoPreview(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}
async function setLogoUrl(){
  const url = document.getElementById('adm_logoUrl').value.trim();
  if(!url) return;
  try{
    await api('PUT', '/api/admin/logo', {url});
    SITE.logo = url;
    document.getElementById('adm_logoUrl').value = '';
    renderLogoPreview(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}

/* -- highlights ("Prečo práve táto chata" cards) -- */
function renderHighlightsAdmin(){
  const list = document.getElementById('highlightsAdminList'); list.innerHTML = '';
  if(!HIGHLIGHTS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne karty.</div>'; return; }
  HIGHLIGHTS.forEach(h=>{
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid var(--line); border-radius:8px; padding:14px; margin-bottom:12px; display:flex; gap:14px; align-items:flex-start;';

    const preview = document.createElement('div'); preview.className = 'logo-preview';
    preview.innerHTML = h.icon ? `<img src="${h.icon}" alt="">` : PLACEHOLDER_ICON;
    wrap.appendChild(preview);

    const body = document.createElement('div'); body.style.flex = '1';
    const titleInput = document.createElement('input');
    titleInput.value = h.title; titleInput.style.cssText = 'width:100%; border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.9rem; font-weight:600; margin-bottom:6px;';
    titleInput.onchange = async ()=>{ await api('PATCH', `/api/admin/highlights/${h.id}`, {title: titleInput.value.trim()}); await refreshPublicState(); };
    const textInput = document.createElement('textarea');
    textInput.value = h.text; textInput.style.cssText = 'width:100%; border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.85rem; min-height:50px;';
    textInput.onchange = async ()=>{ await api('PATCH', `/api/admin/highlights/${h.id}`, {text: textInput.value.trim()}); await refreshPublicState(); };
    body.appendChild(titleInput); body.appendChild(textInput);

    const actions = document.createElement('div'); actions.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
    const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
    fileInput.onchange = async (e)=>{
      if(!e.target.files.length) return;
      const blob = await compressImageFile(e.target.files[0], 400, 0.9);
      const form = new FormData(); form.append('photo', blob, 'icon.jpg');
      await api('POST', `/api/admin/highlights/${h.id}/upload`, form, true);
      await refreshPublicState(); renderHighlightsAdmin();
    };
    const uploadBtn = document.createElement('button'); uploadBtn.className = 'small-btn'; uploadBtn.textContent = 'Nahrať ikonu';
    uploadBtn.onclick = ()=> fileInput.click();
    const delBtn = document.createElement('button'); delBtn.className = 'small-btn danger'; delBtn.textContent = 'Odstrániť kartu';
    delBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/highlights/${h.id}`); await refreshPublicState(); renderHighlightsAdmin(); };
    actions.appendChild(fileInput); actions.appendChild(uploadBtn); actions.appendChild(delBtn);
    body.appendChild(actions);

    wrap.appendChild(body);
    list.appendChild(wrap);
  });
}
async function addHighlight(){
  const title = document.getElementById('adm_hlTitle').value.trim();
  const text = document.getElementById('adm_hlText').value.trim();
  if(!title || !text) return;
  try{
    await api('POST', '/api/admin/highlights', {title, text});
    document.getElementById('adm_hlTitle').value=''; document.getElementById('adm_hlText').value='';
    await refreshPublicState(); renderHighlightsAdmin();
  }catch(e){ alert(e.message); }
}

/* -- amenities -- */
function renderAmenitiesAdmin(){
  const list = document.getElementById('amenitiesAdminList'); list.innerHTML = '';
  if(!AMENITIES.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne položky.</div>'; return; }
  AMENITIES.forEach(a=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span>${a.text}</span>`;
    const btn = document.createElement('button'); btn.className = 'small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/amenities/${a.id}`); await refreshPublicState(); renderAmenitiesAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addAmenity(){
  const text = document.getElementById('adm_amenityText').value.trim();
  if(!text) return;
  try{
    await api('POST', '/api/admin/amenities', {text});
    document.getElementById('adm_amenityText').value = '';
    await refreshPublicState(); renderAmenitiesAdmin();
  }catch(e){ alert(e.message); }
}

/* -- requests / blocking -- */
function renderRequestsAdmin(){
  const list = document.getElementById('requestsAdminList');
  list.innerHTML = '';
  const requests = ADMIN_BLOCKS.filter(b=>b.ref);
  if(!requests.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne žiadosti.</div>'; return; }
  [...requests].reverse().forEach(b=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const pill = `<span class="status-pill ${b.status}">${b.status==='confirmed' ? 'Potvrdené' : 'Čaká'}</span>`;
    const reviewNote = b.reviewUsed ? ' · recenzia už odoslaná hosťom' : '';
    const voucherNote = b.voucherCode ? ` · kód: ${b.voucherCode}` : '';
    row.innerHTML = `<span><span class="ref-code">${b.ref}</span> — ${fmtShort(b.start)} → ${fmtShort(b.end)} · ${b.guests} ${pill}<span class="meta">${reviewNote}${voucherNote}</span></span>`;
    const btns = document.createElement('div'); btns.className = 'btns';
    if(b.status === 'pending'){
      const okBtn = document.createElement('button'); okBtn.className='small-btn good'; okBtn.textContent='Potvrdiť';
      okBtn.onclick = async ()=>{ await api('PATCH', `/api/admin/blocks/${b.id}`, {status:'confirmed'}); await populateAdminForms(); await refreshPublicState(); };
      btns.appendChild(okBtn);
    }
    const cancelBtn = document.createElement('button'); cancelBtn.className='small-btn danger'; cancelBtn.textContent='Zrušiť';
    cancelBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/blocks/${b.id}`); await populateAdminForms(); await refreshPublicState(); };
    btns.appendChild(cancelBtn);
    row.appendChild(btns);
    list.appendChild(row);
  });
}
function renderBlocksAdmin(){
  const list = document.getElementById('blocksAdminList');
  list.innerHTML = '';
  const manual = ADMIN_BLOCKS.filter(b=>!b.ref);
  if(!manual.length){ list.innerHTML = '<div class="admin-empty">Žiadne ručné blokovania.</div>'; return; }
  manual.forEach(b=>{
    const row = document.createElement('div'); row.className='admin-row';
    row.innerHTML = `<span>${fmtShort(b.start)} → ${fmtShort(b.end)} <span class="meta">— ${b.note||''}</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Uvoľniť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/blocks/${b.id}`); await populateAdminForms(); await refreshPublicState(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addManualBlock(){
  const start = document.getElementById('adm_blockStart').value;
  const end = document.getElementById('adm_blockEnd').value;
  const note = document.getElementById('adm_blockNote').value.trim();
  if(!start || !end || end<=start) return;
  try{
    await api('POST', '/api/admin/blocks', {start, end, note});
    document.getElementById('adm_blockStart').value=''; document.getElementById('adm_blockEnd').value=''; document.getElementById('adm_blockNote').value='';
    await populateAdminForms(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}

/* -- pricing -- */
function renderPricingAdmin(){
  const list = document.getElementById('pricingAdminList'); list.innerHTML = '';
  if(!PRICE_RULES.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne cenové pravidlá — platí základná cena.</div>'; return; }
  PRICE_RULES.forEach(r=>{
    const row = document.createElement('div'); row.className='admin-row';
    row.innerHTML = `<span>${r.label || '(bez popisu)'} <span class="meta">— ${fmtShort(r.start)} → ${fmtShort(r.end)}, ${r.price} €/noc</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/pricing/${r.id}`); await refreshPublicState(); renderPricingAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addPriceRule(){
  const start = document.getElementById('adm_priceStart').value;
  const end = document.getElementById('adm_priceEnd').value;
  const price = parseFloat(document.getElementById('adm_priceValue').value);
  const label = document.getElementById('adm_priceLabel').value.trim();
  if(!start || !end || end<=start || !price) return;
  try{
    await api('POST', '/api/admin/pricing', {start, end, price, label});
    ['adm_priceStart','adm_priceEnd','adm_priceValue','adm_priceLabel'].forEach(i=>document.getElementById(i).value='');
    await refreshPublicState(); renderPricingAdmin();
  }catch(e){ alert(e.message); }
}

/* -- stay length -- */
function renderStayRulesAdmin(){
  const list = document.getElementById('stayRulesAdminList'); list.innerHTML = '';
  if(!STAY_RULES.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne pravidlá — platí predvolený pobyt z Obsahu.</div>'; return; }
  STAY_RULES.forEach(r=>{
    const row = document.createElement('div'); row.className='admin-row';
    const maxTxt = r.maxNights ? `, max ${r.maxNights}` : '';
    row.innerHTML = `<span>${r.label || '(bez popisu)'} <span class="meta">— ${fmtShort(r.start)} → ${fmtShort(r.end)}, min ${r.minNights}${maxTxt} nocí</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/stayrules/${r.id}`); await refreshPublicState(); renderStayRulesAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addStayRule(){
  const start = document.getElementById('adm_stayStart').value;
  const end = document.getElementById('adm_stayEnd').value;
  const minNights = parseInt(document.getElementById('adm_stayMin').value, 10);
  const maxNightsVal = document.getElementById('adm_stayMax').value;
  const maxNights = maxNightsVal ? parseInt(maxNightsVal, 10) : null;
  const label = document.getElementById('adm_stayLabel').value.trim();
  if(!start || !end || end<=start || !minNights) return;
  try{
    await api('POST', '/api/admin/stayrules', {start, end, minNights, maxNights, label});
    ['adm_stayStart','adm_stayEnd','adm_stayMin','adm_stayMax','adm_stayLabel'].forEach(i=>document.getElementById(i).value='');
    await refreshPublicState(); renderStayRulesAdmin();
  }catch(e){ alert(e.message); }
}

/* -- vouchers -- */
function renderVouchersAdmin(){
  const list = document.getElementById('vouchersAdminList'); list.innerHTML = '';
  if(!ADMIN_VOUCHERS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne zľavové kódy.</div>'; return; }
  ADMIN_VOUCHERS.forEach(v=>{
    const row = document.createElement('div'); row.className='admin-row';
    const valueTxt = v.type === 'percent' ? `${v.value}%` : `${v.value} €`;
    const usesTxt = v.maxUses ? `${v.usesCount}/${v.maxUses} použití` : `${v.usesCount}× použité, bez limitu`;
    const expTxt = v.expiresAt ? `, platí do ${fmtShort(v.expiresAt)}` : '';
    row.innerHTML = `<span><span class="ref-code">${v.code}</span> — ${valueTxt} <span class="meta">· ${usesTxt}${expTxt} · ${v.active ? 'aktívny' : 'vypnutý'}</span></span>`;
    const btns = document.createElement('div'); btns.className='btns';
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'small-btn' + (v.active ? '' : ' good'); toggleBtn.textContent = v.active ? 'Vypnúť' : 'Zapnúť';
    toggleBtn.onclick = async ()=>{ await api('PATCH', `/api/admin/vouchers/${v.id}`, {active: !v.active}); ADMIN_VOUCHERS = await api('GET','/api/admin/vouchers'); renderVouchersAdmin(); };
    btns.appendChild(toggleBtn);
    const delBtn = document.createElement('button'); delBtn.className='small-btn danger'; delBtn.textContent='Odstrániť';
    delBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/vouchers/${v.id}`); ADMIN_VOUCHERS = await api('GET','/api/admin/vouchers'); renderVouchersAdmin(); };
    btns.appendChild(delBtn);
    row.appendChild(btns); list.appendChild(row);
  });
}
async function addVoucher(){
  const code = document.getElementById('adm_voucherCode').value.trim();
  const type = document.getElementById('adm_voucherType').value;
  const value = parseFloat(document.getElementById('adm_voucherValue').value);
  const maxUses = document.getElementById('adm_voucherMaxUses').value;
  const expiresAt = document.getElementById('adm_voucherExpires').value;
  if(!code || !value) return;
  try{
    await api('POST', '/api/admin/vouchers', {code, type, value, maxUses: maxUses || null, expiresAt: expiresAt || null});
    ['adm_voucherCode','adm_voucherValue','adm_voucherMaxUses','adm_voucherExpires'].forEach(i=>document.getElementById(i).value='');
    ADMIN_VOUCHERS = await api('GET','/api/admin/vouchers');
    renderVouchersAdmin();
  }catch(e){ alert(e.message); }
}

/* -- gallery -- */
function renderGalleryCategoriesAdmin(){
  const list = document.getElementById('galleryCategoriesAdminList'); list.innerHTML = '';
  const select = document.getElementById('adm_imgCategory');
  select.innerHTML = '<option value="">Bez kategórie</option>' + GALLERY_CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(!GALLERY_CATEGORIES.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne kategórie.</div>'; return; }
  GALLERY_CATEGORIES.forEach(c=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span>${c.name}</span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/gallery-categories/${c.id}`); await refreshPublicState(); renderGalleryCategoriesAdmin(); renderGalleryAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addGalleryCategory(){
  const name = document.getElementById('adm_catName').value.trim();
  if(!name) return;
  try{
    await api('POST', '/api/admin/gallery-categories', {name});
    document.getElementById('adm_catName').value = '';
    await refreshPublicState(); renderGalleryCategoriesAdmin();
  }catch(e){ alert(e.message); }
}
function renderGalleryAdmin(){
  const list = document.getElementById('galleryAdminList'); list.innerHTML = '';
  const note = document.getElementById('galleryStorageNote');
  if(note) note.textContent = `${GALLERY.length} fotiek v galérii. Uložené ako súbory na serveri.`;
  if(!GALLERY.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne fotky.</div>'; return; }
  GALLERY.forEach(g=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const thumbWrap = document.createElement('div'); thumbWrap.className = 'gallery-thumb-row';
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    thumb.style.background = g.url ? `url('${g.url}') center/cover` : (g.tone || '#5B6F5C');
    const capInput = document.createElement('input');
    capInput.value = g.caption || ''; capInput.placeholder = 'Popis';
    capInput.style.cssText = 'border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.85rem;';
    capInput.onchange = async ()=>{ await api('PATCH', `/api/admin/gallery/${g.id}`, {caption: capInput.value.trim()}); refreshPublicState(); };
    const catSelect = document.createElement('select');
    catSelect.style.cssText = 'border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.85rem;';
    catSelect.innerHTML = '<option value="">Bez kategórie</option>' + GALLERY_CATEGORIES.map(c=>`<option value="${c.id}" ${g.category===c.id?'selected':''}>${c.name}</option>`).join('');
    catSelect.onchange = async ()=>{ await api('PATCH', `/api/admin/gallery/${g.id}`, {category: catSelect.value}); await refreshPublicState(); };
    thumbWrap.appendChild(thumb); thumbWrap.appendChild(capInput); thumbWrap.appendChild(catSelect);
    row.appendChild(thumbWrap);
    const btn = document.createElement('button'); btn.className = 'small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/gallery/${g.id}`); await refreshPublicState(); renderGalleryAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addGalleryImage(){
  const url = document.getElementById('adm_imgUrl').value.trim();
  const caption = document.getElementById('adm_imgCap').value.trim();
  const category = document.getElementById('adm_imgCategory').value;
  if(!url) return;
  try{
    await api('POST', '/api/admin/gallery', {url, caption, category});
    document.getElementById('adm_imgUrl').value=''; document.getElementById('adm_imgCap').value='';
    await refreshPublicState(); renderGalleryAdmin();
  }catch(e){ alert(e.message); }
}
function compressImageFile(file, maxDim = 1600, quality = 0.85){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('read failed'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error('decode failed'));
      img.onload = ()=>{
        let {width, height} = img;
        if(width > maxDim || height > maxDim){
          if(width >= height){ height = Math.round(height * (maxDim/width)); width = maxDim; }
          else { width = Math.round(width * (maxDim/height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function handleFileUpload(fileList){
  const files = Array.from(fileList || []).filter(f=>f.type.startsWith('image/'));
  if(!files.length) return;
  const category = document.getElementById('adm_imgCategory').value;
  const progress = document.getElementById('uploadProgress');
  for(let i=0; i<files.length; i++){
    progress.textContent = `Nahrávam fotku ${i+1} z ${files.length}...`;
    try{
      const blob = await compressImageFile(files[i]);
      const form = new FormData();
      form.append('photo', blob, files[i].name.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg');
      form.append('caption', files[i].name.replace(/\.[a-zA-Z0-9]+$/, ''));
      form.append('category', category);
      await api('POST', '/api/admin/gallery/upload', form, true);
    }catch(e){
      progress.textContent = `Fotku ${files[i].name} sa nepodarilo nahrať: ${e.message}`;
      break;
    }
  }
  if(!progress.textContent.includes('nepodarilo')){
    progress.textContent = `Hotovo — nahraných ${files.length} ${files.length===1?'fotka':'fotky'}.`;
  }
  document.getElementById('adm_imgFile').value = '';
  await refreshPublicState(); renderGalleryAdmin();
}
document.addEventListener('DOMContentLoaded', ()=>{
  const zone = document.getElementById('uploadDropzone');
  if(!zone) return;
  ['dragover','dragenter'].forEach(evt=>zone.addEventListener(evt, e=>{ e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(evt=>zone.addEventListener(evt, e=>{ e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e=>{ if(e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files); });
  zone.addEventListener('click', (e)=>{ if(e.target === zone) document.getElementById('adm_imgFile').click(); });
});

/* -- nearby: base fields, image upload/URL, and free-form detail tags -- */
function renderNearbyAdmin(){
  const list = document.getElementById('nearbyAdminList'); list.innerHTML = '';
  if(!NEARBY.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne miesta.</div>'; return; }
  NEARBY.forEach(n=>{
    const wrap = document.createElement('div');
    wrap.style.cssText = 'border:1px solid var(--line); border-radius:8px; padding:14px; margin-bottom:12px;';

    const row = document.createElement('div'); row.className = 'admin-row'; row.style.border = 'none';
    row.innerHTML = `<span>${n.title} <span class="meta">— ${n.distance||''}</span></span>`;
    const delBtn = document.createElement('button'); delBtn.className='small-btn danger'; delBtn.textContent='Odstrániť miesto';
    delBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/nearby/${n.id}`); await refreshPublicState(); renderNearbyAdmin(); };
    row.appendChild(delBtn);
    wrap.appendChild(row);

    // image
    const imgRow = document.createElement('div'); imgRow.className = 'field-row'; imgRow.style.marginTop = '10px';
    const urlField = document.createElement('div'); urlField.className = 'field';
    urlField.innerHTML = `<label>URL obrázka</label><input type="text" value="${n.image||''}" placeholder="https://...">`;
    urlField.querySelector('input').onchange = async (e)=>{ await api('PATCH', `/api/admin/nearby/${n.id}`, {image: e.target.value.trim()}); await refreshPublicState(); };
    const fileField = document.createElement('div'); fileField.className = 'field';
    fileField.innerHTML = `<label>alebo nahrať fotku</label><input type="file" accept="image/*">`;
    fileField.querySelector('input').onchange = async (e)=>{
      if(!e.target.files.length) return;
      const blob = await compressImageFile(e.target.files[0]);
      const form = new FormData(); form.append('photo', blob, 'nearby.jpg');
      await api('POST', `/api/admin/nearby/${n.id}/upload`, form, true);
      await refreshPublicState(); renderNearbyAdmin();
    };
    imgRow.appendChild(urlField); imgRow.appendChild(fileField);
    wrap.appendChild(imgRow);

    // details (label/value tags)
    const detailsTitle = document.createElement('p'); detailsTitle.className = 'tab-intro'; detailsTitle.style.margin = '10px 0 6px';
    detailsTitle.textContent = 'Vlastnosti (napr. dĺžka, náročnosť, prevýšenie):';
    wrap.appendChild(detailsTitle);
    const detailsList = document.createElement('div');
    (n.details||[]).forEach(d=>{
      const tagRow = document.createElement('div'); tagRow.className = 'admin-row'; tagRow.style.border = 'none'; tagRow.style.padding = '4px 0';
      tagRow.innerHTML = `<span class="nearby-detail-tag"><b>${d.label}:</b> ${d.value}</span>`;
      const rmBtn = document.createElement('button'); rmBtn.className = 'small-btn danger'; rmBtn.textContent = '×';
      rmBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/nearby/${n.id}/details/${d.id}`); await refreshPublicState(); renderNearbyAdmin(); };
      tagRow.appendChild(rmBtn);
      detailsList.appendChild(tagRow);
    });
    wrap.appendChild(detailsList);

    const addDetailRow = document.createElement('div'); addDetailRow.className = 'field-row'; addDetailRow.style.marginTop = '6px';
    addDetailRow.innerHTML = `<div class="field"><input type="text" placeholder="Názov, napr. Dĺžka" id="nd_label_${n.id}"></div><div class="field"><input type="text" placeholder="Hodnota, napr. 8 km" id="nd_value_${n.id}"></div>`;
    wrap.appendChild(addDetailRow);
    const addDetailBtn = document.createElement('button'); addDetailBtn.className = 'small-btn'; addDetailBtn.textContent = 'Pridať vlastnosť';
    addDetailBtn.onclick = async ()=>{
      const label = document.getElementById(`nd_label_${n.id}`).value.trim();
      const value = document.getElementById(`nd_value_${n.id}`).value.trim();
      if(!label || !value) return;
      await api('POST', `/api/admin/nearby/${n.id}/details`, {label, value});
      await refreshPublicState(); renderNearbyAdmin();
    };
    wrap.appendChild(addDetailBtn);

    list.appendChild(wrap);
  });
}
async function addNearby(){
  const title = document.getElementById('adm_nearbyTitle').value.trim();
  const distance = document.getElementById('adm_nearbyDist').value.trim();
  const description = document.getElementById('adm_nearbyDesc').value.trim();
  if(!title || !description) return;
  try{
    await api('POST', '/api/admin/nearby', {title, distance, description});
    ['adm_nearbyTitle','adm_nearbyDist','adm_nearbyDesc'].forEach(id=>document.getElementById(id).value='');
    await refreshPublicState(); renderNearbyAdmin();
  }catch(e){ alert(e.message); }
}

/* -- deals -- */
function renderDealsAdmin(){
  const list = document.getElementById('dealsAdminList'); list.innerHTML = '';
  if(!DEALS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne last-minute ponuky.</div>'; return; }
  DEALS.forEach(d=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span>${d.title} <span class="meta">— ${fmtShort(d.start)} → ${fmtShort(d.end)}, -${d.discount}%</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/deals/${d.id}`); await refreshPublicState(); renderDealsAdmin(); renderPricingAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addDeal(){
  const title = document.getElementById('adm_dealTitle').value.trim();
  const start = document.getElementById('adm_dealStart').value;
  const end = document.getElementById('adm_dealEnd').value;
  const discount = parseFloat(document.getElementById('adm_dealDiscount').value) || 0;
  const note = document.getElementById('adm_dealNote').value.trim();
  if(!title || !start || !end || end<=start) return;
  try{
    await api('POST', '/api/admin/deals', {title, start, end, discount, note});
    ['adm_dealTitle','adm_dealStart','adm_dealEnd','adm_dealDiscount','adm_dealNote'].forEach(id=>document.getElementById(id).value='');
    await refreshPublicState(); renderDealsAdmin(); renderPricingAdmin();
  }catch(e){ alert(e.message); }
}

/* -- special offers (multiple, colored, optional CTA) -- */
function renderSpecialOffersAdmin(){
  const list = document.getElementById('specialOffersAdminList'); list.innerHTML = '';
  if(!SPECIAL_OFFERS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne špeciálne ponuky.</div>'; return; }
  SPECIAL_OFFERS.forEach(o=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span>${o.title || '(bez nadpisu)'} <span class="meta">— farba: ${o.color}, tlačidlo: ${o.ctaEnabled !== false ? 'áno' : 'nie'}</span></span>`;
    const btns = document.createElement('div'); btns.className = 'btns';
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'small-btn' + (o.enabled ? '' : ' good'); toggleBtn.textContent = o.enabled ? 'Vypnúť' : 'Zapnúť';
    toggleBtn.onclick = async ()=>{ await api('PATCH', `/api/admin/special-offers/${o.id}`, {enabled: !o.enabled}); await refreshPublicState(); renderSpecialOffersAdmin(); };
    btns.appendChild(toggleBtn);
    const delBtn = document.createElement('button'); delBtn.className='small-btn danger'; delBtn.textContent='Odstrániť';
    delBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/special-offers/${o.id}`); await refreshPublicState(); renderSpecialOffersAdmin(); };
    btns.appendChild(delBtn);
    row.appendChild(btns); list.appendChild(row);
  });
}
async function addSpecialOffer(){
  const title = document.getElementById('adm_specialTitle').value.trim();
  const text = document.getElementById('adm_specialText').value.trim();
  const ctaEnabled = document.getElementById('adm_specialCtaEnabled').checked;
  const ctaLabel = document.getElementById('adm_specialCta').value.trim();
  const color = document.getElementById('adm_specialColor').value;
  if(!title && !text){ document.getElementById('specialSaveMsg').textContent = 'Zadajte aspoň nadpis alebo text.'; return; }
  try{
    await api('POST', '/api/admin/special-offers', {title, text, ctaEnabled, ctaLabel, color});
    ['adm_specialTitle','adm_specialText','adm_specialCta'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('specialSaveMsg').textContent = 'Pridané.';
    await refreshPublicState(); renderSpecialOffersAdmin();
  }catch(e){ document.getElementById('specialSaveMsg').textContent = e.message || 'Chyba.'; }
}

/* -- reviews moderation + manual add (with a custom date) -- */
function renderReviewsAdmin(){
  const list = document.getElementById('reviewsAdminList'); list.innerHTML = '';
  if(!ADMIN_REVIEWS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne recenzie.</div>'; return; }
  [...ADMIN_REVIEWS].reverse().forEach(r=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const pill = `<span class="status-pill ${r.status==='approved'?'confirmed':'pending'}">${r.status==='approved'?'Zverejnené':'Čaká'}</span>`;
    const source = r.source ? ` · ${r.source}` : '';
    const date = new Date(r.createdAt).toLocaleDateString('sk-SK');
    row.innerHTML = `<span>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)} <b>${r.name}</b>${source} · ${date} ${pill}<span class="meta"> — ${r.comment}</span></span>`;
    const btns = document.createElement('div'); btns.className = 'btns';
    if(r.status !== 'approved'){
      const okBtn = document.createElement('button'); okBtn.className='small-btn good'; okBtn.textContent='Schváliť';
      okBtn.onclick = async ()=>{ await api('PATCH', `/api/admin/reviews/${r.id}`, {status:'approved'}); await populateAdminForms(); await refreshPublicState(); };
      btns.appendChild(okBtn);
    }
    const delBtn = document.createElement('button'); delBtn.className='small-btn danger'; delBtn.textContent='Odstrániť';
    delBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/reviews/${r.id}`); await populateAdminForms(); await refreshPublicState(); };
    btns.appendChild(delBtn);
    row.appendChild(btns);
    list.appendChild(row);
  });
}
async function addManualReview(){
  const name = document.getElementById('adm_revName').value.trim();
  const rating = parseInt(document.getElementById('adm_revRating').value, 10);
  const source = document.getElementById('adm_revSource').value.trim();
  const date = document.getElementById('adm_revDate').value;
  const comment = document.getElementById('adm_revComment').value.trim();
  if(!name || !rating || !comment) return;
  try{
    await api('POST', '/api/admin/reviews', {name, rating, source, date, comment});
    ['adm_revName','adm_revSource','adm_revDate','adm_revComment'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('adm_revRating').value = 5;
    await populateAdminForms(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}

/* ---------- boot ---------- */
(async function init(){
  currentPage = parseLocation();
  const now = new Date(); calYear = now.getFullYear(); calMonth = now.getMonth();
  await loadState();
  checkAdminSession();
  render();
})();
