// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { getLakehousePack } from '../api';
import { loadSourceIndex } from '../lakehouse/sourceIndex';
import { parseAdf, type AdfConfig, type SourceRow } from '../lakehouse/adfModel';

/**
 * The data the Lakehouse Lab's ADF model runs on: the semiconductor-v1 pack's pipeline content
 * and its real source index (the only lab pack with a pipeline.json). Read through the existing
 * Lakehouse endpoints; the Watermark and Trigger experiments share it.
 */
export const MODEL_PACK = 'semiconductor-v1';

export interface PipelineContext {
  config: AdfConfig;
  index: SourceRow[];
  /** The pack's own note on its figures ("fictional teaching constants…"). */
  note?: string;
}

export async function loadPipelineContext(): Promise<PipelineContext> {
  const pack = await getLakehousePack(MODEL_PACK);
  const parsed = parseAdf(pack.pipeline);
  if (!parsed.ok) throw new Error(`The model's pipeline content is unusable: ${parsed.reason}`);
  const index = await loadSourceIndex(pack.id, pack.version, parsed.config.table);
  const note = (pack.pipeline as { note?: unknown } | undefined)?.note;
  return { config: parsed.config, index, note: typeof note === 'string' ? note : undefined };
}
