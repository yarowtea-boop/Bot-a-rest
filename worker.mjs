const DEFAULT_BOT_BASE = '';

function resolveBotBase(env) {
  const candidate = env && typeof env.BOT_BASE === 'string' ? env.BOT_BASE.trim() : '';
  return candidate || DEFAULT_BOT_BASE;
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...extra,
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      ...extra,
    }),
  });
}

async function proxyToBot(request, path, env) {
  const botBase = resolveBotBase(env);
  if (!botBase) {
    return json(
      {
        ok: false,
        error: 'BOT_BASE not configured',
        detail: 'Set BOT_BASE to the separate bot backend origin. The public Worker host must not proxy back to itself.',
      },
      502,
    );
  }
  try {
    if (new URL(botBase).origin === new URL(request.url).origin) {
      return json(
        {
          ok: false,
          error: 'BOT_BASE loops to the public Worker origin',
          detail: 'Set BOT_BASE to the separate bot backend origin. Do not point it at the same host that serves the tracker UI.',
        },
        502,
      );
    }
  } catch (_error) {
    return json(
      {
        ok: false,
        error: 'BOT_BASE is invalid',
        detail: 'Set BOT_BASE to an absolute upstream origin like https://bot.example.com',
      },
      502,
    );
  }
  const upstream = `${botBase}${path}`;
  const init = {
    method: request.method,
    headers: {},
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
    init.headers['Content-Type'] = request.headers.get('content-type') || 'application/json';
  }
  const response = await fetch(upstream, init);
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: corsHeaders({
      'Content-Type': response.headers.get('content-type') || 'application/json; charset=utf-8',
    }),
  });
}

function assetRequest(request, url) {
  if (url.pathname === '/') {
    return new Request(new URL('/index.html', request.url), request);
  }
  return request;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true, bridge: true, bot_base: resolveBotBase(env) });
    }

    if (url.pathname === '/api/scores' || url.pathname === '/api/live-scores') {
      return proxyToBot(request, '/api/scores', env);
    }

    if (url.pathname === '/api/tracker-state') {
      return proxyToBot(request, '/api/tracker-state', env);
    }

    if (url.pathname === '/webhook/tradingview') {
      return proxyToBot(request, '/webhook/tradingview', env);
    }

    const assetRequestToServe = assetRequest(request, url);
    return env.ASSETS.fetch(assetRequestToServe);
  },
};
