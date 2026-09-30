import VerificationPanel from '../../components/ai/VerificationPanel';
import DetectionPipeline from '../../components/ai/DetectionPipeline';
import AIConfidence from '../../components/ai/AIConfidence';

export function AIVerificationPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <p className="font-label-caps text-on-surface-variant">MACHINE FINDINGS &middot; HUMAN IN LOOP</p>
        <h1 className="font-headline-xl text-on-surface">AI VERIFICATION</h1>
      </header>
      <DetectionPipeline />
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <VerificationPanel />
        <AIConfidence value={98.2} />
      </div>
      <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md font-data-mono-md text-on-surface">
        <p className="font-label-caps text-on-surface-variant">PENDING QUEUE</p>
        <p className="pt-space-xs">DET-5001 · Vehicle collision · CAM-07 · awaiting verifier</p>
        <p>DET-5003 · Unattended baggage · CAM-12 · awaiting verifier</p>
      </section>
    </div>
  );
}

export default AIVerificationPage;
