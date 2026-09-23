// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import { useSyncExternalStore } from 'react';
import { connection, type ConnectionState } from '../services/connection';

/** Whether the server is answering, re-rendering when that changes. */
export const useConnection = (): ConnectionState =>
  useSyncExternalStore(connection.subscribe, connection.get, connection.get);
