/** Shared action helpers: real downloads + print. No new deps. */

function esc(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

/** Triggers a genuine CSV file download in the browser. */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Opens the browser print dialog (used by dossier/report actions). */
export function printPage() {
  window.print();
}

export function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
