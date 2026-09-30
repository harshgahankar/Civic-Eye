import { useMemo } from 'react';
import { mockArchivedIncidents, mockIncidents } from '../data/mockIncidents';
import { useIncidentStore } from '../store/incidentStore';

export function useIncidents() {
  const { selectedId, severityFilter, statusFilter, setSelected } = useIncidentStore();
  const incidents = useMemo(() => {
    return mockIncidents.filter((i) => {
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      return true;
    });
  }, [severityFilter, statusFilter]);
  const selected = mockIncidents.find((i) => i.id === selectedId) ?? incidents[0] ?? null;
  return { incidents, archived: mockArchivedIncidents, selected, selectedId, setSelected };
}
