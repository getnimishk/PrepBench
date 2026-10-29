// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { LabExperimentPage } from '../components/adfLab/LabPages';
import { ADF_LAB } from '../services/adfLab/lab';
import { DEFINITIONS } from '../services/adfLab/definitions';

/**
 * /lab/adf/:slug -- one ADF Behaviour Lab experiment, through the shared runner. Only built
 * experiments open; the others say so rather than showing an empty page, and an unknown slug
 * says it is unknown. An experiment with fault modes (Fault Tolerance) takes ?mode= to pick
 * one: each mode is its own eight-stage run of the one experiment.
 */
export const AdfExperimentPage: React.FC = () => <LabExperimentPage lab={ADF_LAB} definitions={DEFINITIONS} />;
