/** Escape a DB/user-sourced string before it is interpolated into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Minimal branded HTML email: escaped app name, optional logo, escaped body with <br>. */
export function renderBrandedEmail(input: {
  body: string;
  appName?: string | null;
  logoUrl?: string | null;
}): string {
  const appName = input.appName ? escapeHtml(input.appName) : "";
  const logo = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${appName}" />`
    : "";
  const title = appName ? `<h1>${appName}</h1>` : "";
  const body = escapeHtml(input.body).replace(/\r?\n/g, "<br>");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${logo}${title}<div>${body}</div></body></html>`;
}
