import { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

const MODEL_URL = '/models/yolo11n.onnx';
const INPUT = 640;
const CONFIDENCE = 0.4;
const IOU = 0.45;

const COCO = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog',
  'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella',
  'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite',
  'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant',
  'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors',
  'teddy bear', 'hair drier', 'toothbrush',
];

const KEEP = new Set([
  'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
  'backpack', 'handbag', 'suitcase', 'dining table',
]);

export interface LiveBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  confidence: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    sessionPromise.catch(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

function preprocess(video: HTMLVideoElement): { tensor: ort.Tensor; scale: number; dx: number; dy: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.min(INPUT / vw, INPUT / vh);
  const nw = Math.round(vw * scale);
  const nh = Math.round(vh * scale);
  const dx = Math.floor((INPUT - nw) / 2);
  const dy = Math.floor((INPUT - nh) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = INPUT;
  canvas.height = INPUT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, INPUT, INPUT);
  ctx.drawImage(video, dx, dy, nw, nh);
  const img = ctx.getImageData(0, 0, INPUT, INPUT).data;
  const data = new Float32Array(3 * INPUT * INPUT);
  for (let i = 0; i < INPUT * INPUT; i++) {
    data[i] = img[i * 4] / 255;
    data[INPUT * INPUT + i] = img[i * 4 + 1] / 255;
    data[2 * INPUT * INPUT + i] = img[i * 4 + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', data, [1, 3, INPUT, INPUT]), scale, dx, dy };
}

function decode(
  out: Float32Array, scale: number, dx: number, dy: number, vw: number, vh: number,
): LiveBox[] {
  const boxes: LiveBox[] = [];
  const STRIDE = 8400;
  for (let i = 0; i < STRIDE; i++) {
    let best = 0;
    let cls = -1;
    for (let c = 0; c < 80; c++) {
      const s = out[(4 + c) * STRIDE + i];
      if (s > best) { best = s; cls = c; }
    }
    if (best < CONFIDENCE || cls < 0) continue;
    const label = COCO[cls];
    if (!KEEP.has(label)) continue;
    const cx = out[i];
    const cy = out[STRIDE + i];
    const w = out[2 * STRIDE + i];
    const h = out[3 * STRIDE + i];
    const x1 = (cx - w / 2 - dx) / scale;
    const y1 = (cy - h / 2 - dy) / scale;
    boxes.push({
      x: Math.max(0, x1), y: Math.max(0, y1),
      w: Math.min(vw - x1, w / scale), h: Math.min(vh - y1, h / scale),
      label, confidence: best,
    });
  }
  // NMS
  boxes.sort((a, b) => b.confidence - a.confidence);
  const keep: LiveBox[] = [];
  for (const b of boxes) {
    let dup = false;
    for (const k of keep) {
      if (k.label !== b.label) continue;
      const ix1 = Math.max(b.x, k.x);
      const iy1 = Math.max(b.y, k.y);
      const ix2 = Math.min(b.x + b.w, k.x + k.w);
      const iy2 = Math.min(b.y + b.h, k.y + k.h);
      const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
      const union = b.w * b.h + k.w * k.h - inter;
      if (union > 0 && inter / union > IOU) { dup = true; break; }
    }
    if (!dup) keep.push(b);
  }
  return keep.slice(0, 30);
}

/**
 * Runs YOLO11n in-browser (WASM) over a playing <video> and draws boxes
 * onto an overlay <canvas>. No backend involved.
 */
export function useBrowserDetect(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  active: boolean,
) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [fps, setFps] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    getSession().then(
      () => { if (!cancelled) setStatus('ready'); },
      () => { if (!cancelled) setStatus('error'); },
    );
    return () => { cancelled = true; };
  }, [active]);

  useEffect(() => {
    if (!active || status !== 'ready') return;
    let cancelled = false;
    let last = performance.now();
    let frames = 0;

    const loop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
        if (!cancelled) setTimeout(loop, 300);
        return;
      }
      try {
        const session = await getSession();
        const { tensor, scale, dx, dy } = preprocess(video);
        const feeds: Record<string, ort.Tensor> = {};
        feeds[session.inputNames[0]] = tensor;
        const results = await session.run(feeds);
        const out = results[session.outputNames[0]].data as Float32Array;
        const boxes = decode(out, scale, dx, dy, video.videoWidth, video.videoHeight);
        if (!cancelled) {
          setCount(boxes.length);
          draw(canvas, video, boxes);
        }
      } catch {
        if (!cancelled) setStatus('error');
        return;
      }
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        if (!cancelled) setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      if (!cancelled) setTimeout(loop, 120);
    };
    loop();
    return () => { cancelled = true; };
  }, [active, status, videoRef, canvasRef]);

  return { status, fps, count };
}

function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, boxes: LiveBox[]) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, vw, vh);
  ctx.lineWidth = Math.max(2, vw / 320);
  ctx.font = `${Math.max(14, vw / 42)}px monospace`;
  for (const b of boxes) {
    const color = b.label === 'person' ? '#22c55e' : '#f59e0b';
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    const text = `${b.label.toUpperCase()} ${(b.confidence * 100).toFixed(0)}%`;
    const tw = ctx.measureText(text).width;
    const th = Math.max(16, vw / 36);
    ctx.fillStyle = color;
    ctx.fillRect(b.x, Math.max(0, b.y - th - 4), tw + 12, th + 4);
    ctx.fillStyle = '#000';
    ctx.fillText(text, b.x + 6, Math.max(th - 2, b.y - 6));
  }
}
