// routes/api.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const logger = require('../logger');
const Bill = require('../model/Bill'); // used for /vehicle-details
// Rate limit and validation are implemented without extra deps.

const STATE_FIELDS_FILE = path.join(__dirname, '..', 'data', 'state-fields.json');
const STATE_ALIAS_MAP = { kerela: 'kerala', kerala: 'kerala', madhyapradesh: 'mp', madhya: 'mp' };

let stateFields = {};
if (fs.existsSync(STATE_FIELDS_FILE)) {
  try {
    stateFields = JSON.parse(fs.readFileSync(STATE_FIELDS_FILE, 'utf8'));
  } catch (err) {
    logger.warn('[api] failed to load state-fields.json:', err.message);
  }
}

const canonicalState = (stateKey = '') => {
  const safe = String(stateKey || '').toLowerCase();
  return STATE_ALIAS_MAP[safe] || safe;
};

const buildDetailSkeleton = (detail = {}) => {
  const defaults = {
    vehicleNo: '',
    state: '',
    chassisNo: '',
    mobileNo: '',
    ownerName: '',
    borderBarrier: '',
    checkpostName: '',
    checkPostName: '',
    seatingCapacityExcludingDriver: '',
    serviceType: '',
    taxMode: '',
  };

  const merged = { ...defaults, ...detail };
  merged.checkpostName = merged.checkpostName || merged.checkPostName;
  merged.checkPostName = merged.checkPostName || merged.checkpostName;
  return merged;
};

/* ------------------------------
   Simple in-memory rate limiter
   ------------------------------
   Keeps a small Map of IP => { count, start }
   Default: 100 reqs per 15 minutes (configurable)
*/
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // max requests per window per IP
const rateMap = new Map();

// periodic cleanup to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap.entries()) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS * 2) {
      rateMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// rate limiting middleware
const rateLimiter = (req, res, next) => {
  try {
    const ip = (req.ip || req.connection.remoteAddress || 'unknown').toString();
    const now = Date.now();
    let entry = rateMap.get(ip);
    if (!entry) {
      entry = { count: 1, start: now };
      rateMap.set(ip, entry);
      return next();
    }
    if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
      // reset window
      entry.count = 1;
      entry.start = now;
      rateMap.set(ip, entry);
      return next();
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
      // Too many requests
      const retryAfter = Math.ceil((entry.start + RATE_LIMIT_WINDOW_MS - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
      });
    }
    return next();
  } catch (err) {
    // on error, do not block requests
    logger.error('[api] rateLimiter error', err);
    return next();
  }
};

// Apply rate limiter to all API routes
router.use(rateLimiter);

/* ------------------------------
   Helper: input validation
   ------------------------------ */
const validateVehicleNo = (vehicleNo) => {
  if (!vehicleNo || typeof vehicleNo !== 'string') return false;
  const vn = vehicleNo.trim();
  if (vn.length < 2 || vn.length > 50) return false;
  return true;
};

const validateGetDetailsPayload = (req, res, next) => {
  try {
    const vehicleNo = (req.body && req.body.vehicleNo) || '';
    if (!validateVehicleNo(vehicleNo)) {
      return res.status(400).json({ success: false, message: 'vehicleNo is required and must be valid' });
    }
    // optional: validate state if present
    if (req.body && req.body.state) {
      req.body.state = canonicalState(req.body.state);
    }
    return next();
  } catch (err) {
    logger.error('[api] validateGetDetailsPayload error', err);
    return res.status(500).json({ success: false, message: 'validation error' });
  }
};

/* ------------------------------
   API endpoints
   ------------------------------ */

// Simple API root for health/visibility
router.get('/', (req, res) => {
  res.json({ success: true, message: 'API root', timestamp: Date.now() });
});

// GET /api/fields
router.get('/fields', (req, res) => {
  try {
    const states = Object.keys(stateFields || {}).sort();
    return res.json({ success: true, fields: stateFields, states });
  } catch (err) {
    logger.error('[api] /fields error', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// GET /api/fields/:state
router.get('/fields/:state', (req, res) => {
  try {
    const canonical = canonicalState(req.params.state);
    const payload = stateFields[canonical];
    if (!payload) {
      return res.status(404).json({ success: false, message: 'State not found', state: canonical });
    }
    res.json({ success: true, state: canonical, fields: payload });
  } catch (err) {
    logger.error('[api] /fields/:state error', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// GET /api/fields/:state/checkposts?district=...
router.get('/fields/:state/checkposts', (req, res) => {
  try {
    const canonical = canonicalState(req.params.state);
    const district = (req.query.district || '').trim().toLowerCase();
    const stateObj = stateFields[canonical] || {};
    const list = stateObj.checkPostName || [];
    let normalized = [];

    if (list.length && typeof list[0] === 'string') {
      normalized = list.map((name) => ({ name, district: '' }));
    } else {
      normalized = list.map((p) => ({
        name: p && p.name ? p.name : (p || ''),
        district: p && p.district ? String(p.district).toLowerCase() : '',
      }));
    }

    const filtered = district ? normalized.filter((p) => p.district === district) : normalized;
    res.json({ success: true, checkposts: filtered });
  } catch (err) {
    logger.error('[api] /fields/:state/checkposts error', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// GET /api/vehicle-details?vehicleNo=...
router.get('/vehicle-details', async (req, res) => {
  try {
    const vehicleNo = (req.query.vehicleNo || '').toString().trim();
    if (!validateVehicleNo(vehicleNo)) {
      return res.status(400).json({ success: false, message: 'vehicleNo is required and must be valid' });
    }

    // Query the Bill collection for the latest matching vehicleNo
    const bill = await Bill.findOne({ vehicleNo: vehicleNo }).sort({ createdAt: -1 }).lean();

    if (!bill) {
      // return safe skeleton
      const detail = buildDetailSkeleton({ vehicleNo });
      return res.json({ success: true, detail });
    }

    // Map DB fields to response shape
    const detail = buildDetailSkeleton({
      vehicleNo: bill.vehicleNo || vehicleNo,
      state: bill.state || '',
      chassisNo: bill.chassisNo || '',
      mobileNo: bill.mobileNo || '',
      ownerName: bill.ownerName || '',
      borderBarrier: bill.borderBarrier || '',
      checkpostName: bill.checkpostName || bill.checkPostName || '',
      seatingCapacityExcludingDriver: bill.seatingCapacityExcludingDriver || '',
      serviceType: bill.serviceType || '',
      taxMode: bill.taxMode || '',
    });

    return res.json({ success: true, detail });
  } catch (err) {
    logger.error('[api] vehicle-details error', err);
    return res.status(500).json({ success: false, message: 'internal error' });
  }
});

// POST /api/get-details
router.post('/get-details', validateGetDetailsPayload, async (req, res) => {
  try {
    const vehicleNo = (req.body && (req.body.vehicleNo || '')).toString().trim();
    const stateRaw = (req.body && req.body.state) || '';
    const state = canonicalState(stateRaw);

    const detail = buildDetailSkeleton({ vehicleNo, state });

    // Optionally try to enrich with DB data if you want:
    try {
      const bill = await Bill.findOne({ vehicleNo }).sort({ createdAt: -1 }).lean();
      if (bill) {
        detail.chassisNo = bill.chassisNo || detail.chassisNo;
        detail.mobileNo = bill.mobileNo || detail.mobileNo;
        detail.ownerName = bill.ownerName || detail.ownerName;
        detail.borderBarrier = bill.borderBarrier || detail.borderBarrier;
        detail.checkpostName = bill.checkpostName || bill.checkPostName || detail.checkpostName;
        detail.seatingCapacityExcludingDriver = bill.seatingCapacityExcludingDriver || detail.seatingCapacityExcludingDriver;
        detail.serviceType = bill.serviceType || detail.serviceType;
        detail.taxMode = bill.taxMode || detail.taxMode;
      }
    } catch (dbErr) {
      // log and continue with skeleton
      logger.warn('[api] could not enrich detail from DB', dbErr && dbErr.message ? dbErr.message : dbErr);
    }

    return res.json({ success: true, state, detail });
  } catch (err) {
    logger.error('[api] /get-details error', err);
    return res.status(500).json({ success: false, message: 'internal error' });
  }
});

module.exports = router;
