export interface AnalysisInput {
  title: string;
  confidence: number;
  detail: string;
}

export function AIAnalysis({ analysis }: { analysis?: AnalysisInput }) {
  if (!analysis) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
        <p className="font-label-caps text-on-surface-variant">INFERENCE ENGINE</p>
        <p className="font-body-md text-on-surface-variant pt-space-xs">
          No inference summary available for this incident.
        </p>
      </section>
    );
  }
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant">INFERENCE ENGINE</p>
      <h3 className="font-headline-md text-on-surface">{analysis.title} · conf {analysis.confidence.toFixed(1)}%</h3>
      <p className="font-body-md text-on-surface pt-space-xs">{analysis.detail}</p>
    </section>
  );
}

export default AIAnalysis;
