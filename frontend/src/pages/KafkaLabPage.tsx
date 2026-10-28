// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React from 'react';
import { LabExperimentPage, LabHubPage } from '../components/adfLab/LabPages';
import { KAFKA_LAB } from '../services/kafkaLab/lab';
import { KAFKA_DEFINITIONS } from '../services/kafkaLab/definitions';

/** /lab/kafka -- the Kafka Lab's six experiments, for a preparation with the Kafka guide attached. */
export const KafkaLabPage: React.FC = () => <LabHubPage lab={KAFKA_LAB} />;

/** /lab/kafka/:slug -- one Kafka Lab experiment through the shared runner (?mode= for Failures' two modes). */
export const KafkaExperimentPage: React.FC = () => <LabExperimentPage lab={KAFKA_LAB} definitions={KAFKA_DEFINITIONS} />;
