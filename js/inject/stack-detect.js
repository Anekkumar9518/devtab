// Runs in the page's own JavaScript world (so it can see window.React,
// jQuery's version, gtag and the rest), looks at scripts, meta tags, cookies
// and the response headers, and returns what the site is built with.
(async () => {
  const found = new Map();
  const add = (name, cat, how, version) => { if (!found.has(name)) found.set(name, { name, cat, how, version: version || "" }); else if (version && !found.get(name).version) found.get(name).version = version; };
  const W = window, D = document;
  const html = D.documentElement.outerHTML.slice(0, 1500000);
  const srcs = [...D.scripts].map((s) => s.src).filter(Boolean).join("\n") + "\n" + [...D.querySelectorAll("link[href]")].map((l) => l.href).join("\n");
  const inline = [...D.scripts].filter((s) => !s.src).map((s) => s.textContent).join("\n").slice(0, 800000);
  const gen = (D.querySelector('meta[name="generator" i]') || {}).content || "";
  const has = (re) => re.test(srcs);
  const inl = (re) => re.test(inline);
  const q = (sel) => { try { return D.querySelector(sel); } catch (e) { return null; } };
  const ver = (re, s = srcs + inline) => { const m = re.exec(s); return m ? m[1] : ""; };

  // ---- CMS & site builders
  if (/wordpress/i.test(gen) || has(/\/wp-(content|includes)\//)) add("WordPress", "CMS", "wp-content files", ver(/WordPress ([\d.]+)/i, gen) || ver(/ver=([\d.]+)/, srcs.match(/wp-includes[^\n]*/)?.[0] || ""));
  if (W.Shopify || has(/cdn\.shopify\.com/)) add("Shopify", "E-commerce", "Shopify object / CDN");
  if (has(/woocommerce/i) || q(".woocommerce, body.woocommerce-page")) add("WooCommerce", "E-commerce", "WooCommerce scripts");
  if (/wix\.com/i.test(gen) || has(/static\.(wixstatic|parastorage)\.com/)) add("Wix", "CMS", "Wix static files");
  if (has(/squarespace(-cdn)?\.com/) || W.Static?.SQUARESPACE_CONTEXT) add("Squarespace", "CMS", "Squarespace assets");
  if (q("html[data-wf-site]") || has(/webflow/i)) add("Webflow", "CMS", "data-wf-site");
  if (/ghost/i.test(gen)) add("Ghost", "CMS", "generator tag", ver(/Ghost ([\d.]+)/i, gen));
  if (W.Drupal || /drupal/i.test(gen)) add("Drupal", "CMS", "Drupal object", ver(/Drupal ([\d.]+)/i, gen));
  if (/joomla/i.test(gen)) add("Joomla", "CMS", "generator tag");
  if (has(/framerusercontent|framer\.com\/m\//)) add("Framer", "CMS", "Framer assets");
  if (/blogger/i.test(gen)) add("Blogger", "CMS", "generator tag");
  if (W.Mage || has(/\/static\/version\d+\/frontend\//)) add("Magento", "E-commerce", "Magento static paths");
  if (W.BCData || has(/bigcommerce\.com/)) add("BigCommerce", "E-commerce", "BigCommerce data");
  if (W.prestashop) add("PrestaShop", "E-commerce", "prestashop object");
  if (has(/hs-sites\.com|hubspotusercontent/)) add("HubSpot CMS", "CMS", "HubSpot assets");
  if (/elementor/i.test(gen) || has(/elementor/)) add("Elementor", "Page builder", "Elementor files", ver(/elementor[^\n]*ver=([\d.]+)/i));
  if (has(/divi|et-core/i)) add("Divi", "Page builder", "Divi assets");
  if (/Yoast SEO/i.test(html)) add("Yoast SEO", "SEO", "Yoast comment", ver(/Yoast SEO (?:plugin )?v?([\d.]+)/i, html));
  if (/Rank Math/i.test(html)) add("Rank Math", "SEO", "Rank Math comment");
  if (/All in One SEO/i.test(html)) add("All in One SEO", "SEO", "AIOSEO comment");

  // ---- JavaScript frameworks
  const anyEl = D.body ? [D.body, ...D.body.querySelectorAll("div, main, section, #root, #app, #__next")].slice(0, 400) : [];
  if (W.React || anyEl.some((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactContainer") || k === "_reactRootContainer"))) add("React", "JavaScript framework", "React internals on the DOM", W.React?.version);
  if (W.__NEXT_DATA__ || W.next || has(/\/_next\/static\//)) add("Next.js", "JavaScript framework", "_next/static", W.next?.version);
  if (W.__VUE__ || W.Vue || q("[data-v-app]") || anyEl.some((el) => el.__vue_app__ || el.__vue__)) add("Vue.js", "JavaScript framework", "Vue app", W.Vue?.version);
  if (W.__NUXT__ || W.$nuxt || has(/\/_nuxt\//)) add("Nuxt", "JavaScript framework", "_nuxt files");
  const ng = q("[ng-version]"); if (ng || W.ng) add("Angular", "JavaScript framework", "ng-version", ng?.getAttribute("ng-version"));
  if (q('[class*="svelte-"]')) add("Svelte", "JavaScript framework", "svelte-* classes");
  if (W.__sveltekit || has(/\/_app\/immutable\//)) add("SvelteKit", "JavaScript framework", "_app/immutable");
  if (q("#___gatsby")) add("Gatsby", "JavaScript framework", "#___gatsby");
  if (W.__remixContext) add("Remix", "JavaScript framework", "__remixContext");
  if (q("astro-island") || has(/\/_astro\//)) add("Astro", "JavaScript framework", "astro-island");
  if (q("[q\\:container]")) add("Qwik", "JavaScript framework", "q:container");
  if (W.Ember) add("Ember.js", "JavaScript framework", "Ember object", W.Ember.VERSION);
  if (W.preact || q("[data-preact]")) add("Preact", "JavaScript framework", "preact");
  if (W.jQuery || W.$?.fn?.jquery) add("jQuery", "JavaScript library", "jQuery object", (W.jQuery || W.$)?.fn?.jquery);
  if (W.Alpine) add("Alpine.js", "JavaScript library", "Alpine object", W.Alpine.version);
  if (W.htmx) add("htmx", "JavaScript library", "htmx object", W.htmx.version);
  if (W.gsap) add("GSAP", "Animation", "gsap object", W.gsap.version);
  if (W.THREE) add("Three.js", "3D / WebGL", "THREE object", W.THREE.REVISION ? "r" + W.THREE.REVISION : "");
  if (W.lottie || q("lottie-player, dotlottie-player")) add("Lottie", "Animation", "lottie");
  if (W.Swiper || q(".swiper")) add("Swiper", "JavaScript library", "Swiper");
  if (W._ && W._.VERSION) add("Lodash", "JavaScript library", "lodash", W._.VERSION);
  if (W.Sentry || W.__SENTRY__) add("Sentry", "Monitoring", "Sentry SDK");

  // ---- UI & fonts
  if ([...D.styleSheets].some((s) => { try { return [...s.cssRules].slice(0, 400).some((r) => r.cssText.includes("--tw-")); } catch (e) { return false; } }) || q('[class*="tw-"]')) add("Tailwind CSS", "UI framework", "--tw- variables");
  if (W.bootstrap || has(/bootstrap(\.min)?\.(css|js)/)) add("Bootstrap", "UI framework", "Bootstrap files", W.bootstrap?.Tooltip?.VERSION || ver(/bootstrap@([\d.]+)/));
  if (q('[class*="MuiButton"], [class*="MuiBox"]')) add("Material UI", "UI framework", "Mui classes");
  if (q('[class*="chakra-"]')) add("Chakra UI", "UI framework", "chakra classes");
  if (has(/fonts\.googleapis\.com|fonts\.gstatic\.com/)) add("Google Fonts", "Fonts", "fonts.googleapis.com");
  if (has(/use\.typekit\.net|p\.typekit\.net/)) add("Adobe Fonts", "Fonts", "typekit");
  if (has(/font-?awesome/i) || q(".fa, .fas, .fa-solid")) add("Font Awesome", "Fonts", "Font Awesome");

  // ---- analytics, ads & marketing
  const tags = (re) => [...new Set((srcs + inline).match(re) || [])].slice(0, 3).join(", ");
  if (W.google_tag_manager || has(/googletagmanager\.com\/gtm\.js/)) add("Google Tag Manager", "Tag manager", tags(/GTM-[A-Z0-9]{4,9}/g) || "gtm.js");
  if (W.gtag || W.ga || has(/google-analytics\.com|googletagmanager\.com\/gtag/)) add("Google Analytics", "Analytics", tags(/\bG-[A-Z0-9]{6,12}\b|UA-\d{4,10}-\d+/g) || "gtag");
  if (/AW-\d{6,12}/.test(srcs + inline) || has(/googleadservices|googlesyndication|doubleclick\.net/)) add("Google Ads", "Advertising", tags(/AW-\d{6,12}/g) || "ads scripts");
  if (W.adsbygoogle || has(/pagead2\.googlesyndication/)) add("Google AdSense", "Advertising", "adsbygoogle");
  if (W.fbq || has(/connect\.facebook\.net/)) add("Meta Pixel", "Advertising", "fbq" + (inl(/fbq\(['"]init['"],\s*['"](\d+)/) ? " · ID " + ver(/fbq\(['"]init['"],\s*['"](\d+)/, inline) : ""));
  if (W.ttq) add("TikTok Pixel", "Advertising", "ttq");
  if (W._linkedin_partner_id || has(/snap\.licdn\.com/)) add("LinkedIn Insight", "Advertising", "LinkedIn tag");
  if (W.twq) add("X (Twitter) Pixel", "Advertising", "twq");
  if (W.snaptr) add("Snap Pixel", "Advertising", "snaptr");
  if (W.pintrk) add("Pinterest Tag", "Advertising", "pintrk");
  if (W.hj || has(/static\.hotjar\.com/)) add("Hotjar", "Analytics", "hotjar");
  if (W.clarity || has(/clarity\.ms/)) add("Microsoft Clarity", "Analytics", "clarity");
  if (W.mixpanel) add("Mixpanel", "Analytics", "mixpanel");
  if (W.amplitude) add("Amplitude", "Analytics", "amplitude");
  if (W.analytics?.identify && has(/segment\.(com|io)/)) add("Segment", "Analytics", "analytics.js");
  if (W._paq || has(/matomo/)) add("Matomo", "Analytics", "_paq");
  if (W.plausible || has(/plausible\.io/)) add("Plausible", "Analytics", "plausible");
  if (W.ym || has(/mc\.yandex\.ru/)) add("Yandex Metrica", "Analytics", "ym");
  if (W._hsq || has(/js\.hs-scripts\.com|js\.hsforms\.net/)) add("HubSpot", "Marketing", "HubSpot scripts");
  if (has(/klaviyo/)) add("Klaviyo", "Marketing", "klaviyo");
  if (has(/chimpstatic|mailchimp/)) add("Mailchimp", "Marketing", "mailchimp");
  if (W.OneSignal || has(/onesignal/)) add("OneSignal", "Marketing", "OneSignal");
  // chat & support
  if (W.Intercom) add("Intercom", "Live chat", "Intercom");
  if (W.$crisp) add("Crisp", "Live chat", "$crisp");
  if (W.Tawk_API) add("Tawk.to", "Live chat", "Tawk_API");
  if (W.zE || W.zEmbed) add("Zendesk", "Live chat", "zE");
  if (W.drift) add("Drift", "Live chat", "drift");
  if (W.fcWidget) add("Freshchat", "Live chat", "fcWidget");
  // payments
  if (W.Razorpay || has(/checkout\.razorpay\.com/)) add("Razorpay", "Payments", "Razorpay");
  if (W.Stripe || has(/js\.stripe\.com/)) add("Stripe", "Payments", "Stripe.js");
  if (W.paypal || has(/paypal\.com\/sdk/)) add("PayPal", "Payments", "PayPal SDK");
  if (W.Cashfree || has(/cashfree/)) add("Cashfree", "Payments", "Cashfree");
  if (has(/paytm/)) add("Paytm", "Payments", "Paytm");
  // embeds & security
  if (W.grecaptcha || has(/recaptcha/)) add("reCAPTCHA", "Security", "grecaptcha");
  if (W.hcaptcha) add("hCaptcha", "Security", "hcaptcha");
  if (W.turnstile || has(/challenges\.cloudflare\.com/)) add("Cloudflare Turnstile", "Security", "turnstile");
  if (W.google?.maps || has(/maps\.googleapis\.com/)) add("Google Maps", "Maps", "maps API");
  if (q('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie"]')) add("YouTube embed", "Video", "embedded player");
  if (q('iframe[src*="player.vimeo.com"]')) add("Vimeo embed", "Video", "embedded player");
  if (q("html[amp]") || D.documentElement.hasAttribute("⚡")) add("AMP", "Performance", "amp attribute");
  if (q('link[rel="manifest"]') && navigator.serviceWorker?.controller) add("PWA", "Performance", "manifest + service worker");
  if (q('script[type="application/ld+json"]')) add("Schema.org (JSON-LD)", "SEO", `${D.querySelectorAll('script[type="application/ld+json"]').length} block(s)`);
  if (q('meta[property="og:title"]')) add("Open Graph", "SEO", "og: tags");

  // ---- hosting & server, from this page's response headers
  try {
    const r = await fetch(location.href, { method: "HEAD", credentials: "include", cache: "no-store" });
    const h = (k) => (r.headers.get(k) || "").toLowerCase(), server = h("server"), pw = h("x-powered-by"), via = h("via");
    if (h("cf-ray") || server.includes("cloudflare")) add("Cloudflare", "CDN & hosting", "cf-ray header");
    if (h("x-vercel-id") || server.includes("vercel")) add("Vercel", "CDN & hosting", "x-vercel-id");
    if (h("x-nf-request-id") || server.includes("netlify")) add("Netlify", "CDN & hosting", "Netlify header");
    if (h("x-amz-cf-id") || via.includes("cloudfront")) add("Amazon CloudFront", "CDN & hosting", "CloudFront header");
    if (h("x-served-by").includes("cache-") || h("x-fastly-request-id")) add("Fastly", "CDN & hosting", "Fastly header");
    if (server.includes("akamai") || h("x-akamai-transformed")) add("Akamai", "CDN & hosting", "Akamai header");
    if (server.includes("github.com")) add("GitHub Pages", "CDN & hosting", "server: GitHub.com");
    if (h("platform").includes("hostinger") || h("x-hostinger")) add("Hostinger", "CDN & hosting", "platform header");
    if (h("x-shopify-stage") || h("x-shopid")) add("Shopify", "E-commerce", "Shopify header");
    if (h("x-wix-request-id")) add("Wix", "CMS", "Wix header");
    if (server.includes("nginx")) add("Nginx", "Web server", "server header", ver(/nginx\/([\d.]+)/, server));
    if (server.includes("apache")) add("Apache", "Web server", "server header", ver(/apache\/([\d.]+)/, server));
    if (server.includes("litespeed")) add("LiteSpeed", "Web server", "server header");
    if (server.includes("microsoft-iis")) add("IIS", "Web server", "server header");
    if (server.includes("gws") || server.includes("esf")) add("Google servers", "Web server", "server header");
    if (pw.includes("php")) add("PHP", "Language", "x-powered-by", ver(/php\/([\d.]+)/, pw));
    if (pw.includes("express")) add("Express", "Language", "x-powered-by");
    if (pw.includes("asp.net") || h("x-aspnet-version")) add("ASP.NET", "Language", "x-powered-by");
    if (pw.includes("next.js")) add("Next.js", "JavaScript framework", "x-powered-by");
  } catch (e) { /* some sites refuse HEAD requests */ }

  return { url: location.href, host: location.hostname.replace(/^www\./, ""), techs: [...found.values()] };
})();
