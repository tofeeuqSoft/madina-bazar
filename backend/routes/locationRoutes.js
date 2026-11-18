import express from 'express';
import {
  autocomplete,
  reverseGeocode,
  locationStatus,
} from '../controllers/locationController.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.get('/status', locationStatus);
router.get('/autocomplete', searchLimiter, autocomplete);
router.get('/reverse', searchLimiter, reverseGeocode);

export default router;
