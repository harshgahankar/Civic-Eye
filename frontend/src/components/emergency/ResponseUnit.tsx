export interface Unit {
  id: string;
  type: string;
  status: string;
  eta: string;
}

export function ResponseUnit({ unit }: { unit: Unit }) {
  const u: Unit = unit;
  return (
    <tr className="border-b border-outline-variant font-data-mono-md text-on-surface">
      <td className="px-space-sm py-space-xs">{u.id}</td>
      <td className="px-space-sm py-space-xs">{u.type}</td>
      <td className="px-space-sm py-space-xs">{u.eta}</td>
      <td className="px-space-sm py-space-xs font-label-caps text-secondary">{u.status}</td>
    </tr>
  );
}

export default ResponseUnit;
