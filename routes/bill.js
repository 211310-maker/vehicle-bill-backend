const express = require('express');
const router = express.Router();
const {
  getDetails,
  createBill,
  getAllBills,
  getBillInPdfFormat,
  getBillOnPageFormat,
} = require('../controller/bill');

const { protect, authorize } = require('../middleware/auth');

//@desc    get details
//@route   GET /bill/:state/get-details/:vehicleNo
//@access  public
router.get('/get-details', protect, getDetails);

//@desc    get Pdf
//@route   GET /bill/:id/pdf
//@access  public
router.get('/:id/pdf', getBillInPdfFormat);

//@desc    get bill details on page
//@route   GET /bill/:id/page
//@access  public
router.get('/:id/page', getBillOnPageFormat);

// get all with filter

//@desc    get all
//@route   GET /bill
//@access  private
router.get('/', protect, getAllBills);

//@desc    create bill
//@route   POST /bill
//@access  public
router.post('/', protect, createBill);

module.exports = router;
