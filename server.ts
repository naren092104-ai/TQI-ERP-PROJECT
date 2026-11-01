import express from 'express';
import application from './backend/src/server.js';

// Vercel discovers this root Express entrypoint and serves the bundled SPA assets
// from /public while all /api/* routes are handled by the existing backend app.
const app = express();
app.use(application);

export default app;
