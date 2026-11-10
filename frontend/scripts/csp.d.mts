// csp.mjs の型（E2E から読むため）
export function htmlFiles(root: string): string[];
export function inlineScriptHashes(root: string): string[];
export function contentSecurityPolicy(scriptSrc: string, options?: { meta?: boolean }): string;
