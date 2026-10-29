// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { ADF_LAB_IDS, type LabIds } from './attempts';
import { ADF_LAB_EXPERIMENTS, ADF_PACK_ID, adfLabStatus, type LabExperiment } from './experiments';

/**
 * A lab built on the shared experiment runner (components/adfLab/ExperimentRunner.tsx): which pack
 * it belongs to, how its attempts are named, where it lives and what it calls itself. The ADF
 * Behaviour Lab was the first; the Kafka Lab (services/kafkaLab/lab.ts) is the second. The runner,
 * the gate and the pages read everything lab-specific from here, never from a hard-coded name.
 */
export interface LabSpec {
  /** The content pack a preparation must have attached for the lab to apply to it. */
  packId: string;
  ids: LabIds;
  /** The lab's name, as every screen says it. */
  name: string;
  /** How the screens refer to the pack's guide ("the ADF guide"). */
  guideName: string;
  /** The guide's full name ("Azure Data Factory guide"). */
  guideTitle: string;
  /** The hub's path; an experiment is `${basePath}/${slug}`. */
  basePath: string;
  experiments: LabExperiment[];
  /** What the simulation is and isn't, said on every experiment. */
  simulation: string;
  /** Who the lab is for, said when the chosen preparation doesn't have the pack. */
  forWhom: string;
  /** The hub's one-line introduction. */
  hubIntro: string;
  status: () => 'AVAILABLE' | 'INTEGRATION_PENDING';
}

export const ADF_LAB: LabSpec = {
  packId: ADF_PACK_ID,
  ids: ADF_LAB_IDS,
  name: 'ADF Behaviour Lab',
  guideName: 'the ADF guide',
  guideTitle: 'Azure Data Factory guide',
  basePath: '/lab/adf',
  experiments: ADF_LAB_EXPERIMENTS,
  simulation: 'Teaching simulation. PrepBench runs a model of this pipeline in your browser, over the fictional '
    + 'semiconductor-v1 data. Nothing runs in Azure Data Factory, and no figure here is a measurement.',
  forWhom: 'an Azure Data Factory preparation',
  hubIntro: 'Predict how an Azure Data Factory pipeline behaves, change it, watch a teaching model respond, and explain why. '
    + 'Every stage is recorded against this preparation.',
  status: () => adfLabStatus(),
};

/** Does this preparation have the lab's pack attached? The lab is only for one that does. */
export const hasLabPack = (lab: LabSpec, prep: { content_packs?: { pack_id: string }[] } | null | undefined): boolean =>
  Boolean(prep?.content_packs?.some((cp) => cp.pack_id === lab.packId));
