// Ambient types carried over from the Pages Functions codebase.
// Netlify's bundler erases types without checking them; this file only
// exists so editors / a future `tsc` stay quiet. It is never deployed
// as an endpoint (support files under functions/*/ are not endpoints).

declare type PagesFunction<E = any> = (context: {
  request: Request
  env: E
  params: Record<string, string>
  waitUntil: (p: Promise<unknown>) => void
}) => Promise<Response> | Response

declare type KVNamespace = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}
