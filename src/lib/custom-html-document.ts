/** Wrap server-sanitized HTML/CSS in a scriptless document for sandboxed previews. */
export const CUSTOM_HTML_CONTENT_CSP =
  "default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline' https:; img-src 'self' https: data:; font-src 'self' https:; media-src 'self' https: data:; connect-src 'none'; form-action 'none'; frame-src 'none';";

/**
 * Policy for the public custom page sandbox, which executes the admin-authored
 * custom JavaScript alongside the sanitized HTML and validated CSS. Inline
 * scripts run, but external script sources, eval, and off-origin network
 * access stay blocked; connect-src 'self' only allows same-origin requests.
 */
export const CUSTOM_HTML_PUBLIC_PAGE_CSP =
  "default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; img-src 'self' https: data:; font-src 'self' https:; media-src 'self' https: data:; connect-src 'self'; form-action 'none'; frame-src 'none';";

export function customHtmlDocument(html: string, css: string) {
  const safeStyle = css.replace(/<\s*\/\s*style/gi, "<\\/style");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${CUSTOM_HTML_CONTENT_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,Arial,sans-serif;color:#202738}body{padding:12px;overflow-wrap:anywhere}${safeStyle}</style></head><body>${html}</body></html>`;
}
