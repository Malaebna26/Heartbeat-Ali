const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const L = require('../app/src/main/assets/app/js/license.js');

function makePair() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = publicKey.export({ format: 'jwk' });
  return { privateKey, jwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
}
function codeFor(privateKey, id) {
  const sig = sign('sha256', Buffer.from(L.licenseMessage(id)), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return L.b32encode(sig).match(/.{1,6}/g).join('-');
}

test('base32 يعيد البايتات نفسها', () => {
  const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) & 255);
  assert.deepEqual(Array.from(L.b32decode(L.b32encode(bytes))), Array.from(bytes));
});

test('رقم الجهاز يُوحَّد (حروف كبيرة وبلا فواصل)', () => {
  assert.equal(L.normDeviceId('a1b2-c3d4 e5f6'), 'A1B2C3D4E5F6');
});

test('كود صحيح يُقبل، ويقبل الفواصل والحروف الصغيرة', async () => {
  const { privateKey, jwk } = makePair();
  const code = codeFor(privateKey, 'a1b2c3d4e5f60718');
  assert.equal(await L.verifyLicense('A1B2-C3D4-E5F6-0718', code, jwk), true);
  assert.equal(await L.verifyLicense('a1b2c3d4e5f60718', code.toLowerCase().replace(/-/g, ' '), jwk), true);
});

test('الكود لا يصلح لجهاز آخر', async () => {
  const { privateKey, jwk } = makePair();
  const code = codeFor(privateKey, 'A1B2C3D4E5F60718');
  assert.equal(await L.verifyLicense('0000000000000000', code, jwk), false);
});

test('كود موقّع بمفتاح آخر مرفوض', async () => {
  const mine = makePair(), other = makePair();
  const code = codeFor(other.privateKey, 'A1B2C3D4E5F60718');
  assert.equal(await L.verifyLicense('A1B2C3D4E5F60718', code, mine.jwk), false);
});

test('كود فارغ أو تالف أو قصير مرفوض دون استثناء', async () => {
  const { jwk } = makePair();
  for (const bad of ['', 'ABC', '!!!!', null, undefined, 'A'.repeat(103)]) {
    assert.equal(await L.verifyLicense('A1B2C3D4E5F60718', bad, jwk), false);
  }
  assert.equal(await L.verifyLicense('', 'A'.repeat(103), jwk), false);
});

test('تعديل حرف واحد في الكود يبطله', async () => {
  const { privateKey, jwk } = makePair();
  const code = codeFor(privateKey, 'A1B2C3D4E5F60718');
  const flipped = (code[0] === 'A' ? 'B' : 'A') + code.slice(1);
  assert.equal(await L.verifyLicense('A1B2C3D4E5F60718', flipped, jwk), false);
});

test('المفتاح العام المضمّن في التطبيق يقبل كود المطوّر الفعلي', async () => {
  const { execFileSync } = require('node:child_process');
  const path = process.env.LICENSE_PRIVATE_KEY_FILE;
  if (!path) return; // يعمل فقط عند توفر المفتاح الخاص محلياً
  const code = execFileSync('node', ['tools/make-code.js', 'A1B2C3D4E5F60718', path], { encoding: 'utf8' }).trim();
  assert.equal(await L.verifyLicense('A1B2C3D4E5F60718', code), true);
});
