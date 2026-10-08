// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { describe, expect, it } from 'vitest';
import adfPack from '../../../../backend/app/content/packs/adf/v1.json';
import { ADF_LAB_EXPERIMENTS, PERSISTENCE, adfLabExperiment, adfLabStatus, hasAdfPack, tracksOf } from './experiments';
import { DEFINITIONS } from './definitions';

interface Block { heading?: string; md?: string }
const chapters = (adfPack as { chapters: { id: string; title: string; blocks: Block[] }[] }).chapters;

// The pack's own "Roadmap alignment" lines -- "- **Topic 32 — Watermark Patterns** (Full)" --
// read the way content_pack_service.get_pack_roadmap_alignments reads them.
const ALIGNED = /-\s+\*\*Topic\s+(\d+)\s+[—–-]\s+([^*]+)\*\*/g;
const alignment = new Map<string, string>();
for (const ch of chapters) {
  for (const b of ch.blocks) {
    if (b.heading !== 'Roadmap alignment' || !b.md) continue;
    for (const m of b.md.matchAll(ALIGNED)) alignment.set(`${ch.id}#${m[1]}`, m[2].trim());
  }
}

describe('the ADF Behaviour Lab registry', () => {
  it('is the five experiments the contract froze, and no sixth', () => {
    expect(ADF_LAB_EXPERIMENTS.map((e) => e.slug)).toEqual(['watermark', 'triggers', 'concurrency', 'copy-perf', 'fault-tolerance']);
  });

  it('links only chapters the ADF pack has, under their own titles', () => {
    const titles = new Map(chapters.map((c) => [c.id, c.title]));
    for (const e of ADF_LAB_EXPERIMENTS) {
      for (const c of e.chapters) expect(titles.get(c.id), `${e.slug}: ${c.id}`).toBe(c.title);
    }
  });

  it('links only topics the pack aligns with one of the experiment’s own chapters, under the pack’s titles', () => {
    for (const e of ADF_LAB_EXPERIMENTS) {
      for (const t of e.topics) {
        const found = e.chapters.map((c) => alignment.get(`${c.id}#${t.number}`)).find(Boolean);
        expect(found, `${e.slug}: topic ${t.number}`).toBe(t.title);
      }
    }
  });

  it('gives every experiment its model, the eight stages and its persistence', () => {
    for (const e of ADF_LAB_EXPERIMENTS) {
      expect(e.model, e.slug).toMatch(/Model/);
      expect([...e.stages]).toEqual(['Understand', 'Predict', 'Manipulate', 'Observe', 'Reason', 'Apply', 'Explain', 'Retrieve']);
    }
    expect(PERSISTENCE).toMatch(/learning_attempts through LearningService/);
  });

  it('has a definition for every track of every built experiment, and none for anything else', () => {
    for (const e of ADF_LAB_EXPERIMENTS) {
      const defs = DEFINITIONS[e.slug] ?? [];
      if (!e.ready) continue;
      expect(defs.map((d) => d.track), e.slug).toEqual(tracksOf(e));
    }
    expect(Object.keys(DEFINITIONS).sort()).toEqual(ADF_LAB_EXPERIMENTS.map((e) => e.slug).sort());
  });

  it('runs Fault Tolerance as one experiment with exactly two fault modes, and nothing else with modes', () => {
    expect(ADF_LAB_EXPERIMENTS.filter((e) => e.tracks).map((e) => e.slug)).toEqual(['fault-tolerance']);
    expect(adfLabExperiment('fault-tolerance')!.tracks!.map((t) => t.id)).toEqual(['dependency', 'bad-rows']);
  });

  it('finds experiments by slug, and nothing for an unknown one', () => {
    expect(adfLabExperiment('watermark')?.title).toBe('Watermark & Transient Failure');
    expect(adfLabExperiment('dependencies')).toBeNull();
    expect(adfLabExperiment(undefined)).toBeNull();
  });

  it('is for a preparation with the ADF pack attached, and no other', () => {
    expect(hasAdfPack({ content_packs: [{ pack_id: 'adf' }] })).toBe(true);
    expect(hasAdfPack({ content_packs: [{ pack_id: 'adls' }] })).toBe(false);
    expect(hasAdfPack({ content_packs: [] })).toBe(false);
    expect(hasAdfPack(null)).toBe(false);
  });
});

describe('the lab’s availability follows the registry', () => {
  it('is AVAILABLE once all five experiments are built', () => {
    expect(ADF_LAB_EXPERIMENTS.every((e) => e.ready)).toBe(true);
    expect(adfLabStatus()).toBe('AVAILABLE');
  });

  it('stays INTEGRATION_PENDING while any one experiment is not built', () => {
    for (let i = 0; i < ADF_LAB_EXPERIMENTS.length; i += 1) {
      const incomplete = ADF_LAB_EXPERIMENTS.map((e, j) => (j === i ? { ...e, ready: false } : e));
      expect(adfLabStatus(incomplete), ADF_LAB_EXPERIMENTS[i].slug).toBe('INTEGRATION_PENDING');
    }
  });

  it('stays INTEGRATION_PENDING with fewer or more than the five', () => {
    expect(adfLabStatus(ADF_LAB_EXPERIMENTS.slice(0, 4))).toBe('INTEGRATION_PENDING');
    expect(adfLabStatus([...ADF_LAB_EXPERIMENTS, { ...ADF_LAB_EXPERIMENTS[0], slug: 'watermark' }])).toBe('INTEGRATION_PENDING');
  });
});
