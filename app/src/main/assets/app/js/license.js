// التفعيل دون إنترنت: كود موقّع بمفتاح خاص عند المطوّر، ويتحقق التطبيق منه بالمفتاح العام فقط.
// لا يمكن توليد كود صحيح من الكود المنشور؛ الكود مرتبط برقم الجهاز.
const LICENSE_PUBKEY = {"kty":"EC","crv":"P-256","x":"cPUw9RVQWqBaYQXFhp0YbepsERufk2RzNxXLWFmmhZY","y":"7t1f1uxea0__8iluoTs70sS39EZHtRepsgSD6C5rH_M"};

function normDeviceId(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function licenseMessage(id) { return 'nabadat-pro-v1|' + normDeviceId(id); }

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function b32decode(s) {
  const clean = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out = [];
  for (const ch of clean) {
    val = (val << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

function licenseSubtle() {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
  if (typeof require === 'function') return require('node:crypto').webcrypto.subtle;
  return null;
}

async function verifyLicense(deviceId, code, jwk) {
  try {
    const subtle = licenseSubtle();
    const sig = b32decode(code);
    if (!subtle || sig.length !== 64 || !normDeviceId(deviceId)) return false;
    const key = await subtle.importKey('jwk', jwk || LICENSE_PUBKEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, new TextEncoder().encode(licenseMessage(deviceId)));
  } catch (e) { return false; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normDeviceId, licenseMessage, b32encode, b32decode, verifyLicense, LICENSE_PUBKEY };
}
