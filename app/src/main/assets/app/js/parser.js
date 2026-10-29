// طبقة قراءة الملفات وتحليل القوائم: بلا مكتبات خارجية وبلا أي اتصال.
// تُستعمل في المتصفح وفي اختبارات Node (تصدير في آخر الملف).

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // ===== قراءة الملفات (بدون مكتبات خارجية) =====
  function colIndex(ref) {
    const letters = /^([A-Z]+)/.exec(ref)[1];
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  async function inflateRaw(data) {
    if (!window.DecompressionStream) throw new Error('المتصفح لا يدعم فك ضغط الملفات، استعمل متصفحاً حديثاً أو احفظ الملف بصيغة CSV.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzipAll(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('الملف ليس xlsx صالحاً.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const loff = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      const start = loff + 30 + dv.getUint16(loff + 26, true) + dv.getUint16(loff + 28, true);
      const data = u8.subarray(start, start + csize);
      files[name] = method === 0 ? data : await inflateRaw(data);
      p += 46 + nlen + elen + clen;
    }
    return files;
  }

  async function readXlsx(buf) {
    const files = await unzipAll(buf);
    const dec = new TextDecoder();
    const xml = name => files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml') : null;
    const ss = [];
    const sst = xml('xl/sharedStrings.xml');
    if (sst) for (const si of Array.from(sst.getElementsByTagName('si'))) {
      ss.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
    }
    const names = Object.keys(files)
      .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const sheets = [];
    for (const n of names) {
      const doc = xml(n);
      const grid = [];
      for (const row of Array.from(doc.getElementsByTagName('row'))) {
        const r = Number(row.getAttribute('r')) - 1;
        grid[r] = grid[r] || [];
        for (const c of Array.from(row.getElementsByTagName('c'))) {
          const ci = colIndex(c.getAttribute('r'));
          const t = c.getAttribute('t');
          const v = c.getElementsByTagName('v')[0];
          let val = '';
          if (t === 's') val = v ? (ss[Number(v.textContent)] || '') : '';
          else if (t === 'inlineStr') val = Array.from(c.getElementsByTagName('t')).map(x => x.textContent).join('');
          else if (v) {
            const x = v.textContent;
            val = (t === 'str' || t === 'e' || t === 'b') ? x : (x.trim() !== '' && !isNaN(x) ? Number(x) : x);
          }
          grid[r][ci] = val;
        }
      }
      sheets.push(Array.from(grid, row => row ? Array.from({ length: row.length }, (_, i) => (row[i] === undefined ? '' : row[i])) : []));
    }
    return sheets;
  }

  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return [rows];
  }

  // ===== تحليل القائمة: يبحث عن رؤوس الأعمدة في كل الكشوف =====
  const EXCLUDE = /المجموع|مجموع|الذكور|الإناث|إمضاء|جدد|معيدين|قوائم|الجمهورية|وزارة|مديرية|الموسم|الجنس|تاريخ|اللقب|الاسم/;

  const NAME_RE = /اللقب|الاسم|اسم|لقب|nom|name/i;
  const GENDER_RE = /الجنس|النوع|sexe|gender|sex/i;
  const DOB_RE = /الميلاد|الازدياد|ازدياد|الولادة|ولادة|ميلاد|naissance|birth/i;

  function parseGender(v) {
    const s = norm(v);
    if (/^(ذكر|ذكور|m|male)/i.test(s)) return 'm';
    if (/^(أنثى|انثى|أنثي|انثي|إناث|اناث|f|female)/i.test(s)) return 'f';
    return '';
  }

  function isoOf(y, mo, d) {
    if (y < 1990 || y > 2035 || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    // يرفض التواريخ غير الموجودة مثل 31 فبراير، بدل أن تنقلب إلى تاريخ آخر
    const check = new Date(Date.UTC(y, mo - 1, d));
    if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function parseDob(v) {
    if (v === '' || v === null || v === undefined) return '';
    if (typeof v === 'number' || /^\d{5}$/.test(norm(v))) {
      const days = Math.round(Number(v));
      if (days <= 0) return '';
      return new Date(Date.UTC(1899, 11, 30) + days * 86400000).toISOString().slice(0, 10);
    }
    const s = norm(v);
    let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) return isoOf(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (m) return isoOf(+m[3], +m[2], +m[1]);
    return '';
  }

  function cleanClassName(t) {
    return norm(t).replace(/قوائم\s*تلاميذ/g, '').replace(/^[\s:\-–]+/, '').trim();
  }

  // يبحث عن عنوان القسم (مثل «قوائم تلاميذ قسم 1 متوسط») فوق رأس الجدول
  function findClassName(A, r) {
    for (let rr = r; rr >= Math.max(0, r - 8); rr--) {
      for (const cell of (A[rr] || [])) {
        const t = norm(cell);
        if (t && t.length < 80 && /قسم/.test(t)) {
          const name = cleanClassName(t);
          if (name) return name;
        }
      }
    }
    return '';
  }

  function parseRoster(sheets, fallbackClass) {
    const list = [], seen = new Set();
    let tables = 0, tablesNoDob = 0, tablesNoGender = 0;
    const seenHeaders = [];
    for (const A of sheets) {
      A.slice(0, 80).forEach(row => row.forEach(cell => {
        const t = norm(cell);
        if (t && t.length < 60 && !seenHeaders.includes(t) && seenHeaders.length < 15) seenHeaders.push(t);
      }));
      // رؤوس الجداول: خلية اسم قصيرة في الصف نفسه يوجد بجانبها عمود الجنس أو تاريخ الميلاد
      const heads = [];
      A.forEach((row, r) => row.forEach((cell, c) => {
        const t = norm(cell);
        if (!t || t.length > 60 || !NAME_RE.test(t) || /مديرية|وزارة|الجمهورية|قوائم/.test(t)) return;
        const nearest = re => {
          let best = -1, bd = Infinity;
          row.forEach((x, cc) => {
            if (re.test(norm(x))) { const d = Math.abs(cc - c); if (d < bd) { bd = d; best = cc; } }
          });
          return best;
        };
        const gc = nearest(GENDER_RE), dc = nearest(DOB_RE);
        if (gc < 0 && dc < 0) return;
        heads.push({ r, c, gc, dc, cls: findClassName(A, r) || fallbackClass || 'قسم غير مسمى' });
      }));
      heads.forEach((h, idx) => {
        tables++;
        if (h.dc < 0) tablesNoDob++;
        if (h.gc < 0) tablesNoGender++;
        const nextR = (heads.slice(idx + 1).find(x => x.c === h.c && x.r > h.r) || { r: A.length }).r;
        for (let r = h.r + 1; r < nextR; r++) {
          const rowR = A[r] || [];
          const name = norm(rowR[h.c]);
          if (name.length < 3 || !/[A-Za-z\u0600-\u06FF]/.test(name) || EXCLUDE.test(name)) continue;
          const g = h.gc >= 0 ? parseGender(rowR[h.gc]) : '';
          const dob = h.dc >= 0 ? parseDob(rowR[h.dc]) : '';
          const key = h.cls + '|' + name + '|' + g + '|' + dob;
          if (seen.has(key)) continue;
          seen.add(key);
          list.push([name, g, dob, h.cls]);
        }
      });
    }
    return { list, tables, tablesNoDob, tablesNoGender, seenHeaders };
  }


if (typeof module !== 'undefined') {
  module.exports = { norm, readCsv, parseRoster, parseGender, parseDob, isoOf, cleanClassName, EXCLUDE, NAME_RE, GENDER_RE, DOB_RE };
}
