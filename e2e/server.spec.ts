import { expect, test } from "@playwright/test";

test("/healthz は ok を返す", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe("ok");
});

test("画面のパスを直接開くと index.html を返す（SPA のフォールバック）", async ({
  request,
}) => {
  for (const path of ["/", "/editor", "/preview"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    expect(res.headers()["cache-control"]).toBe("no-cache");
    expect(await res.text()).toContain('<div id="root"></div>');
  }
});

test("セキュリティヘッダーを付ける", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
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
  const src = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
  expect(src).toBeTruthy();
  const res = await request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("immutable");
  expect(res.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  expect((await request.get("/assets/nothing.js")).status()).toBe(404);
});
