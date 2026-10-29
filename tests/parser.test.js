// اختبارات قراءة CSV وتحليل القوائم. تُشغَّل بـ: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../app/src/main/assets/app/js/parser.js');

test('CSV: يقرأ الحقول المقتبسة والفواصل داخل الخلية، ويتجاهل BOM', () => {
  const [rows] = P.readCsv('﻿الاسم,الجنس\n"بن علي, أحمد",ذكر\n');
  assert.deepEqual(rows, [['الاسم', 'الجنس'], ['بن علي, أحمد', 'ذكر']]);
});

test('CSV: يقبل الفاصلة المنقوطة وعلامة الاقتباس المضاعفة', () => {
  const [rows] = P.readCsv('اللقب والاسم;الجنس\n"قال ""مرحبا""";أنثى\n');
  assert.deepEqual(rows[1], ['قال "مرحبا"', 'أنثى']);
});

test('الجنس: يعرف الصيغ العربية والإنجليزية', () => {
  assert.equal(P.parseGender('ذكر'), 'm');
  assert.equal(P.parseGender('ذكور'), 'm');
  assert.equal(P.parseGender('أنثى'), 'f');
  assert.equal(P.parseGender('انثي'), 'f');
  assert.equal(P.parseGender('female'), 'f');
  assert.equal(P.parseGender('غير معروف'), '');
});

test('التاريخ: صيغ الميلاد الشائعة وتاريخ Excel التسلسلي', () => {
  assert.equal(P.parseDob('2014-03-05'), '2014-03-05');
  assert.equal(P.parseDob('05/03/2014'), '2014-03-05');
  assert.equal(P.parseDob('05-03-2014'), '2014-03-05');
  const serial = 40000; // رقم تسلسلي في Excel
  const expected = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  assert.equal(P.parseDob(serial), expected);
  assert.equal(P.parseDob('ليس تاريخ'), '');
  assert.equal(P.parseDob(''), '');
  assert.equal(P.parseDob('31/02/2014'), '');  // يوم غير موجود
});

test('القائمة: جدولان بعنوانين قسم، ويُستخرج كل تلميذ مع قسمه', () => {
  const sheet = [
    ['قوائم تلاميذ قسم 1 متوسط'],
    ['اللقب والاسم', 'الجنس', 'تاريخ الازدياد'],
    ['أحمد بن علي', 'ذكر', '2012-03-05'],
    ['ياسمين بوزيد', 'أنثى', '2012-07-11'],
    ['قوائم تلاميذ قسم 2 متوسط'],
    ['اللقب والاسم', 'الجنس', 'تاريخ الازدياد'],
    ['سامي قادري', 'ذكر', '2011-01-20'],
  ];
  const res = P.parseRoster([sheet], '');
  assert.equal(res.list.length, 3);
  assert.equal(res.tables, 2);
  assert.deepEqual(res.list.map(x => x[3]), ['قسم 1 متوسط', 'قسم 1 متوسط', 'قسم 2 متوسط']);
  assert.deepEqual(res.list[0], ['أحمد بن علي', 'm', '2012-03-05', 'قسم 1 متوسط']);
});

test('القائمة: يستعمل اسم القسم الاحتياطي إن لم يوجد عنوان', () => {
  const sheet = [['اللقب والاسم', 'الجنس'], ['سلمى عمار', 'أنثى']];
  const res = P.parseRoster([sheet], 'قسم 3 متوسط');
  assert.equal(res.list[0][3], 'قسم 3 متوسط');
  assert.equal(res.tablesNoDob, 1);
});

test('القائمة: تُستبعد صفوف المجاميع والعناوين الرسمية', () => {
  const sheet = [
    ['اللقب والاسم', 'الجنس'],
    ['المجموع', ''],
    ['الذكور', ''],
    ['كريم دحماني', 'ذكر'],
  ];
  const res = P.parseRoster([sheet], 'ق');
  assert.deepEqual(res.list.map(x => x[0]), ['كريم دحماني']);
});

test('القائمة: لا تكرر التلميذ نفسه في القسم نفسه', () => {
  const sheet = [
    ['اللقب والاسم', 'الجنس'],
    ['نور الهدى', 'أنثى'],
    ['نور الهدى', 'أنثى'],
  ];
  assert.equal(P.parseRoster([sheet], 'ق').list.length, 1);
});

test('القائمة الفارغة: لا تلاميذ ولا رؤوس مكتشفة', () => {
  const res = P.parseRoster([[['لا شيء هنا']]], '');
  assert.equal(res.list.length, 0);
});
