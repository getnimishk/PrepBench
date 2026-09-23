// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { SettingsSubpage } from '../../components/settings/SettingsSubpage';
import { AIProvidersSection } from '../../components/settings/AIProvidersSection';
import { TaskRoutingSection } from '../../components/settings/TaskRoutingSection';

/** AI providers, and which of them answers each task. */
export const AISettingsPage: React.FC = () => (
  <SettingsSubpage
    title="AI providers"
    description="Practice runs without AI. A provider is optional, chosen per task, and a local one keeps everything on this machine. With none, grading shows Not graded rather than a made-up score."
  >
    <AIProvidersSection />
    <TaskRoutingSection />
  </SettingsSubpage>
);
