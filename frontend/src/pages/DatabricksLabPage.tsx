// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { LabExperimentPage, LabHubPage } from '../components/adfLab/LabPages';
import { DATABRICKS_LAB } from '../services/databricksLab/lab';
import { DATABRICKS_DEFINITIONS } from '../services/databricksLab/definitions';

/** /lab/databricks -- the Databricks Lab's six experiments, for a preparation with the Databricks guide attached. */
export const DatabricksLabPage: React.FC = () => <LabHubPage lab={DATABRICKS_LAB} />;

/** /lab/databricks/:slug -- one Databricks Lab experiment through the shared runner (?mode= for Governance's two modes). */
export const DatabricksExperimentPage: React.FC = () => <LabExperimentPage lab={DATABRICKS_LAB} definitions={DATABRICKS_DEFINITIONS} />;
