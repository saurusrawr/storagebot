/**
 * ============================================================
 *  NOKO SHOP — Cloudflare Worker Proxy
 *  Cara deploy:
 *  1. Buka https://workers.cloudflare.com
 *  2. Buat akun gratis (atau login)
 *  3. Klik "Create Worker"
 *  4. Hapus semua kode default, paste seluruh file ini
 *  5. Klik "Save & Deploy"
 *  6. Copy URL worker kamu (contoh: https://noko-proxy.username.workers.dev)
 *  7. Paste URL itu ke variabel WORKER_URL di noko-shop.html
 * ============================================================
 */

// Daftar User-Agent modern (Chrome 120+, Firefox 122+, Safari 17+)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/120.0.2210.144",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/106.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; WOW64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/106.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:109.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/122.0",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Allowed origin — ganti kalau kamu hosting di domain sendiri, atau biarkan * untuk semua
const ALLOWED_ORIGIN = '*';

// Target base URL
const TARGET_BASE = 'https://app.pakasir.com';

export default {
  async fetch(request, env, ctx) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/ping') {
      return new Response(JSON.stringify({ ok: true, time: Date.now() }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
      });
    }

    // Ambil path + query dari request, teruskan ke Pakasir
    // Contoh: /api/transactioncreate/qris → https://app.pakasir.com/api/transactioncreate/qris
    const targetPath = url.pathname + url.search;
    const targetUrl  = TARGET_BASE + targetPath;

    // Rebuild headers — hapus host lama, masukkan UA random & header yang Pakasir butuhkan
    const newHeaders = new Headers();
    newHeaders.set('Content-Type',    'application/json');
    newHeaders.set('User-Agent',      randomUA());
    newHeaders.set('Accept',          'application/json, text/plain, */*');
    newHeaders.set('Accept-Language', 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7');
    newHeaders.set('Referer',         'https://app.pakasir.com/');
    newHeaders.set('Origin',          'https://app.pakasir.com');

    // Forward body kalau POST
    let body = null;
    if (request.method === 'POST') {
      body = await request.text();
    }

    // Kirim request ke Pakasir
    let pakasirResp;
    try {
      pakasirResp = await fetch(targetUrl, {
        method:  request.method,
        headers: newHeaders,
        body:    body || undefined,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Worker failed to reach Pakasir', detail: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
      });
    }

    // Baca response dari Pakasir
    const respBody    = await pakasirResp.text();
    const respHeaders = new Headers();
    respHeaders.set('Content-Type',                'application/json');
    respHeaders.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    respHeaders.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    respHeaders.set('X-Proxy-By',                  'noko-worker');
    respHeaders.set('X-UA-Used',                   newHeaders.get('User-Agent').slice(0, 50));

    return new Response(respBody, {
      status:  pakasirResp.status,
      headers: respHeaders,
    });
  }
};
