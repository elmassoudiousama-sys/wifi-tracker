import { NextRequest, NextResponse } from "next/server";

// Allow local router self-signed TLS certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPrivateIp(ip: string): boolean {
  const clean = ip.split(":")[0].trim();
  if (clean === "localhost" || clean === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(clean)) return true;
  return false;
}

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ target: string; path?: string[] }> }
) {
  const { target, path: pathSegments } = await context.params;

  if (!target || !isPrivateIp(target)) {
    return new NextResponse("Access Denied: Target must be a valid private network IP.", {
      status: 403,
    });
  }

  // Parse target and optional port
  let host = target;
  let port = 80;
  let isSsl = false;

  if (target.includes(":")) {
    const parts = target.split(":");
    host = parts[0];
    port = parseInt(parts[1], 10) || 80;
  }

  const searchParams = req.nextUrl.searchParams;
  if (port === 443 || searchParams.get("ssl") === "1" || searchParams.get("ssl") === "true") {
    isSsl = true;
  }

  const protocol = isSsl ? "https:" : "http:";
  const portStr = (isSsl && port === 443) || (!isSsl && port === 80) ? "" : `:${port}`;

  const subPath = pathSegments && pathSegments.length > 0 ? pathSegments.join("/") : "";
  const queryStr = req.nextUrl.search;

  // Build remote target URL
  const targetUrl = `${protocol}//${host}${portStr}/${subPath}${queryStr}`;

  // Prepare outgoing headers
  const reqHeaders = new Headers();
  req.headers.forEach((val, key) => {
    const k = key.toLowerCase();
    if (!["host", "connection", "keep-alive", "content-length", "transfer-encoding"].includes(k)) {
      reqHeaders.set(key, val);
    }
  });
  reqHeaders.set("Host", `${host}${portStr}`);
  reqHeaders.set("Origin", `${protocol}//${host}${portStr}`);
  reqHeaders.set("Referer", `${protocol}//${host}${portStr}/`);

  const fetchOptions: RequestInit = {
    method: req.method,
    headers: reqHeaders,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(req.method)) {
    try {
      const bodyBuffer = await req.arrayBuffer();
      if (bodyBuffer.byteLength > 0) {
        fetchOptions.body = bodyBuffer;
      }
    } catch {
      // Body empty or unreadable
    }
  }

  let resp: Response;
  try {
    resp = await fetch(targetUrl, fetchOptions);
  } catch (err: any) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:30px;direction:rtl;">
        <h2>⚠️ تعذر الاتصال بالجهاز (${target})</h2>
        <p>السبب: ${err?.message || "انتهت مهلة الاتصال أو الجهاز مغلق"}</p>
        <p><a href="/" style="color:#38bdf8;">🔙 العودة للوحة التحكم الرئيسية</a></p>
      </body></html>`,
      {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const resHeaders = new Headers();
  resp.headers.forEach((val, key) => {
    const k = key.toLowerCase();
    // Strip headers that block iframe embedding or interfere with proxying
    if (k === "x-frame-options" || k === "content-security-policy" || k === "content-encoding") {
      return;
    }
    if (k === "location") {
      // Rewrite location redirect
      let loc = val;
      if (loc.startsWith(`http://${host}${portStr}`)) {
        loc = loc.replace(`http://${host}${portStr}`, `/api/proxy/${target}`);
      } else if (loc.startsWith(`https://${host}${portStr}`)) {
        loc = loc.replace(`https://${host}${portStr}`, `/api/proxy/${target}`);
      } else if (loc.startsWith("/")) {
        loc = `/api/proxy/${target}${loc}`;
      }
      resHeaders.set("Location", loc);
      return;
    }
    if (k === "set-cookie") {
      // Let cookies pass with root path so browser preserves auth session
      const cleanCookie = val
        .replace(/Domain=[^;]+;?/gi, "")
        .replace(/Path=[^;]+;?/gi, "Path=/;");
      resHeaders.append("Set-Cookie", cleanCookie);
      return;
    }
    resHeaders.set(key, val);
  });

  // Track active proxy device in cookie for assets routing
  resHeaders.append(
    "Set-Cookie",
    `proxy_active_target=${target}; Path=/; SameSite=Lax; Max-Age=3600`
  );

  const contentType = (resp.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("text/html")) {
    let html = await resp.text();

    // 1. Inject <base> tag to auto-resolve relative links
    const baseTag = `<base href="/api/proxy/${target}/" />`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>\n  ${baseTag}`);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", `<HEAD>\n  ${baseTag}`);
    } else {
      html = `${baseTag}\n${html}`;
    }

    // 2. Rewrite root-relative links in attributes so they stay inside the proxy
    html = html.replace(/(href|src|action)=["']\/([^"']*)["']/gi, (match, attr, path) => {
      if (path.startsWith("api/proxy/")) return match;
      return `${attr}="/api/proxy/${target}/${path}"`;
    });

    // 3. Inject top floating control bar for quick navigation
    const topBar = `
      <div id="proxy-control-bar" style="position:fixed; top:0; left:0; right:0; height:40px; background:rgba(15,23,42,0.95); backdrop-filter:blur(8px); color:#f8fafc; z-index:999999999; display:flex; align-items:center; justify-content:space-between; padding:0 16px; font-family:system-ui,-apple-system,sans-serif; font-size:13px; border-bottom:1px solid #334155; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span>
          <span style="font-weight:700; color:#38bdf8;">🌐 بوابة التحكم عن بعد (Remote Proxy)</span>
          <span style="color:#94a3b8; font-size:12px;">| الجهاز: <code style="background:#1e293b; color:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:600;">${target}</code></span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button onclick="window.location.reload()" style="background:#1e293b; color:#e2e8f0; border:1px solid #475569; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px;">🔄 تحديث الصفحة</button>
          <a href="/" target="_top" style="background:#0284c7; color:#ffffff; border:none; text-decoration:none; padding:5px 12px; border-radius:6px; font-weight:700; font-size:12px; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(2,132,199,0.4);">
            🏠 العودة للوحة التحكم الرئيسية
          </a>
        </div>
      </div>
      <div id="proxy-spacer" style="height:40px;"></div>
    `;

    if (html.includes("<body>")) {
      html = html.replace("<body>", `<body>\n${topBar}`);
    } else if (html.includes("<BODY>")) {
      html = html.replace("<BODY>", `<BODY>\n${topBar}`);
    } else {
      html = `${topBar}\n${html}`;
    }

    resHeaders.set("Content-Type", "text/html; charset=utf-8");
    return new NextResponse(html, {
      status: resp.status,
      headers: resHeaders,
    });
  }

  // For non-HTML binary / JS / CSS / images
  const buffer = await resp.arrayBuffer();
  return new NextResponse(buffer, {
    status: resp.status,
    headers: resHeaders,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ target: string; path?: string[] }> }
) {
  return handleProxy(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ target: string; path?: string[] }> }
) {
  return handleProxy(req, context);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ target: string; path?: string[] }> }
) {
  return handleProxy(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ target: string; path?: string[] }> }
) {
  return handleProxy(req, context);
}

export async function OPTIONS(
  req: NextRequest,
  context: { params: Promise<{ target: string; path?: string[] }> }
) {
  return handleProxy(req, context);
}
