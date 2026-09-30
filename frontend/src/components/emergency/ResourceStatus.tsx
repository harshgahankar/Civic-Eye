export function ResourceStatus() {
  // No response-unit registry exists in the backend: render an empty state
  // instead of invented availability numbers.
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant pb-space-sm">RESOURCE STATUS</p>
      <p className="font-body-sm text-on-surface-variant">No response units registered.</p>
    </div>
  );
}

export default ResourceStatus;
