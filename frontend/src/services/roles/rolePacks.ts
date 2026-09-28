// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { getContentPack, getContentPacks, getSubject } from '../api';
import type { ContentPackDetail } from '../../types/contentPack';
import type { Role } from '../../types/role';

/** These pack versions, each fetched once. */
export async function loadPackVersions(versions: { packId: string; version: number }[]): Promise<ContentPackDetail[]> {
  const unique = [...new Map(versions.map((v) => [`${v.packId}@${v.version}`, v])).values()];
  return Promise.all(unique.map((v) => getContentPack(v.packId, v.version)));
}

/**
 * The packs of the Skills the learner confirmed as evidence for this role's
 * requirements, at the versions those Skills pinned (D9). Fetched per subject,
 * so a linked Skill that has since been archived still counts.
 */
export async function loadLinkedPacks(role: Pick<Role, 'requirements'>): Promise<ContentPackDetail[]> {
  const subjectIds = [...new Set(role.requirements.map((r) => r.subject_id).filter((id): id is number => id != null))];
  const subjects = await Promise.all(subjectIds.map((id) => getSubject(id).catch(() => null)));
  // One version per pack: two linked Skills pinning the same pack at different
  // versions would otherwise ask the same question twice. The newer one wins.
  const newest = new Map<string, number>();
  for (const cp of subjects.flatMap((s) => s?.content_packs ?? [])) {
    newest.set(cp.pack_id, Math.max(newest.get(cp.pack_id) ?? 0, cp.pack_version));
  }
  return loadPackVersions([...newest].map(([packId, version]) => ({ packId, version })));
}

/** Every shipped pack at its latest version: the core set the diagnostic fills from. */
export async function loadCorePacks(): Promise<ContentPackDetail[]> {
  const summaries = await getContentPacks();
  return loadPackVersions(summaries.map((s) => ({ packId: s.pack_id, version: s.latest_version })));
}
