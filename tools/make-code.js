// يولّد كود تفعيل لجهاز معيّن.
// الاستعمال: node tools/make-code.js <رقم-الجهاز> [ملف-المفتاح-الخاص.json]
// أو عبر المتغيرين LICENSE_PRIVATE_KEY (نص JSON) و DEVICE_ID.
const { createPrivateKey, sign } = require('node:crypto');
const fs = require('node:fs');
const { normDeviceId, licenseMessage, b32encode } = require('../app/src/main/assets/app/js/license.js');

const rawId = process.argv[2] || process.env.DEVICE_ID || '';
const keyFile = process.argv[3];
const keyText = process.env.LICENSE_PRIVATE_KEY || (keyFile ? fs.readFileSync(keyFile, 'utf8') : '');
const id = normDeviceId(rawId);
if (!/^[A-Z0-9]{8,32}$/.test(id)) { console.error('رقم الجهاز غير صالح'); process.exit(1); }
if (!keyText) { console.error('المفتاح الخاص غير موجود'); process.exit(1); }

const key = createPrivateKey({ key: JSON.parse(keyText), format: 'jwk' });
const sig = sign('sha256', Buffer.from(licenseMessage(id)), { key, dsaEncoding: 'ieee-p1363' });
const code = b32encode(sig).match(/.{1,6}/g).join('-');
console.log(code);
