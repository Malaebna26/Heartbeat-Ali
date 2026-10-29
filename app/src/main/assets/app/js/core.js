// المنطق الطبي والبيانات: دوال نقية بلا واجهة، قابلة للاختبار في Node.
// القاعدة: classify هي قلب التطبيق. تُرجع مفاتيح نصوص (k) لا نصوصاً جاهزة، لتُترجم حسب اللغة.

const STORE_VERSION = 2;
const BACKUP_APP = 'nabadat-rabie';
const SAVEABLE = ['ok', 'follow', 'refer'];
const PROTOCOLS = ['cooldown', 'abrupt'];

// حدود نبض الراحة حسب العمر (تقريبية، تحتاج مراجعة طبية قبل الاستعمال الرسمي)
function restRange(age) { return age <= 12 ? [70, 120] : [60, 100]; }

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ageFromDob(dob, today) {
  if (!dob) return null;
  const now = today || new Date();
  const b = new Date(dob + 'T00:00:00');
  if (isNaN(b.getTime())) return null;
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

// التصنيف: ok = طبيعي، follow = متابعة، refer = إحالة، incomplete = بيانات ناقصة
function classify(p) {
  const anyValue = p.pre !== '' || p.post !== '' || p.rec !== '' || p.symptoms;
  if (!anyValue) return { status: null, flags: [] };
  if (p.symptoms) return { status: 'refer', flags: [{ k: 'flag.symptoms' }] };

  const pre = num(p.pre), post = num(p.post), rec = num(p.rec);
  if (pre === null || post === null || rec === null) return { status: 'incomplete', flags: [{ k: 'inc.three' }] };
  if (p.age === null || p.age === '' || p.age === undefined) return { status: 'incomplete', flags: [{ k: 'inc.age' }] };
  if (rec > post) return { status: 'incomplete', flags: [{ k: 'inc.order' }] };

  const strong = [], weak = [];
  const [lo, hi] = restRange(Number(p.age));
  if (pre < lo || pre > hi) strong.push({ k: 'flag.rest', p: { v: pre, lo, hi } });

  const drop = post - rec;
  const th = p.protocol === 'abrupt' ? 18 : 12;
  if (drop <= th) weak.push({ k: 'flag.weak', p: { drop, th } });

  let status;
  if (strong.length && weak.length) status = 'refer';
  else if (strong.length || weak.length) status = 'follow';
  else status = 'ok';
  return { status, flags: [...strong, ...weak] };
}

function newPupil(name, g, dob, extra, cls) {
  return {
    name, g, dob, cls: cls || 'بدون قسم', age: ageFromDob(dob), ageEdited: false,
    pre: '', post: '', rec: '', protocol: 'cooldown', symptoms: false, extra, history: []
  };
}

// ===== السجل: تُحفظ الجلسة الكاملة ثم تُمسح القياسات الحالية =====
function saveSession(p, now) {
  const r = classify(p);
  if (!SAVEABLE.includes(r.status)) return { ok: false };
  p.history.push({
    d: (now || new Date()).toISOString(),
    pre: p.pre, post: p.post, rec: p.rec,
    protocol: p.protocol, symptoms: p.symptoms, status: r.status
  });
  p.pre = ''; p.post = ''; p.rec = ''; p.symptoms = false; p.protocol = 'cooldown';
  return { ok: true };
}

// ===== التحقق من البيانات (للنسخ الاحتياطي والتخزين) =====
function cleanMeasure(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) && n >= 20 && n <= 300 ? String(n) : '';
}

function cleanText(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

function sanitizeSession(h) {
  if (!h || typeof h !== 'object' || typeof h.d !== 'string') return null;
  return {
    d: cleanText(h.d, 40),
    pre: cleanMeasure(h.pre), post: cleanMeasure(h.post), rec: cleanMeasure(h.rec),
    protocol: PROTOCOLS.includes(h.protocol) ? h.protocol : 'cooldown',
    symptoms: !!h.symptoms,
    status: ['ok', 'follow', 'refer', 'incomplete'].includes(h.status) ? h.status : ''
  };
}

function sanitizePupil(s) {
  if (!s || typeof s !== 'object') throw new Error('bad-row');
  const dob = typeof s.dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.dob) ? s.dob : '';
  const ageEdited = !!s.ageEdited;
  let age = Number.isInteger(s.age) && s.age >= 0 && s.age <= 99 ? s.age : null;
  if (dob && !ageEdited) age = ageFromDob(dob);
  return {
    name: cleanText(s.name, 200),
    g: ['m', 'f'].includes(s.g) ? s.g : '',
    dob,
    cls: cleanText(s.cls, 100),
    age, ageEdited,
    pre: cleanMeasure(s.pre), post: cleanMeasure(s.post), rec: cleanMeasure(s.rec),
    protocol: PROTOCOLS.includes(s.protocol) ? s.protocol : 'cooldown',
    symptoms: !!s.symptoms,
    extra: !!s.extra,
    history: Array.isArray(s.history) ? s.history.slice(0, 500).map(sanitizeSession).filter(Boolean) : []
  };
}

// ===== النسخ الاحتياطي =====
function buildBackup(pupils, now) {
  return JSON.stringify({
    app: BACKUP_APP,
    version: STORE_VERSION,
    exportedAt: (now || new Date()).toISOString(),
    pupils
  }, null, 2);
}

// يُرجع قائمة تلاميذ نظيفة، أو يرمي خطأً بمفتاح: bad-json | bad-format | too-many | bad-row
function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('bad-json'); }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.pupils)) throw new Error('bad-format');
  if (data.pupils.length > 5000) throw new Error('too-many');
  return data.pupils.map(sanitizePupil);
}

if (typeof module !== 'undefined') {
  module.exports = {
    STORE_VERSION, BACKUP_APP, restRange, num, ageFromDob, classify, newPupil,
    saveSession, sanitizePupil, buildBackup, parseBackup, cleanMeasure
  };
}
