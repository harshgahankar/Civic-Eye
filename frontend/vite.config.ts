import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Serves finished pipeline videos without touching the backend:
 * GET /outputs/<file> -> <repo>/backend/data/videos/outputs/<file>
 * (mp4 only, traversal-guarded). This is what makes the Upload modal's
 * download button work in dev.
 */
function backendOutputs(): Plugin {
  const dir =
    process.env.CIVIC_OUTPUTS_DIR ??
    path.resolve(__dirname, '..', 'backend', 'data', 'videos', 'outputs');
  return {
    name: 'civiceye-outputs',
    configureServer(server) {
      server.middlewares.use('/outputs/', (req, res, next) => {
        if (!req.url) return next();
        const name = path.basename(decodeURIComponent(req.url.split('?')[0]));
        if (!/^[A-Za-z0-9._-]+\.mp4$/i.test(name)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const file = path.join(dir, name);
        fs.stat(file, (err, st) => {
          if (err || !st.isFile()) {
            res.statusCode = 404;
            res.end('not found');
            return;
          }
          const range = req.headers.range;
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
          if (range) {
            const m = /bytes=(\d*)-(\d*)/.exec(range);
            const start = m?.[1] ? parseInt(m[1], 10) : 0;
            const end = m?.[2] ? parseInt(m[2], 10) : st.size - 1;
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
            res.setHeader('Content-Length', end - start + 1);
            fs.createReadStream(file, { start, end }).pipe(res);
          } else {
            res.setHeader('Content-Length', st.size);
            fs.createReadStream(file).pipe(res);
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), backendOutputs()],
  server: {
    port: 5173,
  },
});
