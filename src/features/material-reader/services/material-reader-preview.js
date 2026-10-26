import { marked } from 'marked';

const PREVIEW_POLICY = [
  "default-src 'none'",
  'img-src data: blob:',
  'media-src data: blob:',
  "style-src 'unsafe-inline' data: blob:",
  "script-src 'unsafe-inline' data: blob:",
  'font-src data: blob:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function addPreviewPolicy(html, type) {
  const policy = type === 'markdown'
    ? PREVIEW_POLICY.replace("script-src 'unsafe-inline' data: blob:", "script-src 'none'")
    : PREVIEW_POLICY;
  const policyTag = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  const headTag = /<head(?:\s[^>]*)?>/i;
  if (headTag.test(html)) {
    return html.replace(headTag, (head) => `${head}${policyTag}`);
  }
  return `<!doctype html><html><head>${policyTag}</head><body>${html}</body></html>`;
}

function renderMaterialPreview(content, type) {
  const html = type === 'markdown'
    ? marked.parse(content, { async: false })
    : content;
  return addPreviewPolicy(html, type);
}

export { renderMaterialPreview };
