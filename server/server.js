require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'images', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Data store — one JSON file, shared by every visitor.
// ---------------------------------------------------------------------------
const DEFAULT_DATA = {
  site: {
    heroTitle: "Chata pod Belianskymi Tatrami",
    heroTagline: "Zrubová dreveničke priamo v Ždiari, pod končiarmi Belianskych Tatier. Súkromie, pohodlie a výhľad, ktorý si naozaj užijete.",
    aboutText: "Ždiar je rázovitá goralská podtatranská obec s vyše 1300 obyvateľmi, typickými tradíciami, folklórom a povestnou pohostinnosťou. Priamo z terasy chaty uvidíte celý hrebeň s najvyššími štítmi — Ždiarska Vidla (2142 m) a Havran (2152 m). Chata stojí v centre obce, na dosah reštaurácie, potravín, pošty aj bankomatu, a pritom len pár metrov od lesa a lúk plných liečivých bylín, hríbov a kvetov. V lete Vás čaká nespočet turistických chodníkov do Belianskych i Vysokých Tatier a značené cyklotrasy Bikeparku Bachledova dolina, v zime svahy a doliny obľúbené medzi bežkármi, lyžiarmi aj skialpinistami.",
    basePrice: 120,
    maxGuests: 4,
    capacityNote: "Maximálna kapacita 4 osoby — 2 dospelí a 2 deti, alebo 3 dospelí.",
    minNights: 3,
    maxNights: null,
    bookingHorizonDays: 365,
    address: "Ždiar, Belianske Tatry, Slovensko",
    logo: "",
    phone: "+421 900 000 000",
    email: "info@chatapodbelianskymitatrami.sk",
    facebookUrl: "",
    ratingBadgeEnabled: false,
    ratingBadgeScore: "",
    ratingBadgePlatform: "",
    ratingBadgeYear: "",
    heroHelperText: "Zadajte termín — hneď uvidíte, či je chata voľná a koľko presne zaplatíte. Bez zálohy vopred, potvrdenie do 24 hodín.",
    heroImageSummer: "",
    heroImageWinter: ""
  },
  pricingSeasons: [],
  faq: [
    { id: "q1", question: "Koľko osôb sa zmestí?", answer: "Chata je určená pre maximálne 4 osoby — 2 dospelí a 2 deti, alebo 3 dospelí." },
    { id: "q2", question: "Ako sa kúri?", answer: "Chata má krb na drevo a je poriadne izolovaná, takže je útulná aj v zime." },
    { id: "q3", question: "Môžeme prísť so psom?", answer: "Po dohode áno — napíšte nám vopred cez kontaktný formulár." },
    { id: "q4", question: "Ako sa platí?", answer: "Platba prebieha po potvrdení rezervácie, podľa dohody s prevádzkovateľom." },
    { id: "q5", question: "Kedy je príchod a odchod?", answer: "Check-in od 15:00, check-out do 10:00." }
  ],
  highlights: [
    { id: "h1", title: "Krb a útulnosť", text: "Vykurovanie krbom, drevené obklady a poriadna izolácia — príjemne aj uprostred zimy.", icon: "" },
    { id: "h2", title: "Výhľad z terasy", text: "Celý hrebeň Belianskych Tatier priamo z terasy — Ždiarska Vidla aj Havran.", icon: "" },
    { id: "h3", title: "Chodníky za dverami", text: "Turistika, cyklotrasy aj bežky začínajú prakticky pri chate, bez potreby auta.", icon: "" },
    { id: "h4", title: "Centrum obce nablízko", text: "Reštaurácia, obchod, pošta aj bankomat na dosah chôdze — a pritom ticho lesa pár krokov ďalej.", icon: "" }
  ],
  facts: [
    { id: "f1", value: "4", label: "hostia, kapacita chaty" },
    { id: "f2", value: "896 m", label: "nad morom" },
    { id: "f3", value: "3 min", label: "chôdze na turistický chodník" },
    { id: "f4", value: "4.9 / 5", label: "hodnotenie hostí" }
  ],
  amenities: [
    { id: "a1", text: "Krb na drevo" },
    { id: "a2", text: "Terasa s výhľadom na Tatry" },
    { id: "a3", text: "Parkovanie pri chate" },
    { id: "a4", text: "Wifi" },
    { id: "a5", text: "Sušiareň na výstroj" },
    { id: "a6", text: "Súkromie, bez susedov nablízko" }
  ],
  specialOffers: [],
  vouchers: [],
  stayRules: [],
  galleryCategories: [
    { id: "cat_ext", name: "Exteriér" },
    { id: "cat_int", name: "Interiér" },
    { id: "cat_okolie", name: "Okolie" }
  ],
  gallery: [
    { id: "g1", url: "", caption: "Chata v zime", tone: "#4A5D53", category: "cat_ext" },
    { id: "g2", url: "", caption: "Obývačka s krbom", tone: "#8B6A45", category: "cat_int" },
    { id: "g3", url: "", caption: "Terasa s výhľadom na Havran", tone: "#C99A44", category: "cat_ext" },
    { id: "g4", url: "", caption: "Výhľad na Ždiarsku Vidlu", tone: "#5B6F5C", category: "cat_okolie" },
    { id: "g5", url: "", caption: "Spálňa v podkroví", tone: "#6B4F32", category: "cat_int" }
  ],
  customPages: [
    { id: "page_privacy", slug: "ochrana-osobnych-udajov", navLabel: "Ochrana osobných údajov", title: "Ochrana osobných údajov", content: "Tu doplňte informácie o ochrane osobných údajov podľa vašej prevádzky." },
    { id: "page_cookies", slug: "cookies", navLabel: "Cookies", title: "Cookies", content: "Tu doplňte informácie o používaní cookies na tomto webe." },
    { id: "page_terms", slug: "podmienky-ubytovania", navLabel: "Podmienky ubytovania", title: "Podmienky ubytovania", content: "Tu doplňte podmienky ubytovania, storno podmienky a pravidlá pobytu." }
  ],
  sectionVisibility: {
    quickCheck: true, highlights: true, about: true, lastMinute: true,
    specialOffers: true, reviewsTeaser: true,
    pageGallery: true, pageNearby: true, pageFaq: true, pageReviews: true
  },
  deals: [],
  pricing: [],
  nearby: [
    { id: "n1", title: "Bikepark Bachledova dolina", distance: "10 min autom", image: "",
      description: "Značené cyklotrasy a v zime lyžiarske stredisko s bobovou dráhou a snow tubingom, priamo v susednej doline.",
      details: [{ label: "Dĺžka", value: "8 km" }, { label: "Náročnosť", value: "stredná" }] },
    { id: "n2", title: "Turistika do Belianskych a Vysokých Tatier", distance: "priamo od chaty", image: "",
      description: "Nespočetné množstvo značených chodníkov začína priamo v Ždiari, smerom do oboch pohorí.",
      details: [{ label: "Dĺžka", value: "12 km" }, { label: "Náročnosť", value: "stredná" }, { label: "Prevýšenie", value: "650 m" }] },
    { id: "n3", title: "Bežkárske trate a skialpinizmus", distance: "v okolí Ždiaru", image: "",
      description: "Svahy a doliny Belianskych Tatier a Spišskej Magury sú v zime rajom bežkárov, lyžiarov aj skialpinistov.",
      details: [] },
    { id: "n4", title: "Poľské strediská Jurgów a Białka Tatrzańska", distance: "~10 km", image: "",
      description: "Kvalitné lyžiarske strediská tesne za hranicou v Poľsku, obľúbený polodňový výlet.",
      details: [] },
    { id: "n5", title: "Belianska jaskyňa", distance: "15 min autom", image: "",
      description: "Sprístupnená kvapľová jaskyňa v Tatranskej Kotline, jedna z mála otvorená aj cez zimu.",
      details: [] },
    { id: "n6", title: "Cyklotrasa do Spišskej Belej", distance: "od chaty", image: "",
      description: "Príjemná rovinatá cyklotrasa smerom do podtatranských dedín a mestečiek.",
      details: [{ label: "Dĺžka", value: "6 km" }, { label: "Náročnosť", value: "ľahká" }] }
  ],
  blocks: [],
  reviews: []
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return migrateData(data);
  } catch (e) {
    console.error('data.json is corrupted, resetting to defaults:', e);
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}
// Fills in any fields that didn't exist yet in an older data.json, so upgrading
// this project's code never breaks an already-running site's saved data.
function migrateData(data) {
  data.site = { ...DEFAULT_DATA.site, ...data.site };
  data.amenities = data.amenities || DEFAULT_DATA.amenities;
  data.vouchers = data.vouchers || [];
  data.stayRules = data.stayRules || [];
  data.nearby = (data.nearby || []).map(n => ({ image: '', details: [], ...n }));
  data.highlights = (data.highlights && data.highlights.length) ? data.highlights : DEFAULT_DATA.highlights;
  data.pricingSeasons = data.pricingSeasons || [];
  data.faq = (data.faq && data.faq.length) ? data.faq : DEFAULT_DATA.faq;
  data.galleryCategories = (data.galleryCategories && data.galleryCategories.length) ? data.galleryCategories : DEFAULT_DATA.galleryCategories;
  data.gallery = (data.gallery || []).map(g => ({ category: '', ...g }));
  if (!data.customPages) {
    if (data.legal) {
      // Older versions had exactly three fixed legal pages — carry over any
      // real content into the new, freely addable/removable pages list.
      data.customPages = [
        { id: 'page_privacy', slug: 'ochrana-osobnych-udajov', navLabel: data.legal.privacy?.title || 'Ochrana osobných údajov', title: data.legal.privacy?.title || 'Ochrana osobných údajov', content: data.legal.privacy?.content || '' },
        { id: 'page_cookies', slug: 'cookies', navLabel: data.legal.cookies?.title || 'Cookies', title: data.legal.cookies?.title || 'Cookies', content: data.legal.cookies?.content || '' },
        { id: 'page_terms', slug: 'podmienky-ubytovania', navLabel: data.legal.terms?.title || 'Podmienky ubytovania', title: data.legal.terms?.title || 'Podmienky ubytovania', content: data.legal.terms?.content || '' }
      ];
    } else {
      data.customPages = JSON.parse(JSON.stringify(DEFAULT_DATA.customPages));
    }
  }
  delete data.legal;
  data.sectionVisibility = { ...DEFAULT_DATA.sectionVisibility, ...(data.sectionVisibility || {}) };
  // Older versions had fixed altitude/trailTime fields on site — fold any
  // real values into the new free-form facts list, then drop them from site.
  if (!data.facts) {
    data.facts = JSON.parse(JSON.stringify(DEFAULT_DATA.facts));
    if (data.site.altitude) data.facts[1] = { id: 'f2', value: data.site.altitude, label: 'nad morom' };
    if (data.site.trailTime) data.facts[2] = { id: 'f3', value: data.site.trailTime, label: 'chôdze na turistický chodník' };
  }
  delete data.site.altitude;
  delete data.site.trailTime;
  // Older versions had a single `specialOffer` object instead of an array —
  // carry any real content over into the new array format automatically.
  if (!data.specialOffers) {
    const old = data.specialOffer;
    data.specialOffers = (old && old.enabled && (old.title || old.text))
      ? [{ id: 'so_migrated', enabled: true, title: old.title, text: old.text, ctaEnabled: true, ctaLabel: old.ctaLabel || 'Rezervovať', color: 'amber' }]
      : [];
  }
  delete data.specialOffer;
  delete data.newsletter;
  return data;
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// ---------------------------------------------------------------------------
// Date / pricing helpers
// ---------------------------------------------------------------------------
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getBlockForDate(blocks, iso) { return blocks.find(b => iso >= b.start && iso < b.end); }
function isRangeFree(blocks, startISO, endISO) {
  let d = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');
  while (d < end) { if (getBlockForDate(blocks, toISO(d))) return false; d.setDate(d.getDate() + 1); }
  return true;
}
function getNightPrice(pricing, basePrice, iso) {
  for (let i = pricing.length - 1; i >= 0; i--) { const r = pricing[i]; if (iso >= r.start && iso < r.end) return r.price; }
  return basePrice;
}
function calcTotal(pricing, basePrice, startISO, endISO) {
  let d = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');
  let total = 0;
  while (d < end) { total += getNightPrice(pricing, basePrice, toISO(d)); d.setDate(d.getDate() + 1); }
  return total;
}
function genRef() { return 'REZ-' + Math.floor(1000 + Math.random() * 9000); }
function getStayRuleForDate(stayRules, iso) {
  for (let i = stayRules.length - 1; i >= 0; i--) { const r = stayRules[i]; if (iso >= r.start && iso < r.end) return r; }
  return null;
}
function getMinMaxNights(data, startISO) {
  const rule = getStayRuleForDate(data.stayRules, startISO);
  return {
    min: (rule && rule.minNights) || data.site.minNights || 1,
    max: (rule && rule.maxNights) || data.site.maxNights || null
  };
}
function findValidVoucher(vouchers, code) {
  const v = vouchers.find(x => x.code === (code || '').trim().toUpperCase());
  if (!v) return { error: 'Tento zľavový kód sme nenašli.' };
  if (!v.active) return { error: 'Tento zľavový kód už nie je aktívny.' };
  if (v.expiresAt && toISO(new Date()) > v.expiresAt) return { error: 'Platnosť tohto zľavového kódu už uplynula.' };
  if (v.maxUses && v.usesCount >= v.maxUses) return { error: 'Tento zľavový kód už bol vyčerpaný.' };
  return { voucher: v };
}
function applyVoucherToTotal(total, voucher) {
  if (voucher.type === 'percent') return Math.max(0, Math.round(total * (1 - voucher.value / 100)));
  return Math.max(0, Math.round(total - voucher.value));
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
const emailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  && !process.env.SMTP_USER.includes('youraddress') && !process.env.SMTP_PASS.includes('your16digit'));
const transporter = emailConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
}) : null;

async function sendMail(subject, text, to) {
  if (!emailConfigured) {
    console.log('--- EMAIL NOT SENT (SMTP not configured in .env) ---');
    console.log('To:', to || process.env.MAIL_TO);
    console.log('Subject:', subject);
    console.log(text);
    console.log('-----------------------------------------------------');
    return false;
  }
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: to || process.env.MAIL_TO || process.env.SMTP_USER, subject, text });
    return true;
  } catch (e) { console.error('Failed to send email:', e.message); return false; }
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 4 * 60 * 60 * 1000, sameSite: 'lax' }
  // cookie.secure: true  <-- uncomment once the site runs behind HTTPS in production
}));
app.use(express.static(PUBLIC_DIR));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Nie ste prihlásený ako správca.' });
}

// Shared image-upload handler for logo, hero backgrounds, gallery, and
// nearby-place photos — defined early since several endpoints below use it.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------
app.get('/api/state', (req, res) => {
  const data = loadData();
  res.json({
    site: data.site,
    amenities: data.amenities,
    facts: data.facts,
    highlights: data.highlights,
    pricingSeasons: data.pricingSeasons,
    faq: data.faq,
    galleryCategories: data.galleryCategories,
    customPages: data.customPages,
    sectionVisibility: data.sectionVisibility,
    specialOffers: data.specialOffers.filter(o => o.enabled && (o.title || o.text)),
    gallery: data.gallery,
    deals: data.deals,
    pricing: data.pricing,
    nearby: data.nearby,
    stayRules: data.stayRules,
    blocks: data.blocks.map(b => ({ start: b.start, end: b.end, status: b.status })),
    reviews: data.reviews
      .filter(r => r.status === 'approved')
      .map(({ id, name, rating, comment, source, createdAt }) => ({ id, name, rating, comment, source, createdAt }))
  });
});

app.post('/api/vouchers/validate', (req, res) => {
  const data = loadData();
  const { voucher, error } = findValidVoucher(data.vouchers, req.body.code);
  if (error) return res.status(404).json({ error });
  res.json({ ok: true, type: voucher.type, value: voucher.value });
});

app.post('/api/reservations', async (req, res) => {
  const { name, email, phone, guests, start, end, msg, voucherCode } = req.body;
  if (!name || !email || !start || !end || end <= start) {
    return res.status(400).json({ error: 'Chýbajú povinné údaje alebo neplatný termín.' });
  }
  const data = loadData();
  if (!isRangeFree(data.blocks, start, end)) return res.status(409).json({ error: 'Tento termín je už obsadený.' });

  const todayStr = toISO(new Date());
  const horizonDate = new Date(); horizonDate.setDate(horizonDate.getDate() + (data.site.bookingHorizonDays || 365));
  if (start < todayStr) return res.status(400).json({ error: 'Dátum príchodu už uplynul.' });
  if (start > toISO(horizonDate)) {
    return res.status(400).json({ error: `Rezervácie je momentálne možné vytvoriť najviac ${data.site.bookingHorizonDays} dní vopred.` });
  }

  const nights = Math.round((new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / 86400000);
  const { min, max } = getMinMaxNights(data, start);
  if (nights < min) return res.status(400).json({ error: `Minimálny počet nocí pre tento termín je ${min}.` });
  if (max && nights > max) return res.status(400).json({ error: `Maximálny počet nocí pre tento termín je ${max}.` });

  let total = calcTotal(data.pricing, data.site.basePrice, start, end);
  let appliedVoucher = null;
  if (voucherCode) {
    const { voucher, error } = findValidVoucher(data.vouchers, voucherCode);
    if (error) return res.status(400).json({ error });
    total = applyVoucherToTotal(total, voucher);
    voucher.usesCount = (voucher.usesCount || 0) + 1;
    appliedVoucher = voucher.code;
  }

  const ref = genRef();
  // Nothing personal is stored here — only the dates, status and reference code.
  data.blocks.push({
    id: 'r_' + Date.now(), start, end, status: 'pending', ref, guests, note: 'Nová žiadosť', reviewUsed: false,
    voucherCode: appliedVoucher
  });
  saveData(data);

  const reviewUrl = `${SITE_URL}/recenzie`;
  const voucherLine = appliedVoucher ? `\nPoužitý zľavový kód: ${appliedVoucher}` : '';
  const emailOk = await sendMail(
    `Nová žiadosť o rezerváciu — ${ref}`,
    `Kód rezervácie: ${ref}\nMeno: ${name}\nE-mail: ${email}\nTelefón: ${phone || '—'}\nPočet hostí: ${guests}\nTermín: ${start} – ${end}\nCena: ${total} €${voucherLine}\nOdkaz hosťa: ${msg || '—'}\n\nPotvrďte alebo zrušte v admin paneli webu.\n\nAž hosť odíde, môžete mu poslať tento odkaz na recenziu spolu s jeho kódom rezervácie (${ref}):\n${reviewUrl}`
  );
  res.json({ ok: true, ref, total, emailSent: emailOk });
});

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Vyplňte prosím všetky polia.' });
  const emailOk = await sendMail(`Správa z webu od ${name}`, `Meno: ${name}\nE-mail: ${email}\n\n${message}`);
  res.json({ ok: true, emailSent: emailOk });
});

// ---------------------------------------------------------------------------
// Reviews — verified by reservation reference code, not a stored email/token.
// ---------------------------------------------------------------------------
app.post('/api/reviews', (req, res) => {
  const { ref, name, rating, comment } = req.body;
  const stars = Number(rating);
  if (!ref || !name || !stars || stars < 1 || stars > 5 || !comment) {
    return res.status(400).json({ error: 'Vyplňte prosím kód rezervácie, meno, hodnotenie a text recenzie.' });
  }
  const data = loadData();
  const block = data.blocks.find(b => b.ref === ref.trim().toUpperCase());
  if (!block) return res.status(404).json({ error: 'Tento kód rezervácie sme nenašli.' });
  if (block.status !== 'confirmed') return res.status(403).json({ error: 'Táto rezervácia ešte nebola potvrdená, recenziu zatiaľ nie je možné pridať.' });
  if (block.reviewUsed) return res.status(410).json({ error: 'Pre túto rezerváciu už bola recenzia odoslaná.' });

  data.reviews.push({ id: 'rev_' + Date.now(), name, rating: stars, comment, status: 'pending', createdAt: new Date().toISOString() });
  block.reviewUsed = true;
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ error: 'Heslo správcu nie je nastavené na serveri (pozri README).' });
  if (!password || !bcrypt.compareSync(password, hash)) return res.status(401).json({ error: 'Nesprávne heslo.' });
  req.session.isAdmin = true;
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });
app.get('/api/admin/check', (req, res) => { res.json({ isAdmin: !!(req.session && req.session.isAdmin) }); });

// ---------------------------------------------------------------------------
// Admin: content
// ---------------------------------------------------------------------------
app.put('/api/admin/content', requireAdmin, (req, res) => {
  const data = loadData();
  const { heroTitle, heroTagline, aboutText, basePrice, maxGuests, capacityNote, minNights, maxNights, bookingHorizonDays, address, phone, heroHelperText, email, facebookUrl, ratingBadgeEnabled, ratingBadgeScore, ratingBadgePlatform, ratingBadgeYear } = req.body;
  data.site = {
    ...data.site,
    heroTitle: heroTitle ?? data.site.heroTitle,
    heroTagline: heroTagline ?? data.site.heroTagline,
    aboutText: aboutText ?? data.site.aboutText,
    basePrice: Number(basePrice) || data.site.basePrice,
    maxGuests: Number(maxGuests) || data.site.maxGuests,
    capacityNote: capacityNote ?? data.site.capacityNote,
    minNights: Number(minNights) || data.site.minNights || 1,
    maxNights: maxNights ? Number(maxNights) : null,
    bookingHorizonDays: Number(bookingHorizonDays) || data.site.bookingHorizonDays || 365,
    address: address ?? data.site.address,
    phone: phone ?? data.site.phone,
    heroHelperText: heroHelperText ?? data.site.heroHelperText,
    email: email ?? data.site.email,
    facebookUrl: facebookUrl ?? data.site.facebookUrl,
    ratingBadgeEnabled: ratingBadgeEnabled !== undefined ? !!ratingBadgeEnabled : data.site.ratingBadgeEnabled,
    ratingBadgeScore: ratingBadgeScore ?? data.site.ratingBadgeScore,
    ratingBadgePlatform: ratingBadgePlatform ?? data.site.ratingBadgePlatform,
    ratingBadgeYear: ratingBadgeYear ?? data.site.ratingBadgeYear
  };
  saveData(data);
  res.json({ ok: true, site: data.site });
});

// ---------------------------------------------------------------------------
// Admin: hero background photo — one for summer, one for winter (the site
// falls back to the illustrated placeholder when neither is set)
// ---------------------------------------------------------------------------
app.put('/api/admin/hero-image', requireAdmin, (req, res) => {
  const { season, url } = req.body;
  if (!['summer', 'winter'].includes(season)) return res.status(400).json({ error: 'Neplatná sezóna.' });
  const data = loadData();
  data.site[season === 'summer' ? 'heroImageSummer' : 'heroImageWinter'] = url || '';
  saveData(data);
  res.json({ ok: true, site: data.site });
});
app.post('/api/admin/hero-image/upload', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Žiadny súbor.' });
  const season = req.body.season;
  if (!['summer', 'winter'].includes(season)) return res.status(400).json({ error: 'Neplatná sezóna.' });
  const data = loadData();
  const field = season === 'summer' ? 'heroImageSummer' : 'heroImageWinter';
  if (data.site[field] && data.site[field].startsWith('/images/uploads/')) fs.unlink(path.join(PUBLIC_DIR, data.site[field]), () => {});
  data.site[field] = `/images/uploads/${req.file.filename}`;
  saveData(data);
  res.json({ ok: true, site: data.site });
});

// ---------------------------------------------------------------------------
// Admin: facts strip under the hero — fully free-form value/label pairs,
// e.g. "4" / "hostia, kapacita chaty", or anything else you want to show.
// ---------------------------------------------------------------------------
app.post('/api/admin/facts', requireAdmin, (req, res) => {
  const { value, label } = req.body;
  if (!value || !label) return res.status(400).json({ error: 'Vyplňte hodnotu aj popis.' });
  const data = loadData();
  const fact = { id: 'f_' + Date.now(), value, label };
  data.facts.push(fact);
  saveData(data);
  res.json({ ok: true, fact });
});
app.patch('/api/admin/facts/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const fact = data.facts.find(f => f.id === req.params.id);
  if (!fact) return res.status(404).json({ error: 'Nenájdené.' });
  const { value, label } = req.body;
  if (value !== undefined) fact.value = value;
  if (label !== undefined) fact.label = label;
  saveData(data);
  res.json({ ok: true, fact });
});
app.delete('/api/admin/facts/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.facts = data.facts.filter(f => f.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: amenities (the "O chate" feature list)
// ---------------------------------------------------------------------------
app.post('/api/admin/amenities', requireAdmin, (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Chýba text.' });
  const data = loadData();
  const item = { id: 'a_' + Date.now(), text };
  data.amenities.push(item);
  saveData(data);
  res.json({ ok: true, item });
});
app.delete('/api/admin/amenities/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.amenities = data.amenities.filter(a => a.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: special offers — free-form promotional callouts, each with its own
// color, independent of the date/discount-based last-minute deals.
// ---------------------------------------------------------------------------
app.post('/api/admin/special-offers', requireAdmin, (req, res) => {
  const { title, text, ctaEnabled, ctaLabel, color } = req.body;
  if (!title && !text) return res.status(400).json({ error: 'Zadajte aspoň nadpis alebo text.' });
  const data = loadData();
  const offer = {
    id: 'so_' + Date.now(), enabled: true,
    title: title || '', text: text || '',
    ctaEnabled: ctaEnabled !== false, ctaLabel: ctaLabel || 'Rezervovať',
    color: color || 'amber'
  };
  data.specialOffers.push(offer);
  saveData(data);
  res.json({ ok: true, offer });
});
app.patch('/api/admin/special-offers/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const offer = data.specialOffers.find(o => o.id === req.params.id);
  if (!offer) return res.status(404).json({ error: 'Nenájdené.' });
  Object.assign(offer, req.body);
  saveData(data);
  res.json({ ok: true, offer });
});
app.delete('/api/admin/special-offers/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.specialOffers = data.specialOffers.filter(o => o.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: voucher / discount codes
// ---------------------------------------------------------------------------
app.get('/api/admin/vouchers', requireAdmin, (req, res) => { res.json(loadData().vouchers); });
app.post('/api/admin/vouchers', requireAdmin, (req, res) => {
  const { code, type, value, maxUses, expiresAt } = req.body;
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode || !['amount', 'percent'].includes(type) || !value) return res.status(400).json({ error: 'Vyplňte kód, typ a hodnotu zľavy.' });
  const data = loadData();
  if (data.vouchers.some(v => v.code === cleanCode)) return res.status(409).json({ error: 'Tento kód už existuje.' });
  const voucher = {
    id: 'v_' + Date.now(), code: cleanCode, type, value: Number(value),
    maxUses: maxUses ? Number(maxUses) : 0, usesCount: 0,
    expiresAt: expiresAt || null, active: true
  };
  data.vouchers.push(voucher);
  saveData(data);
  res.json({ ok: true, voucher });
});
app.patch('/api/admin/vouchers/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const voucher = data.vouchers.find(v => v.id === req.params.id);
  if (!voucher) return res.status(404).json({ error: 'Nenájdené.' });
  if (typeof req.body.active === 'boolean') voucher.active = req.body.active;
  saveData(data);
  res.json({ ok: true, voucher });
});
app.delete('/api/admin/vouchers/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.vouchers = data.vouchers.filter(v => v.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: blocks (reservation requests + manual blocking)
// ---------------------------------------------------------------------------
app.get('/api/admin/blocks', requireAdmin, (req, res) => { res.json(loadData().blocks); });
app.post('/api/admin/blocks', requireAdmin, (req, res) => {
  const { start, end, note } = req.body;
  if (!start || !end || end <= start) return res.status(400).json({ error: 'Neplatný rozsah dátumov.' });
  const data = loadData();
  const block = { id: 'blk_' + Date.now(), start, end, status: 'blocked', note: note || '' };
  data.blocks.push(block);
  saveData(data);
  res.json({ ok: true, block });
});
app.patch('/api/admin/blocks/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const block = data.blocks.find(b => b.id === req.params.id);
  if (!block) return res.status(404).json({ error: 'Nenájdené.' });
  if (req.body.status) block.status = req.body.status;
  saveData(data);
  res.json({ ok: true, block });
});
app.delete('/api/admin/blocks/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.blocks = data.blocks.filter(b => b.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: gallery
// ---------------------------------------------------------------------------
app.post('/api/admin/gallery', requireAdmin, (req, res) => {
  const { url, caption, category } = req.body;
  if (!url) return res.status(400).json({ error: 'Chýba URL obrázka.' });
  const data = loadData();
  const item = { id: 'g_' + Date.now(), url, caption: caption || '', category: category || '' };
  data.gallery.push(item);
  saveData(data);
  res.json({ ok: true, item });
});
app.patch('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.gallery.find(g => g.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  if (typeof req.body.caption === 'string') item.caption = req.body.caption;
  if (typeof req.body.category === 'string') item.category = req.body.category;
  saveData(data);
  res.json({ ok: true, item });
});
app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.gallery.find(g => g.id === req.params.id);
  if (item && item.url && item.url.startsWith('/images/uploads/')) fs.unlink(path.join(PUBLIC_DIR, item.url), () => {});
  data.gallery = data.gallery.filter(g => g.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

app.post('/api/admin/gallery/upload', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Žiadny súbor.' });
  const data = loadData();
  const baseName = req.file.originalname.replace(/\.[a-zA-Z0-9]+$/, '');
  const item = { id: 'g_' + Date.now(), url: `/images/uploads/${req.file.filename}`, caption: req.body.caption || baseName, category: req.body.category || '' };
  data.gallery.push(item);
  saveData(data);
  res.json({ ok: true, item });
});

// ---------------------------------------------------------------------------
// Admin: gallery categories (e.g. Exteriér / Interiér / Okolie)
// ---------------------------------------------------------------------------
app.post('/api/admin/gallery-categories', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Chýba názov kategórie.' });
  const data = loadData();
  const cat = { id: 'cat_' + Date.now(), name };
  data.galleryCategories.push(cat);
  saveData(data);
  res.json({ ok: true, category: cat });
});
app.delete('/api/admin/gallery-categories/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.galleryCategories = data.galleryCategories.filter(c => c.id !== req.params.id);
  data.gallery.forEach(g => { if (g.category === req.params.id) g.category = ''; });
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: site logo (shown in the nav) — a placeholder is used until one is set
// ---------------------------------------------------------------------------
app.put('/api/admin/logo', requireAdmin, (req, res) => {
  const data = loadData();
  data.site.logo = req.body.url || '';
  saveData(data);
  res.json({ ok: true, logo: data.site.logo });
});
app.post('/api/admin/logo/upload', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Žiadny súbor.' });
  const data = loadData();
  if (data.site.logo && data.site.logo.startsWith('/images/uploads/')) fs.unlink(path.join(PUBLIC_DIR, data.site.logo), () => {});
  data.site.logo = `/images/uploads/${req.file.filename}`;
  saveData(data);
  res.json({ ok: true, logo: data.site.logo });
});

// ---------------------------------------------------------------------------
// Admin: "why this cottage" highlight cards — title, text, and an optional
// icon image (a placeholder is used until one is set)
// ---------------------------------------------------------------------------
app.post('/api/admin/highlights', requireAdmin, (req, res) => {
  const { title, text } = req.body;
  if (!title || !text) return res.status(400).json({ error: 'Vyplňte nadpis aj text.' });
  const data = loadData();
  const item = { id: 'h_' + Date.now(), title, text, icon: '' };
  data.highlights.push(item);
  saveData(data);
  res.json({ ok: true, item });
});
app.patch('/api/admin/highlights/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.highlights.find(h => h.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  const { title, text, icon } = req.body;
  if (title !== undefined) item.title = title;
  if (text !== undefined) item.text = text;
  if (icon !== undefined) item.icon = icon;
  saveData(data);
  res.json({ ok: true, item });
});
app.delete('/api/admin/highlights/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.highlights.find(h => h.id === req.params.id);
  if (item && item.icon && item.icon.startsWith('/images/uploads/')) fs.unlink(path.join(PUBLIC_DIR, item.icon), () => {});
  data.highlights = data.highlights.filter(h => h.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});
app.post('/api/admin/highlights/:id/upload', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Žiadny súbor.' });
  const data = loadData();
  const item = data.highlights.find(h => h.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  item.icon = `/images/uploads/${req.file.filename}`;
  saveData(data);
  res.json({ ok: true, item });
});

// ---------------------------------------------------------------------------
// Admin: last-minute deals — creates a matching price rule automatically,
// AND lifts the minimum-stay requirement for that window to 1 night. Without
// this, a leftover gap shorter than your usual minimum stay (e.g. a 3-night
// gap when your minimum is 5) could never actually be booked even with a
// discount attached to it.
// ---------------------------------------------------------------------------
app.post('/api/admin/deals', requireAdmin, (req, res) => {
  const { title, start, end, discount, note } = req.body;
  if (!title || !start || !end || end <= start) return res.status(400).json({ error: 'Neplatné údaje.' });
  const data = loadData();
  const dealId = 'd_' + Date.now();
  const deal = { id: dealId, title, start, end, discount: Number(discount) || 0, note: note || '' };
  data.deals.push(deal);
  data.pricing.push({ id: 'deal_' + dealId, start, end, price: Math.round(data.site.basePrice * (1 - (Number(discount) || 0) / 100)), label: title });
  data.stayRules.push({ id: 'dealstay_' + dealId, start, end, minNights: 1, maxNights: null, label: title + ' (last minute)' });
  saveData(data);
  res.json({ ok: true, deal });
});
app.delete('/api/admin/deals/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.deals = data.deals.filter(d => d.id !== req.params.id);
  data.pricing = data.pricing.filter(p => p.id !== 'deal_' + req.params.id);
  data.stayRules = data.stayRules.filter(r => r.id !== 'dealstay_' + req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: seasonal pricing rules
// ---------------------------------------------------------------------------
app.post('/api/admin/pricing', requireAdmin, (req, res) => {
  const { start, end, price, label } = req.body;
  if (!start || !end || end <= start || !price) return res.status(400).json({ error: 'Neplatné údaje.' });
  const data = loadData();
  const rule = { id: 'pr_' + Date.now(), start, end, price: Number(price), label: label || '' };
  data.pricing.push(rule);
  saveData(data);
  res.json({ ok: true, rule });
});
app.delete('/api/admin/pricing/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.pricing = data.pricing.filter(p => p.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: minimum/maximum stay-length rules for specific date ranges
// (the site-wide default lives in site.minNights / site.maxNights)
// ---------------------------------------------------------------------------
app.post('/api/admin/stayrules', requireAdmin, (req, res) => {
  const { start, end, minNights, maxNights, label } = req.body;
  if (!start || !end || end <= start || !minNights) return res.status(400).json({ error: 'Neplatné údaje.' });
  const data = loadData();
  const rule = { id: 'stay_' + Date.now(), start, end, minNights: Number(minNights), maxNights: maxNights ? Number(maxNights) : null, label: label || '' };
  data.stayRules.push(rule);
  saveData(data);
  res.json({ ok: true, rule });
});
app.delete('/api/admin/stayrules/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.stayRules = data.stayRules.filter(r => r.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: pricing-list ("Cenník") seasons — a guest-facing table, but each row
// also creates a real price rule and stay-length rule behind the scenes, so
// what's shown on the Cenník page always matches what the calendar actually
// charges and allows. Deleting a row removes its linked rules too.
// ---------------------------------------------------------------------------
app.post('/api/admin/pricing-seasons', requireAdmin, (req, res) => {
  const { name, dateRangeLabel, start, end, minNights, price, isTop } = req.body;
  if (!name || !start || !end || end <= start || !price) return res.status(400).json({ error: 'Vyplňte názov, termín a cenu.' });
  const data = loadData();
  const seasonId = 'season_' + Date.now();
  const season = {
    id: seasonId, name, dateRangeLabel: dateRangeLabel || `${start} – ${end}`,
    start, end, minNights: minNights ? Number(minNights) : null, price: Number(price), isTop: !!isTop
  };
  data.pricingSeasons.push(season);
  data.pricing.push({ id: 'seasonprice_' + seasonId, start, end, price: Number(price), label: name });
  if (season.minNights) {
    data.stayRules.push({ id: 'seasonstay_' + seasonId, start, end, minNights: season.minNights, maxNights: null, label: name });
  }
  saveData(data);
  res.json({ ok: true, season });
});
app.patch('/api/admin/pricing-seasons/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const season = data.pricingSeasons.find(s => s.id === req.params.id);
  if (!season) return res.status(404).json({ error: 'Nenájdené.' });
  const { name, dateRangeLabel, isTop } = req.body;
  if (name !== undefined) season.name = name;
  if (dateRangeLabel !== undefined) season.dateRangeLabel = dateRangeLabel;
  if (isTop !== undefined) season.isTop = !!isTop;
  saveData(data);
  res.json({ ok: true, season });
});
app.delete('/api/admin/pricing-seasons/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.pricingSeasons = data.pricingSeasons.filter(s => s.id !== req.params.id);
  data.pricing = data.pricing.filter(p => p.id !== 'seasonprice_' + req.params.id);
  data.stayRules = data.stayRules.filter(r => r.id !== 'seasonstay_' + req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: FAQ ("Než sa spýtate")
// ---------------------------------------------------------------------------
app.post('/api/admin/faq', requireAdmin, (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Vyplňte otázku aj odpoveď.' });
  const data = loadData();
  const item = { id: 'q_' + Date.now(), question, answer };
  data.faq.push(item);
  saveData(data);
  res.json({ ok: true, item });
});
app.patch('/api/admin/faq/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.faq.find(f => f.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  const { question, answer } = req.body;
  if (question !== undefined) item.question = question;
  if (answer !== undefined) item.answer = answer;
  saveData(data);
  res.json({ ok: true, item });
});
app.delete('/api/admin/faq/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.faq = data.faq.filter(f => f.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: legal pages (Ochrana osobných údajov / Cookies / Podmienky ubytovania)
// ---------------------------------------------------------------------------
function slugify(text) {
  const map = { á:'a', ä:'a', č:'c', ď:'d', é:'e', í:'i', ĺ:'l', ľ:'l', ň:'n', ó:'o', ô:'o', ŕ:'r', š:'s', ť:'t', ú:'u', ý:'y', ž:'z' };
  return text.toLowerCase().split('').map(ch => map[ch] || ch).join('')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-') || 'stranka';
}
function uniqueSlug(base, data, excludeId) {
  let slug = base, n = 2;
  while (data.customPages.some(p => p.slug === slug && p.id !== excludeId)) { slug = `${base}-${n}`; n++; }
  return slug;
}

// ---------------------------------------------------------------------------
// Admin: custom pages — add, edit, or remove any number of simple content
// pages (legal notices, house rules, anything else) with no code changes.
// ---------------------------------------------------------------------------
app.post('/api/admin/pages', requireAdmin, (req, res) => {
  const { navLabel, title, content } = req.body;
  if (!navLabel) return res.status(400).json({ error: 'Vyplňte názov stránky.' });
  const data = loadData();
  const id = 'page_' + Date.now();
  const page = { id, slug: uniqueSlug(slugify(navLabel), data), navLabel, title: title || navLabel, content: content || '' };
  data.customPages.push(page);
  saveData(data);
  res.json({ ok: true, page });
});
app.patch('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const page = data.customPages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Nenájdené.' });
  const { navLabel, title, content } = req.body;
  if (navLabel !== undefined) { page.navLabel = navLabel; page.slug = uniqueSlug(slugify(navLabel), data, page.id); }
  if (title !== undefined) page.title = title;
  if (content !== undefined) page.content = content;
  saveData(data);
  res.json({ ok: true, page });
});
app.delete('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.customPages = data.customPages.filter(p => p.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: section visibility — lets the owner hide any optional section or
// whole page without needing to touch any code.
// ---------------------------------------------------------------------------
app.put('/api/admin/section-visibility', requireAdmin, (req, res) => {
  const data = loadData();
  data.sectionVisibility = { ...data.sectionVisibility, ...req.body };
  saveData(data);
  res.json({ ok: true, sectionVisibility: data.sectionVisibility });
});

// ---------------------------------------------------------------------------
// Admin: nearby / "what's around" cards — optional image, and a free-form
// list of label/value details (trail length, difficulty, elevation gain,
// cycling distance, whatever fits that particular place).
// ---------------------------------------------------------------------------
app.post('/api/admin/nearby', requireAdmin, (req, res) => {
  const { title, distance, description } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Neplatné údaje.' });
  const data = loadData();
  const item = { id: 'n_' + Date.now(), title, distance: distance || '', description, image: '', details: [] };
  data.nearby.push(item);
  saveData(data);
  res.json({ ok: true, item });
});
app.patch('/api/admin/nearby/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.nearby.find(n => n.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  const { title, distance, description, image } = req.body;
  if (title !== undefined) item.title = title;
  if (distance !== undefined) item.distance = distance;
  if (description !== undefined) item.description = description;
  if (image !== undefined) item.image = image;
  saveData(data);
  res.json({ ok: true, item });
});
app.delete('/api/admin/nearby/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.nearby.find(n => n.id === req.params.id);
  if (item && item.image && item.image.startsWith('/images/uploads/')) fs.unlink(path.join(PUBLIC_DIR, item.image), () => {});
  data.nearby = data.nearby.filter(n => n.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});
app.post('/api/admin/nearby/:id/upload', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Žiadny súbor.' });
  const data = loadData();
  const item = data.nearby.find(n => n.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  item.image = `/images/uploads/${req.file.filename}`;
  saveData(data);
  res.json({ ok: true, item });
});
app.post('/api/admin/nearby/:id/details', requireAdmin, (req, res) => {
  const { label, value } = req.body;
  if (!label || !value) return res.status(400).json({ error: 'Vyplňte názov aj hodnotu.' });
  const data = loadData();
  const item = data.nearby.find(n => n.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  item.details.push({ id: 'd_' + Date.now(), label, value });
  saveData(data);
  res.json({ ok: true, item });
});
app.delete('/api/admin/nearby/:id/details/:detailId', requireAdmin, (req, res) => {
  const data = loadData();
  const item = data.nearby.find(n => n.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Nenájdené.' });
  item.details = item.details.filter(d => d.id !== req.params.detailId);
  saveData(data);
  res.json({ ok: true, item });
});

// ---------------------------------------------------------------------------
// Admin: reviews — moderate guest-submitted ones, or add/edit one manually
// (e.g. copied over from Tripadvisor/Booking.com/Google, with its own date)
// ---------------------------------------------------------------------------
app.get('/api/admin/reviews', requireAdmin, (req, res) => { res.json(loadData().reviews); });
app.post('/api/admin/reviews', requireAdmin, (req, res) => {
  const { name, rating, comment, source, date } = req.body;
  const stars = Number(rating);
  if (!name || !stars || stars < 1 || stars > 5 || !comment) return res.status(400).json({ error: 'Vyplňte meno, hodnotenie a text.' });
  const data = loadData();
  const createdAt = date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString();
  data.reviews.push({ id: 'rev_' + Date.now(), name, rating: stars, comment, source: source || '', status: 'approved', createdAt });
  saveData(data);
  res.json({ ok: true });
});
app.put('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const review = data.reviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Nenájdené.' });
  const { name, rating, comment, source, date, status } = req.body;
  if (name) review.name = name;
  if (rating) review.rating = Number(rating);
  if (comment) review.comment = comment;
  if (source !== undefined) review.source = source;
  if (date) review.createdAt = new Date(date + 'T12:00:00').toISOString();
  if (status) review.status = status;
  saveData(data);
  res.json({ ok: true, review });
});
app.patch('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const data = loadData();
  const review = data.reviews.find(r => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Nenájdené.' });
  if (req.body.status) review.status = req.body.status;
  saveData(data);
  res.json({ ok: true, review });
});
app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
  const data = loadData();
  data.reviews = data.reviews.filter(r => r.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// SEO-friendly routes: real paths, all serving the same single-page app.
// A permissive catch-all (rather than a fixed slug list) means admins can
// create new custom pages with brand-new slugs and they just work — no
// code change or server restart needed.
// ---------------------------------------------------------------------------
app.get(/^\/(?!api\/|images\/|css\/|js\/).*/, (req, res) => { res.sendFile(path.join(PUBLIC_DIR, 'index.html')); });

app.listen(PORT, () => {
  console.log(`Chata pod Belianskymi Tatrami server running at ${SITE_URL}`);
  if (!process.env.ADMIN_PASSWORD_HASH) console.log('⚠️  No ADMIN_PASSWORD_HASH set in .env — run "node hash-password.js yourPassword" and add it.');
  if (!emailConfigured) console.log('ℹ️  SMTP not configured in .env — emails will be printed to this console instead of sent.');
});
