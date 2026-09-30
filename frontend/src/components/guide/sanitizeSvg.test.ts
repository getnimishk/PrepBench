// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './sanitizeSvg';

describe('sanitizeSvg', () => {
  it('accepts a valid SVG', () => {
    const valid = `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1">
            <stop offset="0%" stop-color="#fff" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill="url(#grad1)" />
        <a href="#section-1"><text x="10" y="20">Valid SVG text</text></a>
      </svg>
    `.trim();

    const result = sanitizeSvg(valid);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects source over 100,000 characters', () => {
    const large = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'x'.repeat(100_001)} --></svg>`;
    const result = sanitizeSvg(large);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/100,000 characters/i);
  });

  it('rejects not well-formed XML', () => {
    const broken = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50"></svg>';
    const result = sanitizeSvg(broken);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Not well-formed XML/i);
  });

  it('rejects when root element is not svg', () => {
    const nonSvg = '<div xmlns="http://www.w3.org/1999/xhtml"><svg></svg></div>';
    const result = sanitizeSvg(nonSvg);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Root element must be svg/i);
  });

  it('rejects DOCTYPE declaration', () => {
    const withDoctype = `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
      <svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const result = sanitizeSvg(withDoctype);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/DOCTYPE/i);
  });

  it('rejects ENTITY declaration', () => {
    const withEntity = `<!ENTITY xxe SYSTEM "file:///etc/passwd">
      <svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const result = sanitizeSvg(withEntity);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ENTITY/i);
  });

  it('rejects script elements', () => {
    const withScript = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const result = sanitizeSvg(withScript);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <script>/i);
  });

  it('rejects foreignObject elements', () => {
    const withFo = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><div>evil</div></foreignObject></svg>';
    const result = sanitizeSvg(withFo);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <foreignObject>/i);
  });

  it('rejects iframe elements', () => {
    const withIframe = '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="https://example.com"></iframe></svg>';
    const result = sanitizeSvg(withIframe);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <iframe>/i);
  });

  it('rejects embed elements', () => {
    const withEmbed = '<svg xmlns="http://www.w3.org/2000/svg"><embed src="file.swf" /></svg>';
    const result = sanitizeSvg(withEmbed);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <embed>/i);
  });

  it('rejects object elements', () => {
    const withObject = '<svg xmlns="http://www.w3.org/2000/svg"><object data="file.swf"></object></svg>';
    const result = sanitizeSvg(withObject);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <object>/i);
  });

  it('rejects audio elements', () => {
    const withAudio = '<svg xmlns="http://www.w3.org/2000/svg"><audio src="sound.mp3"></audio></svg>';
    const result = sanitizeSvg(withAudio);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <audio>/i);
  });

  it('rejects video elements', () => {
    const withVideo = '<svg xmlns="http://www.w3.org/2000/svg"><video src="movie.mp4"></video></svg>';
    const result = sanitizeSvg(withVideo);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <video>/i);
  });

  it('rejects animate elements', () => {
    const withAnimate = '<svg xmlns="http://www.w3.org/2000/svg"><rect><animate attributeName="x" from="0" to="10" /></rect></svg>';
    const result = sanitizeSvg(withAnimate);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <animate>/i);
  });

  it('rejects set elements', () => {
    const withSet = '<svg xmlns="http://www.w3.org/2000/svg"><rect><set attributeName="x" to="10" /></rect></svg>';
    const result = sanitizeSvg(withSet);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden element <set>/i);
  });

  it('rejects attributes starting with "on"', () => {
    const withOnload = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
    const result = sanitizeSvg(withOnload);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden event attribute "onload"/i);

    const withOnclick = '<svg xmlns="http://www.w3.org/2000/svg"><circle onclick="alert(2)" /></svg>';
    const result2 = sanitizeSvg(withOnclick);
    expect(result2.ok).toBe(false);
    expect(result2.reason).toMatch(/Forbidden event attribute "onclick"/i);
  });

  it('rejects href not starting with "#"', () => {
    const withHref = '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.com"><text>click</text></a></svg>';
    const result = sanitizeSvg(withHref);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden href target/i);
  });

  it('rejects xlink:href not starting with "#"', () => {
    const withXlink = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="http://example.com/icon.svg" /></svg>';
    const result = sanitizeSvg(withXlink);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden href target/i);
  });

  it('rejects javascript: values in attributes', () => {
    const withJs = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>click</text></a></svg>';
    const result = sanitizeSvg(withJs);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden URI scheme/i);
  });

  it('rejects data: values in attributes', () => {
    const withData = '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,iVBORw0KGgo=" /></svg>';
    const result = sanitizeSvg(withData);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden URI scheme/i);
  });

  it('rejects CSS url() other than url(#...)', () => {
    const withExtUrlStyle = '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background: url(\'https://example.com/bg.png\')" /></svg>';
    const result = sanitizeSvg(withExtUrlStyle);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Forbidden CSS url\(\) target/i);

    const withExtUrlAttr = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(http://example.com/grad)" /></svg>';
    const result2 = sanitizeSvg(withExtUrlAttr);
    expect(result2.ok).toBe(false);
    expect(result2.reason).toMatch(/Forbidden CSS url\(\) target/i);

    const withExtUrlTag = '<svg xmlns="http://www.w3.org/2000/svg"><style>.bg { fill: url("http://evil.com"); }</style></svg>';
    const result3 = sanitizeSvg(withExtUrlTag);
    expect(result3.ok).toBe(false);
    expect(result3.reason).toMatch(/Forbidden CSS url\(\) target/i);
  });

  it('rejects @import in CSS', () => {
    const withImportTag = '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("evil.css");</style></svg>';
    const result = sanitizeSvg(withImportTag);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/@import/i);

    const withImportAttr = '<svg xmlns="http://www.w3.org/2000/svg"><rect style="@import \'evil.css\';" /></svg>';
    const result2 = sanitizeSvg(withImportAttr);
    expect(result2.ok).toBe(false);
    expect(result2.reason).toMatch(/@import/i);
  });

  it('accepts the word "Entity" in a label (an ER diagram) but still rejects a real ENTITY declaration', () => {
    const label = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text x="4" y="20">Entity: Customer</text></svg>';
    expect(sanitizeSvg(label).ok).toBe(true);
    expect(sanitizeSvg('<!ENTITY x "y"><svg xmlns="http://www.w3.org/2000/svg"/>').ok).toBe(false);
  });

  it('accepts an attribute whose text merely contains "data:" or "javascript:" in the middle', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><g aria-label="Metadata: flow of javascript: events"><rect width="10" height="10"/></g></svg>';
    expect(sanitizeSvg(svg).ok).toBe(true);
  });

  it('still rejects a value that starts with a scripting or data scheme, and protocol-relative or relative hrefs', () => {
    const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;
    expect(sanitizeSvg(wrap('<rect fill="  javascript:alert(1)" width="1" height="1"/>')).ok).toBe(false);
    expect(sanitizeSvg(wrap('<rect fill="data:text/html,x" width="1" height="1"/>')).ok).toBe(false);
    expect(sanitizeSvg(wrap('<image href="//evil.example/x.png" width="5" height="5"/>')).ok).toBe(false);
    expect(sanitizeSvg(wrap('<image href="x.png" width="5" height="5"/>')).ok).toBe(false);
  });
});
