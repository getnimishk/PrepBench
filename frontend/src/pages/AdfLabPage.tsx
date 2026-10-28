// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { LabHubPage } from '../components/adfLab/LabPages';
import { ADF_LAB } from '../services/adfLab/lab';

/**
 * /lab/adf -- the ADF Behaviour Lab's five experiments, for the ADF preparation being worked in.
 *
 * Reachable by its address while the lab is INTEGRATION_PENDING (for development and the
 * browser tests); Home, the sidebar and the Learning Lab hub do not offer it until it is live.
 */
export const AdfLabPage: React.FC = () => <LabHubPage lab={ADF_LAB} />;
