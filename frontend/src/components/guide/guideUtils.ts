// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { createContext } from 'react';

export const ALLOWED_MERMAID_TYPES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'stateDiagram-v2',
  'stateDiagram',
  'classDiagram',
  'erDiagram',
] as const;

export const MAX_MERMAID_LENGTH = 20_000;

export function extractMermaidAlt(source: string): string {
  let title = '';
  let descr = '';

  const titleMatch = source.match(/^[ \t]*accTitle:[ \t]*(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  const descrSingle = source.match(/^[ \t]*accDescr:[ \t]*(.+)$/m);
  if (descrSingle) {
    descr = descrSingle[1].trim();
  } else {
    const descrMulti = source.match(/^[ \t]*accDescr[ \t]*\{([^}]+)\}/m);
    if (descrMulti) {
      descr = descrMulti[1].trim();
    }
  }

  if (title && descr) {
    return `${title} - ${descr}`;
  }
  if (title) return title;
  if (descr) return descr;
  return 'Diagram, no description provided';
}

export function validateMermaidSource(source: string): { valid: true } | { valid: false; reason: string } {
  if (typeof source !== 'string') {
    return { valid: false, reason: 'Invalid input: diagram source must be a string' };
  }

  if (source.length > MAX_MERMAID_LENGTH) {
    return { valid: false, reason: 'Diagram source exceeds 20,000 characters' };
  }

  const lines = source.split('\n');
  const firstNonEmpty = lines.find((l) => l.trim().length > 0)?.trim() ?? '';
  if (!firstNonEmpty) {
    return { valid: false, reason: 'Diagram source is empty' };
  }

  const firstToken = firstNonEmpty.split(/\s+/)[0];
  if (!ALLOWED_MERMAID_TYPES.includes(firstToken as (typeof ALLOWED_MERMAID_TYPES)[number])) {
    return {
      valid: false,
      reason: `Diagram type "${firstToken}" is not supported. Supported types: flowchart, graph, sequenceDiagram, stateDiagram-v2, stateDiagram, classDiagram, erDiagram.`,
    };
  }

  return { valid: true };
}

let renderQueue = Promise.resolve();
let renderCounter = 0;

export function queueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const next = renderQueue.then(task, task);
  renderQueue = next.then(
    () => {},
    () => {},
  );
  return next;
}

export function getNextMermaidId(): string {
  renderCounter += 1;
  return `pb-mermaid-${Date.now()}-${renderCounter}`;
}

export function extractSvgAlt(source: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'image/svg+xml');
    const title = doc.querySelector('svg > title')?.textContent?.trim();
    const desc = doc.querySelector('svg > desc')?.textContent?.trim();
    if (title && desc) return `${title} - ${desc}`;
    if (title) return title;
    if (desc) return desc;
  } catch {
    // Parser error fallback
  }

  const titleMatch = source.match(/accTitle:\s*(.+)$/m);
  const descMatch = source.match(/accDescr:\s*(.+)$/m);
  if (titleMatch && descMatch) {
    return `${titleMatch[1].trim()} - ${descMatch[1].trim()}`;
  }
  if (titleMatch) return titleMatch[1].trim();
  if (descMatch) return descMatch[1].trim();

  return 'Diagram, no description provided';
}

// Eagerly resolve bundled guide images
const bundledImageModules = import.meta.glob<string>(
  '../../assets/guide/*.{svg,png,jpg,jpeg,webp}',
  { eager: true, query: '?url', import: 'default' },
);

export const GUIDE_IMAGE_MAP: Record<string, string> = {};
for (const [path, url] of Object.entries(bundledImageModules)) {
  const filename = path.split('/').pop();
  if (filename) {
    GUIDE_IMAGE_MAP[filename] = url;
  }
}

export const PreContext = createContext(false);
