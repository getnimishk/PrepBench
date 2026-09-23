// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * The parts of a written system-design answer, in the order an interviewer
 * expects them. The keys match backend/app/services/system_design_sections.py,
 * which refuses any other.
 */

export type SectionKey = 'requirements' | 'architecture' | 'data_model' | 'failure_handling' | 'trade_offs';

export type Sections = Record<SectionKey, string>;

export const SECTIONS: { key: SectionKey; label: string; placeholder: string }[] = [
  {
    key: 'requirements',
    label: 'Requirements & scale assumptions',
    placeholder: 'Users, requests per second, read/write mix, payload sizes, peak load, latency and availability targets…',
  },
  {
    key: 'architecture',
    label: 'High-level architecture',
    placeholder: 'The components — gateway, queues or streams, workers, stores, third parties — and how a request moves through them…',
  },
  {
    key: 'data_model',
    label: 'Data model & storage',
    placeholder: 'What is stored, how it is keyed and partitioned, indexes, retention…',
  },
  {
    key: 'failure_handling',
    label: 'Failure handling',
    placeholder: 'Partitions, a downstream outage, retries and their limits, dead letters, backpressure…',
  },
  {
    key: 'trade_offs',
    label: 'Trade-offs',
    placeholder: 'What you chose, what you gave up for it, and when you would choose differently…',
  },
];

export const emptySections = (): Sections => ({
  requirements: '', architecture: '', data_model: '', failure_handling: '', trade_offs: '',
});

/** Sections from the server, with any missing key filled in empty. */
export const toSections = (raw?: Partial<Record<string, string>> | null): Sections => {
  const out = emptySections();
  if (raw) {
    for (const s of SECTIONS) out[s.key] = raw[s.key] ?? '';
  }
  return out;
};

export const hasContent = (sections: Sections): boolean =>
  SECTIONS.some((s) => sections[s.key].trim().length > 0);
