const allowedMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

export async function onRequest({ request, env }) {
  let backend;
  try {
    backend = new URL(env.BACKEND_API_ORIGIN || 'https://tqi.autorevives.com');
  } catch {
    return Response.json({ success: false, error: 'Backend API configuration is invalid.' }, { status: 503 });
  }

  if (!['http:', 'https:'].includes(backend.protocol) || backend.pathname !== '/' || backend.search || backend.hash) {
    return Response.json(
      { success: false, error: 'BACKEND_API_ORIGIN must be an HTTP(S) origin without a path.' },
      { status: 503 },
    );
  }

  if (!allowedMethods.has(request.method)) {
    return Response.json({ success: false, error: 'Method not allowed.' }, { status: 405 });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, backend.origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');

  try {
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
    const response = await fetch(upstreamRequest);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('access-control-allow-origin');
    responseHeaders.delete('access-control-allow-credentials');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ success: false, error: 'Backend API is unavailable.' }, { status: 502 });
  }
}
