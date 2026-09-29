// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

export interface SanitizeSvgResult {
  ok: boolean;
  reason?: string;
}

const MAX_SVG_LENGTH = 100_000;

const FORBIDDEN_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'animate',
  'set',
]);

/**
 * Validates inline SVG source against strict security rules.
 *
 * Rejects:
 * - over 100,000 characters
 * - not well-formed XML
 * - root element not svg
 * - any DOCTYPE or ENTITY
 * - script, foreignObject, iframe, embed, object, audio, video, animate and set elements
 * - any attribute starting with "on"
 * - any href or xlink:href not starting with "#"
 * - javascript: or data: values
 * - CSS url() other than url(#...)
 * - @import
 */
export function sanitizeSvg(source: string): SanitizeSvgResult {
  if (typeof source !== 'string') {
    return { ok: false, reason: 'Invalid input: SVG source must be a string' };
  }

  // 1. Length check
  if (source.length > MAX_SVG_LENGTH) {
    return { ok: false, reason: 'SVG exceeds maximum allowed length of 100,000 characters' };
  }

  // 2. Reject any DOCTYPE or ENTITY
  if (/<!\s*DOCTYPE/i.test(source)) {
    return { ok: false, reason: 'DOCTYPE declarations are not allowed' };
  }
  if (/<!\s*ENTITY/i.test(source) || /\bENTITY\b/i.test(source)) {
    return { ok: false, reason: 'ENTITY declarations are not allowed' };
  }

  // 3. Reject CSS @import anywhere early
  if (/@import\b/i.test(source)) {
    return { ok: false, reason: 'CSS @import is not allowed' };
  }

  // 4. XML well-formedness check using DOMParser
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(source, 'image/svg+xml');
  } catch (err) {
    return { ok: false, reason: `XML parse failure: ${err instanceof Error ? err.message : String(err)}` };
  }

  const parserError =
    doc.querySelector('parsererror') ||
    (doc.documentElement && doc.documentElement.nodeName.toLowerCase() === 'parsererror' ? doc.documentElement : null);

  if (parserError) {
    return { ok: false, reason: `Not well-formed XML: ${parserError.textContent?.trim() || 'Syntax error'}` };
  }

  // 5. Root element must be svg
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    return { ok: false, reason: 'Root element must be svg' };
  }

  // 6. Check all elements and their attributes
  const allElements = Array.from(doc.querySelectorAll('*'));
  // Ensure root is checked too
  const elementsToCheck: Element[] = [root, ...allElements.filter((el) => el !== root)];

  for (const el of elementsToCheck) {
    const tagName = el.localName.toLowerCase();

    // Forbidden elements
    if (FORBIDDEN_TAGS.has(tagName)) {
      return { ok: false, reason: `Forbidden element <${el.localName}>` };
    }

    // Check style tag text content
    if (tagName === 'style') {
      const css = el.textContent || '';
      if (/@import\b/i.test(css)) {
        return { ok: false, reason: 'CSS @import is not allowed in <style>' };
      }
      if (/(?:javascript|data)\s*:/i.test(css)) {
        return { ok: false, reason: 'Forbidden URI scheme in <style>' };
      }
      const urlRegex = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = urlRegex.exec(css)) !== null) {
        const urlTarget = urlMatch[2].trim();
        if (!urlTarget.startsWith('#')) {
          return { ok: false, reason: `Forbidden CSS url() target "${urlTarget}": only url(#...) is allowed` };
        }
      }
    }

    // Check attributes
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value;

      // Event handlers starting with "on"
      if (attrName.startsWith('on')) {
        return { ok: false, reason: `Forbidden event attribute "${attr.name}"` };
      }

      // javascript: or data: values
      if (/(?:javascript|data)\s*:/i.test(attrValue)) {
        return { ok: false, reason: `Forbidden URI scheme in attribute "${attr.name}"` };
      }

      // href or xlink:href not starting with "#"
      if (attrName === 'href' || attrName === 'xlink:href' || attr.localName.toLowerCase() === 'href') {
        const trimmedVal = attrValue.trim();
        if (!trimmedVal.startsWith('#')) {
          return { ok: false, reason: `Forbidden href target "${attrValue}": only local #fragment is allowed` };
        }
      }

      // Check CSS url() in style attribute or any presentation attribute
      if (attrName === 'style' || /url\s*\(/i.test(attrValue)) {
        if (/@import\b/i.test(attrValue)) {
          return { ok: false, reason: 'CSS @import is not allowed in attribute' };
        }
        const urlRegex = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
        let urlMatch: RegExpExecArray | null;
        while ((urlMatch = urlRegex.exec(attrValue)) !== null) {
          const urlTarget = urlMatch[2].trim();
          if (!urlTarget.startsWith('#')) {
            return { ok: false, reason: `Forbidden CSS url() target "${urlTarget}": only url(#...) is allowed` };
          }
        }
      }
    }
  }

  return { ok: true };
}
