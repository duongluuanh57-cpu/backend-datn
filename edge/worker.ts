/**
 * Elite Edge Cache Worker (Cloudflare Workers)
 * Dùng để cache các API response tĩnh hoặc health check để giảm tải cho Main Backend.
 */

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Chỉ cache các route cụ thể (vd: /health hoặc config)
    if (url.pathname === '/health' || url.pathname.startsWith('/api/static')) {
      const cacheUrl = new URL(request.url);
      const cacheKey = new Request(cacheUrl.toString(), request);
      const cache = caches.default;

      let response = await cache.match(cacheKey);

      if (!response) {
        console.log('🌐 [Edge] Cache Miss. Đang fetch từ Origin...');
        response = await fetch(request);
        
        // Cache trong 1 phút cho health check
        response = new Response(response.body, response);
        response.headers.append('Cache-Control', 's-maxage=60');
        
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      } else {
        console.log('🌐 [Edge] Cache Hit!');
      }

      return response;
    }

    // Các request khác pass-through qua Origin
    return fetch(request);
  },
};
