import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DB_PATH } from './db.js';
import offerings from './routes/offerings.js';
import investors from './routes/investors.js';
import subscriptions from './routes/subscriptions.js';
import escrow from './routes/escrow.js';
import tasks from './routes/tasks.js';
import reconciliations from './routes/reconciliations.js';
import dashboard from './routes/dashboard.js';
import backup from './routes/backup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// This is a single-user local tool. Bind to localhost only so it is never
// exposed to the network.
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 4000;

// API
app.use('/api/offerings', offerings);
app.use('/api/investors', investors);
app.use('/api/dashboard', dashboard);
app.use('/api/backup', backup);
// Routers that mix nested (/offerings/:id/...) and flat (/thing/:id) paths.
app.use('/api', subscriptions);
app.use('/api', escrow);
app.use('/api', tasks);
app.use('/api', reconciliations);

// Static frontend
app.use(express.static(join(__dirname, '..', 'public')));

// Central error handler so malformed JSON etc. return clean messages.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, HOST, () => {
  console.log('\n  Muniment is running.');
  console.log(`  Open your browser to:  http://${HOST}:${PORT}`);
  console.log(`  Database file:         ${DB_PATH}`);
  console.log('\n  Press Ctrl+C to stop.\n');
});
