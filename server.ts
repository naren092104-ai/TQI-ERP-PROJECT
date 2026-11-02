import application from './backend/src/server.js';

// Export the backend Express app directly so Vercel sees its registered routes.
// The app serves the bundled SPA from /public and handles all /api/* requests.
export default application;
