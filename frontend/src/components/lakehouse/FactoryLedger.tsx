// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { FACTORY_COUPLINGS } from '../../services/lakehouse/factoryCouplings';
import type { FactoryConfig } from '../../services/lakehouse/factoryModel';
import { CouplingLedger } from './CouplingLedger';

/** Station F's ledger, and the pack's teaching constants with the pack's own labels. */
export const FactoryLedger: React.FC<{ config: FactoryConfig }> = ({ config }) => (
  <CouplingLedger
    idPrefix="f"
    couplings={FACTORY_COUPLINGS}
    constants={Object.values(config.constantLabels)}
    intro="Every month and cost here is a teaching constant for a fictional scenario. None is an estimate of a real migration or a price."
  />
);
