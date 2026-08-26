import { describe, it, expect } from 'vitest';
import { resolveProgramName } from './utils.js';

describe('resolveProgramName', () => {
  it('returns zoominfo when invoked via the zoominfo npm bin shim (argv[1])', () => {
    expect(resolveProgramName(['/usr/local/bin/node', '/usr/local/bin/zoominfo'])).toBe('zoominfo');
  });

  it('returns zoominfo when invoked as a compiled binary named zoominfo (argv[0])', () => {
    expect(resolveProgramName(['/opt/homebrew/bin/zoominfo', 'companies'])).toBe('zoominfo');
  });

  it('matches Windows shim extensions via the startsWith check', () => {
    expect(resolveProgramName(['C:\\node.exe', 'zoominfo.cmd'])).toBe('zoominfo');
    expect(resolveProgramName(['zoominfo.exe', 'companies'])).toBe('zoominfo');
  });

  it('is case-insensitive', () => {
    expect(resolveProgramName(['/usr/local/bin/node', '/usr/local/bin/ZoomInfo'])).toBe('zoominfo');
  });

  it('defaults to gtm for the canonical bin', () => {
    expect(resolveProgramName(['/usr/local/bin/node', '/usr/local/bin/gtm'])).toBe('gtm');
  });

  it('defaults to gtm for dev runs and unrecognized names', () => {
    expect(resolveProgramName(['/usr/local/bin/node', 'src/index.ts'])).toBe('gtm');
    expect(resolveProgramName(['bun', '/repo/src/index.ts'])).toBe('gtm');
    expect(resolveProgramName([])).toBe('gtm');
  });

  it('only matches on the basename, not the full path', () => {
    expect(resolveProgramName(['/usr/local/bin/node', '/home/zoominfo/bin/gtm'])).toBe('gtm');
  });

  it('ignores user arguments beyond argv[1]', () => {
    expect(resolveProgramName(['/usr/local/bin/node', '/usr/local/bin/gtm', 'zoominfo'])).toBe('gtm');
  });
});
