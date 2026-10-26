import { describe, expect, it } from 'vitest';
import { renderMaterialPreview } from '@/features/material-reader/services/material-reader-preview.js';

describe('material reader preview rendering', () => {
  it('adds a restrictive policy to interactive HTML previews', () => {
    const preview = renderMaterialPreview('<html><head></head><body>Study</body></html>', 'html');

    expect(preview).toContain("default-src 'none'");
    expect(preview).toContain("connect-src 'none'");
    expect(preview).toContain("script-src 'unsafe-inline' data: blob:");
  });

  it('renders Markdown and blocks scripts from embedded raw HTML', () => {
    const preview = renderMaterialPreview('# Notes\n\n<script>alert(1)</script>', 'markdown');

    expect(preview).toContain('<h1>Notes</h1>');
    expect(preview).toContain("script-src 'none'");
    expect(preview).not.toContain("script-src 'unsafe-inline'");
  });
});
