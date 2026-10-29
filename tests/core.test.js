// اختبارات قواعد الفرز والسجل والنسخ الاحتياطي. تُشغَّل بـ: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../app/src/main/assets/app/js/core.js');
const { classify, newPupil, saveSession, sanitizePupil, buildBackup, parseBackup, ageFromDob, restRange } = core;

// تلميذ جاهز بقياسات كاملة، والقيم تُعدَّل في كل اختبار
function pupil(over) {
  return Object.assign({
    name: 'تلميذ', g: 'm', dob: '', cls: 'قسم', age: 11, ageEdited: true,
    pre: '90', post: '150', rec: '120', protocol: 'cooldown', symptoms: false, extra: false, history: []
  }, over);
}

const flagKeys = r => r.flags.map(f => f.k);

test('بلا أي قياس: لا نتيجة', () => {
  const r = classify(pupil({ pre: '', post: '', rec: '' }));
  assert.equal(r.status, null);
  assert.deepEqual(r.flags, []);
});

test('قياسات طبيعية: النتيجة طبيعية', () => {
  // انخفاض 30 bpm في الدقيقة الأولى أكبر من العتبة 12، ونبض الراحة ضمن الحدود
  assert.equal(classify(pupil({ pre: '90', post: '150', rec: '120' })).status, 'ok');
});

test('الأعراض تعني إحالة فورية حتى مع أرقام طبيعية', () => {
  const r = classify(pupil({ pre: '90', post: '150', rec: '120', symptoms: true }));
  assert.equal(r.status, 'refer');
  assert.deepEqual(flagKeys(r), ['flag.symptoms']);
});

test('الأعراض وحدها بلا قياسات: إحالة', () => {
  const r = classify(pupil({ pre: '', post: '', rec: '', symptoms: true }));
  assert.equal(r.status, 'refer');
});

test('قياس ناقص: غير مكتمل', () => {
  const r = classify(pupil({ rec: '' }));
  assert.equal(r.status, 'incomplete');
  assert.deepEqual(flagKeys(r), ['inc.three']);
});

test('بلا عمر: غير مكتمل', () => {
  const r = classify(pupil({ age: null }));
  assert.equal(r.status, 'incomplete');
  assert.deepEqual(flagKeys(r), ['inc.age']);
});

test('النبض بعد دقيقة أكبر من فور التوقف: غير مكتمل وتنبيه بالترتيب', () => {
  const r = classify(pupil({ post: '120', rec: '130' }));
  assert.equal(r.status, 'incomplete');
  assert.deepEqual(flagKeys(r), ['inc.order']);
});

test('حد التعافي: انخفاض 12 بالتهدئة ضعيف، و13 مقبول', () => {
  assert.equal(classify(pupil({ post: '150', rec: '138' })).status, 'follow'); // 12 ≤ 12 ضعيف
  assert.equal(classify(pupil({ post: '150', rec: '137' })).status, 'ok');     // 13 > 12
});

test('حد التعافي بعد التوقف الفوري 18: انخفاض 18 ضعيف، و19 مقبول', () => {
  assert.equal(classify(pupil({ protocol: 'abrupt', post: '150', rec: '132' })).status, 'follow');
  assert.equal(classify(pupil({ protocol: 'abrupt', post: '150', rec: '131' })).status, 'ok');
});

test('نبض الراحة خارج الحدود لتلميذ 11 سنة (70–120)', () => {
  assert.deepEqual(restRange(11), [70, 120]);
  assert.equal(classify(pupil({ pre: '70' })).status, 'ok');   // الحد الأدنى مقبول
  assert.equal(classify(pupil({ pre: '120' })).status, 'ok');  // الحد الأعلى مقبول
  const r = classify(pupil({ pre: '121' }));
  assert.equal(r.status, 'follow');
  assert.deepEqual(flagKeys(r), ['flag.rest']);
});

test('بعد 12 سنة تنخفض الحدود إلى 60–100', () => {
  assert.deepEqual(restRange(13), [60, 100]);
  assert.equal(classify(pupil({ age: 13, pre: '101' })).status, 'follow');
  assert.equal(classify(pupil({ age: 13, pre: '100' })).status, 'ok');
});

test('مؤشران معاً (راحة خارج الحدود وتعافٍ ضعيف): إحالة للطبيب', () => {
  const r = classify(pupil({ pre: '130', post: '150', rec: '142' }));
  assert.equal(r.status, 'refer');
  assert.deepEqual(flagKeys(r), ['flag.rest', 'flag.weak']);
});

test('القيم النصية الفارغة في الإدخال لا تُعتبر صفراً', () => {
  // الخانة الفارغة لا تُحسب صفراً؛ عدم إكمال القياس يبقى غير مكتمل
  assert.equal(classify(pupil({ pre: '', post: '150', rec: '120' })).status, 'incomplete');
});

test('saveSession: يرفض الجلسة الناقصة ولا يغيّر شيئاً', () => {
  const p = pupil({ rec: '' });
  assert.equal(saveSession(p).ok, false);
  assert.equal(p.history.length, 0);
  assert.equal(p.rec, '');
});

test('saveSession: يحفظ الجلسة ثم يمسح القياسات الحالية فقط', () => {
  const p = pupil({ name: 'أحمد', protocol: 'abrupt' });
  const now = new Date('2026-10-29T10:00:00Z');
  assert.equal(saveSession(p, now).ok, true);
  assert.equal(p.history.length, 1);
  assert.deepEqual(p.history[0], {
    d: '2026-10-29T10:00:00.000Z', pre: '90', post: '150', rec: '120',
    protocol: 'abrupt', symptoms: false, status: 'ok'
  });
  assert.equal(p.pre, ''); assert.equal(p.post, ''); assert.equal(p.rec, '');
  assert.equal(p.protocol, 'cooldown');
  assert.equal(p.name, 'أحمد', 'الاسم والعمر يبقيان');
  assert.equal(p.age, 11);
});

test('ageFromDob يحسب العمر بتاريخ ثابت', () => {
  const today = new Date('2026-10-29T12:00:00');
  assert.equal(ageFromDob('2015-10-29', today), 11);  // عيد الميلاد اليوم
  assert.equal(ageFromDob('2015-10-30', today), 10);  // لم يحن بعد
  assert.equal(ageFromDob('', today), null);
  assert.equal(ageFromDob('ليس تاريخاً', today), null);
});

test('sanitizePupil ينظّف القيم الخاطئة ولا يقبلها', () => {
  const p = sanitizePupil({
    name: 'س', g: 'x', dob: '2015-01-01', cls: 'ق', pre: '5', post: '150', rec: 'abc',
    protocol: 'حذف', symptoms: 'نعم', history: 'ليس مصفوفة'
  });
  assert.equal(p.g, '');              // جنس غير معروف
  assert.equal(p.pre, '');            // 5 خارج المدى 20–300
  assert.equal(p.post, '150');
  assert.equal(p.rec, '');            // نص غير رقمي
  assert.equal(p.protocol, 'cooldown');
  assert.equal(p.symptoms, true);     // قيمة صادقة تُحوَّل إلى true
  assert.deepEqual(p.history, []);
  assert.equal(p.age, ageFromDob('2015-01-01'));
});

test('sanitizePupil يرفض الصف غير الكائني', () => {
  assert.throws(() => sanitizePupil('نص'), /bad-row/);
  assert.throws(() => sanitizePupil(null), /bad-row/);
});

test('النسخة الاحتياطية: تحويل ذهاب وإياب يحفظ السجل', () => {
  const p = pupil({ name: 'ياسمين' });
  saveSession(p, new Date('2026-10-01T08:00:00Z'));
  const text = buildBackup([p], new Date('2026-10-29T09:00:00Z'));
  const data = JSON.parse(text);
  assert.equal(data.app, 'nabadat-rabie');
  assert.equal(data.version, 2);
  const back = parseBackup(text);
  assert.equal(back.length, 1);
  assert.equal(back[0].name, 'ياسمين');
  assert.equal(back[0].history.length, 1);
  assert.equal(back[0].history[0].status, 'ok');
});

test('parseBackup يرفض الملفات الخاطئة برموز واضحة', () => {
  assert.throws(() => parseBackup('ليس JSON{'), /bad-json/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'other', pupils: [] })), /bad-format/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'nabadat-rabie' })), /bad-format/);
  const big = { app: 'nabadat-rabie', pupils: new Array(5001).fill({ name: 'x' }) };
  assert.throws(() => parseBackup(JSON.stringify(big)), /too-many/);
});

test('newPupil يضبط الحقول الافتراضية والسجل الفارغ', () => {
  const p = newPupil('ع', 'f', '2014-05-05', false, 'قسم 2');
  assert.equal(p.cls, 'قسم 2');
  assert.deepEqual(p.history, []);
  assert.equal(p.protocol, 'cooldown');
  assert.equal(p.g, 'f');
});
