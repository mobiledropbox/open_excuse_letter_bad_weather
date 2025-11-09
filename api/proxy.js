export default async function handler(req, res) {
  try {
    // 🧭 Use the full subdirectory path — very important!
    const targetUrl = "https://noah.up.edu.ph/noah-studio/";
    const target = new URL(targetUrl);

    // If a ?url= param exists, proxy that directly
    if (req.query.url) {
      const realUrl = decodeURIComponent(req.query.url);
      const assetRes = await fetch(realUrl, {
        headers: { "User-Agent": req.headers["user-agent"] || "vercel-proxy" },
        redirect: "follow",
      });

      const buffer = Buffer.from(await assetRes.arrayBuffer());
      const ct = assetRes.headers.get("content-type");
      if (ct) res.setHeader("content-type", ct);
      const cc = assetRes.headers.get("cache-control");
      if (cc) res.setHeader("cache-control", cc);
      res.status(assetRes.status).send(buffer);
      return;
    }

    // Otherwise, fetch the main HTML page
    const fetchRes = await fetch(target.href, {
      headers: { "User-Agent": req.headers["user-agent"] || "vercel-proxy" },
      redirect: "follow",
    });

    const contentType = fetchRes.headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      let text = await fetchRes.text();

      // 🧩 Inject <base> and viewport
      const baseTag = `<base href="${target.href}">`;
      const injectedHead = `
        ${baseTag}
        <meta name="viewport" content="width=device-width,initial-scale=1">
      `;
      text = text.replace(/<head(\s|>)/i, (m) => `${m}${injectedHead}`);

      // 🧠 Smarter link rewriter: handles relative + subdirectory paths
      text = text.replace(
        /(src|href)=["'](?!https?:\/\/)([^"'>]+)["']/gi,
        (m, attr, path) => {
          if (path.startsWith("#") || path.startsWith("data:")) return m;

          const fullUrl = new URL(path, target.href).href;
          return `${attr}="/api/proxy?url=${encodeURIComponent(fullUrl)}"`;
        }
      );

      // 🔁 Rewrite fully qualified URLs from same host
      const hostPattern = new RegExp(
        `(src|href)=["'](${target.origin.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}[^"']*)["']`,
        "gi"
      );
      text = text.replace(
        hostPattern,
        (m, attr, full) =>
          `${attr}="/api/proxy?url=${encodeURIComponent(full)}"`
      );

      // 🖼 Handle srcset
      text = text.replace(/srcset=["']([^"']*)["']/gi, (m, s) => {
        const replaced = s.replace(/(https?:\/\/[^,\s]+|\/[^,\s]+)/g, (urlItem) => {
          const absolute = new URL(urlItem, target.href).href;
          return `/api/proxy?url=${encodeURIComponent(absolute)}`;
        });
        return `srcset="${replaced}"`;
      });

      // 📏 Inject iframe resize script
      const sizeScript = `
        <script>
          (function(){
            function sendSize(){
              try {
                var w = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0) || 1200;
                var h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0) || 800;
                parent.postMessage({ type: 'proxied-size', width: w, height: h }, '*');
              } catch(e){}
            }
            window.addEventListener('load', function(){
              sendSize();
              setTimeout(sendSize, 500);
              setTimeout(sendSize, 1500);
            });
            try {
              var mo = new MutationObserver(function(){ sendSize(); });
              mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
            } catch(e){}
            window.addEventListener('message', function(ev){
              if(ev && ev.data && ev.data.type === 'request-size') sendSize();
            });
            sendSize();
          })();
        </script>
      `;

      text = text.includes("</body>")
        ? text.replace("</body>", sizeScript + "</body>")
        : text + sizeScript;

      // 🚫 Remove blocking meta tags
      text = text.replace(
        /<meta[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi,
        ""
      );
      text = text.replace(
        /<meta[^>]*http-equiv=["']x-frame-options["'][^>]*>/gi,
        ""
      );

      // ✅ Send HTML back
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(text);
      return;
    }

    // 🧱 Fallback for non-HTML
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    const ct = fetchRes.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);
    const cc = fetchRes.headers.get("cache-control");
    if (cc) res.setHeader("cache-control", cc);
    res.status(fetchRes.status).send(buffer);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy error: " + String(err));
  }
}
