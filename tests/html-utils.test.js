import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../src/lib/html-utils.js';

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(escapeHtml('Tom & Jerry "quotes"')).toBe('Tom &amp; Jerry &quot;quotes&quot;');
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
