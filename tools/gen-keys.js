// يولّد زوج مفاتيح ECDSA P-256 لنظام التفعيل. شغّله مرة واحدة فقط.
// المفتاح الخاص يُحفظ في الملف الذي تحدده (لا تضعه في المستودع أبداً)،
// والمفتاح العام يُطبع لتلصقه في app/src/main/assets/app/js/license.js
const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const out = process.argv[2];
if (!out) { console.error('الاستعمال: node tools/gen-keys.js <ملف-المفتاح-الخاص.json>'); process.exit(1); }
if (fs.existsSync(out)) { console.error('الملف موجود مسبقاً، لن يُستبدل: ' + out); process.exit(1); }
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
fs.writeFileSync(out, JSON.stringify(privateKey.export({ format: 'jwk' })), { mode: 0o600 });
const pub = publicKey.export({ format: 'jwk' });
console.log('المفتاح العام (الصقه في license.js):');
console.log(JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
