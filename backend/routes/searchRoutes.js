import express from 'express';
import { suggest } from '../controllers/searchController.js';

const router = express.Router();
router.get('/suggest', suggest);

export default router;
