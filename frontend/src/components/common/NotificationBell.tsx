// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getNotifications } from '../../services/api';
import { HeaderAction } from './HeaderAction';

/**
 * The header's Alerts button, with the count of notifications on its corner.
 *
 * Re-read on every navigation, because the things that clear a notification --
 * reviewing a miss, sitting a mock -- happen on other screens. When the count
 * cannot be read there is no badge at all, rather than a zero that claims
 * nothing needs you.
 */
export const NotificationBell: React.FC = () => {
  const location = useLocation();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((items) => { if (!cancelled) setCount(items.length); })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
  }, [location.pathname]);

  const label = count == null
    ? 'Alerts'
    : count === 0
      ? 'Alerts: nothing needs you'
      : `Alerts: ${count} ${count === 1 ? 'needs' : 'need'} you`;

  return <HeaderAction label="Alerts" ariaLabel={label} icon={<Bell size={16} />} badge={count} to="/notifications" />;
};
