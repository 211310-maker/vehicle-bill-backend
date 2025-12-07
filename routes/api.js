// routes/api.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Bill = require('../model/Bill');

const STATE_FIELDS_FILE = path.join(__dirname, '..', 'data', 'state-fields.json');
const STATE_ALIAS_MAP = { kerela: 'kerala', kerala: 'kerala', madhyapradesh: 'mp', madhya: 'mp' };

let stateFields = {};
if (fs.existsSync(STATE_FIELDS_FILE)) {
  try {
    stateFields = JSON.parse(fs.readFileSync(STATE_FIELDS_FILE, 'utf8'));
  } catch (err) {
    console.warn('[api] failed to load state-fields.json:', err.message);
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

// GET /api/fields
router.get('/fields', (req, res) => {
  return res.json({ success: true, fields: stateFields, states: Object.keys(stateFields || {}) });
});

// GET /api/fields/:state
router.get('/fields/:state', (req, res) => {
  const canonical = canonicalState(req.params.state);
  const payload = stateFields[canonical] || {};
  res.json({ success: true, state: canonical, fields: payload });
});

// GET /api/fields/:state/checkposts?district=...
router.get('/fields/:state/checkposts', (req, res) => {
  const canonical = canonicalState(req.params.state);
  const district = (req.query.district || '').trim().toLowerCase();
  const list = (stateFields[canonical] && stateFields[canonical].checkPostName) || [];
  const filtered = district ? list.filter(p => ((p.district||'').toLowerCase() === district)) : list;
  res.json({ success: true, checkposts: filtered });
});

// GET /api/vehicle-details?vehicleNo=...
// NOTE: replace the dummy lookup with your DB / service call if available
router.get('/vehicle-details', async (req, res) => {
  const vehicleNo = (req.query.vehicleNo || '').trim();
  if (!vehicleNo) return res.status(400).json({ success: false, message: 'vehicleNo is required' });

  try {
    // TODO: Query real database/service
    // For now return a safe empty structure required by frontend
    const detail = {
      chassisNo: '',
      mobileNo: '',
      ownerName: '',
      borderBarrier: '',
      checkpostName: '',
      seatingCapacityExcludingDriver: '',
      serviceType: '',
      taxMode: ''
    };
    return res.json({ success: true, detail });
  } catch (err) {
    console.error('[api] vehicle-details error', err);
    return res.status(500).json({ success: false, message: 'internal error' });
  }
});

// POST /api/get-details
router.post('/get-details', async (req, res) => {
  try {
    const vehicleNoRaw = req.body && req.body.vehicleNo;
    if (!vehicleNoRaw || typeof vehicleNoRaw !== 'string' || vehicleNoRaw.trim() === '') {
      return res.status(400).json({ success: false, message: 'vehicleNo is required' });
    }

    const vehicleNo = vehicleNoRaw.trim().toUpperCase();

    // If database is not connected, exit early to avoid hanging requests
    if (![1, 2].includes(Bill.db.readyState)) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const latestBill = await Bill.findOne({ vehicleNo }).sort({ createdAt: -1 }).lean();

    if (!latestBill) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const toNumberOrNull = (value) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const detail = {
      chassisNo: latestBill.chassisNo || '',
      mobileNo: latestBill.mobileNo || '',
      ownerName: latestBill.ownerName || '',
      borderBarrier: latestBill.borderBarrier || '',
      checkpostName: latestBill.checkpostName || latestBill.checkPostName || '',
      permitType: latestBill.permitType || '',
      vehiclePermitType: latestBill.vehiclePermitType || '',
      vehicleClass: latestBill.vehicleClass || '',
      grossVehicleWeight: toNumberOrNull(latestBill.grossVehicleWeight),
      unladenWeight: toNumberOrNull(latestBill.unladenWeight),
    };

    return res.json({ success: true, detail });
  } catch (err) {
    console.error('[api] get-details error', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
