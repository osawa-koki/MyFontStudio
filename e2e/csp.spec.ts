import { expect, test } from "@playwright/test";
import { contentSecurityPolicy } from "../frontend/scripts/csp.mjs";

// CSP の中身は frontend/scripts/csp.mjs の contentSecurityPolicy() だけに書く。
// Nginx（Docker・Render）のヘッダーと、GitHub Pages の <meta> が、それと完全に一致することを確かめる（ブラウザによらないので Chromium だけ）
const pages = !!process.env.PAGES;

test("CSP は scripts/csp.mjs と同じ（Nginx はヘッダー、GitHub Pages は <meta>）", async ({
  request,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "ブラウザによらない");
  const res = await request.get("./");
  const html = await res.text();
  const policy = pages
    ? /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1]
    : res.headers()["content-security-policy"];
  expect(policy).toBeTruthy();
  // script-src のハッシュはビルドごとに変わるので、ヘッダーから取って同じ形で作り直す
  const scriptSrc = /(?:^|; )script-src ([^;]+)/.exec(policy!)?.[1];
  expect(scriptSrc).toMatch(/^'self'( 'sha256-[A-Za-z0-9+/=]+')+$/);
  expect(policy).toBe(contentSecurityPolicy(scriptSrc!, { meta: pages }));
});
