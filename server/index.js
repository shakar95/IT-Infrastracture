import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import boqRoutes from './routes/boq.routes.js';
import devicesRoutes from './routes/devices.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import mapsRoutes from './routes/maps.routes.js';
import aiRoutes from './routes/ai.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import racksRoutes from './routes/racks.routes.js';
import { mockProjectSettings } from './services/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' })); // High limit for base64 OCR camera photos
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan('dev'));

// Project Settings & Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    project: 'Iraq Sitak Villa Project - IT & ELV Infrastructure Manager',
    time: new Date().toISOString(),
  });
});

app.get('/api/settings', (req, res) => {
  res.json(mockProjectSettings);
});

// Mount Feature Routes
app.use('/api/boq', boqRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/racks', racksRoutes);

// Serve Frontend Build in production or unified preview mode
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log(`📦 Serving React frontend from: ${clientDistPath}`);
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=================================================================`);
  console.log(`🏰 Iraq Sitak Villa Project - ELV & IT Infrastructure API`);
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`📡 Ready for React Frontend Dashboard & Mobile Camera Scanner`);
  console.log(`=================================================================`);
});
