import { expect, test } from "@playwright/test";

test("/healthz は ok を返す", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe("ok");
});

test("ページは事前に作った HTML を返す（末尾の / はあってもなくてもよい）。ないページは 404", async ({ request }) => {
  for (const [path, title] of <[string, string][]>[
    ["/", "MyFontStudio"],
    ["/editor", "入力"],
    ["/editor/", "入力"],
    ["/preview/", "プレビュー"],
  ]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    expect(res.headers()["cache-control"]).toBe("no-cache");
    expect(await res.text()).toContain(`<title>${title}`);
  }
  const missing = await request.get("/nothing");
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("ページが見つかりません");
});

test("使い方ページの説明は HTML に書き出してある（JavaScript なしでも読める）", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("手書きフォントを作ろう");
});

test("セキュリティヘッダーを付ける", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  // インラインのスクリプトはハッシュで許可する（'unsafe-inline' にはしない）
  expect(h["content-security-policy"]).toMatch(/script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')+;/);
  expect(h["content-security-policy"]).not.toContain("unsafe-inline");
  expect(h["content-security-policy"]).toContain("connect-src 'self'");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["server"]).toBe("nginx");
});

test("ビルド成果物は長くキャッシュし、ないファイルは 404", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  const src = /src="(\/_next\/static\/[^"]+\.js)"/.exec(html)?.[1];
  expect(src).toBeTruthy();
  const res = await request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("immutable");
  expect(res.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  expect((await request.get("/_next/static/nothing.js")).status()).toBe(404);
});
