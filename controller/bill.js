const Bill = require("../model/Bill");
const _ = require("lodash");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const qrCode = require("qrcode");
const logger = require("../logger");
const {
  receiptNoGenerator,
  inWords,
  formatDate,
  getAheadTimeWithDate,
} = require("../utils/helper");
const ejs = require("ejs");
const path = require("path");
const ip = require("ip");
const moment = require("moment");
const axios = require("axios");
const fs = require("fs");

// Map common short/alias keys to canonical template base names (filenames without suffix)
// Add aliases here as needed — the keys are lowercased and sanitized for lookup.
const STATE_TEMPLATE_MAP = {
  // Andhra Pradesh
  ap: "andhrapradesh",
  andhra: "andhrapradesh",
  andhrapradesh: "andhrapradesh",
  "andhra-pradesh": "andhrapradesh",
  "andhra_pradesh": "andhrapradesh",
  // Chhattisgarh aliases:
  cg: "chhattisgarh",
  chhattisgarh: "chhattisgarh",
  chhattisgarhstate: "chhattisgarh",
  // add other mappings below if you need more aliases in the future
};

const normalizeStateFile = (state) => {
  const originalState = String(state || "");
  const rawState = originalState.toLowerCase();
  const sanitizedState = rawState.replace(/[^a-z0-9]/g, "");
  const sanitizedPreserveCase = originalState.replace(/[^a-z0-9]/gi, "");

  return { rawState, sanitizedState, sanitizedPreserveCase };
};

const resolveTemplatePath = (state, baseDir, suffix) => {
  const { rawState, sanitizedState, sanitizedPreserveCase } =
    normalizeStateFile(state);

  // Determine canonical state token to look up templates.
  // Try mapping from sanitizedState first (handles 'ap', 'andhrapradesh', 'andhra-pradesh' -> sanitize)
  const sanitizedKey = String(sanitizedState || "").toLowerCase();
  const rawKey = String(rawState || "").toLowerCase();
  const preserveCaseKey = String(sanitizedPreserveCase || "").toLowerCase();

  // prefer mapping by sanitized key, then raw, then preserveCase
  const mapped =
    STATE_TEMPLATE_MAP[sanitizedKey] ||
    STATE_TEMPLATE_MAP[rawKey] ||
    STATE_TEMPLATE_MAP[preserveCaseKey] ||
    null;

  // If we found a mapped canonical name, use that as base; otherwise use sanitized/raw names.
  const baseNames = mapped
    ? [mapped, sanitizedState, rawState, sanitizedPreserveCase]
    : [sanitizedState, rawState, sanitizedPreserveCase];

  // Build candidate file paths in order of preference.
  const candidates = baseNames
    .filter(Boolean)
    .map((name) => path.join(baseDir, `${name}${suffix}`));

  // Finally: return the first existing candidate OR the first candidate path (so error logs still point to expected paths)
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
};

//@desc    get details
//@route   GET /bill/get-details?vehicleNo=XXX
//@access  private (route is using protect)
module.exports.getDetails = asyncHandler(async (req, res, next) => {
  logger.info(
    `member asked detail for ${req.query.vehicleNo} from ${req.params.state} form`
  );

  const detail = await Bill.findOne({ ...req.query }).sort({ createdAt: "-1" });

  if (!detail) {
    return res.status(404).send({
      success: false,
      code: 404,
      message: "No detail found",
    });
  }

  return res.status(200).send({
    success: true,
    code: 200,
    detail,
  });
});

//@desc    get pdf (HTML receipt page; browser can print to PDF)
//@route   GET /bill/:id/pdf
//@access  public
module.exports.getBillInPdfFormat = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Get the bill details
    const bill = await Bill.findById(id);
    if (!bill) {
      logger.info(`bill not found with this id ${id}`);
      res.status(404);
      return res.render("not-found");
    }

    logger.info(`bill found with this id ${id}`);

    // -------------------------
    // 2. Build absolute QR code URL (must have protocol + host)
    // prefer APP_BASE_URL if provided (should include http:// or https://)
    const defaultRenderHost = "https://vehicle-bill-backend-1.onrender.com";

    const hostForQr =
      process.env.APP_BASE_URL && process.env.APP_BASE_URL.trim() !== ""
        ? process.env.APP_BASE_URL.replace(/\/$/, "") // APP_BASE_URL always preferred
        : process.env.APP_BASE_IP && process.env.APP_BASE_IP.trim() !== ""
          ? process.env.APP_BASE_IP.replace(/\/$/, "")
          : process.env.NODE_ENV === "production"
            ? defaultRenderHost
            : `http://${ip.address()}:${process.env.PORT || 5000}`;

    // Encode query values
    const chassis = encodeURIComponent(bill.chassisNo || "");
    const owner = encodeURIComponent(bill.ownerName || "");

    // Build final absolute url for QR
    const pdfData = `${hostForQr}/bill/${id}/page?ChassisNo=${chassis}&ownerName=${owner}`;

    // Debug log so you can open this URL directly
    logger.info("QR payload URL:", pdfData);

    // 3. Generate QR code
    const src = await qrCode.toDataURL(pdfData);
    logger.info("QR code generated");
    // -------------------------

    // 4. Prepare data for EJS template (use safe defaults)
    const data = {
      ...bill._doc,
      src,
      // ensure host is always defined in template; prefer APP_BASE_URL but fallback to hostForQr
      host: process.env.APP_BASE_URL || hostForQr,
      cssFix: process.env.NODE_ENV === "production",
      taxFrom: formatDate(bill.taxFromDate, true),
      receiptDate: getAheadTimeWithDate(bill.paymentDate),
      taxTo: formatDate(bill.taxUptoDate, true),
      taxFrom_up: formatDate(bill.taxFromDate, false),
      taxTo_up: formatDate(bill.taxUptoDate, false),
      taxFrom_raj: formatDate(bill.taxFromDate, false),
      taxTo_raj: formatDate(bill.taxUptoDate, false),
      taxFrom_uk: formatDate(bill.taxFromDate, true),
      taxTo_uk: formatDate(bill.taxUptoDate, true),
      taxFrom_jh: formatDate(bill.taxFromDate, false),
      taxTo_jh: formatDate(bill.taxUptoDate, false),
      permitFrom: formatDate(bill.permitFrom, false),
      permitUpto: formatDate(bill.permitUpto, false),
      totalAmountInWord: inWords(bill.totalAmount || 0).toUpperCase(),
      paymentDate: formatDate(bill.paymentDate, true),
      upPaymentDate: formatDate(bill.paymentDate, false),
      upBankRefNo: "IGANXUHFSS",
      rjBankRefNo: "1KBVoBVBSMGg",
    };

    // 5. Render HTML using EJS
    const templatePath = resolveTemplatePath(
      bill.state,
      path.join(__dirname, "../views"),
      "Pdf.ejs"
    );

    if (!fs.existsSync(templatePath)) {
      logger.error(
        `Template missing for state=${bill.state}, path=${templatePath}`
      );
      return res.status(500).send("Template for this state is not available.");
    }

    const htmlContent = await ejs.renderFile(templatePath, { data });

    logger.info("Html content generated");

    if (!htmlContent) {
      return res.status(500).send("An error occurred while generating HTML");
    }

    // 6. Just return the HTML (browser can Print → Save as PDF)
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(htmlContent);
  } catch (err) {
    logger.error(`PDF (HTML) generation error: ${err.message}`, {
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      code: 500,
      message: "Unable to generate pdf page, try again later",
    });
  }
});

//@desc    get all
//@route   GET /bill
//@access  private
//@query   ?from=&to=&createdBy=&
module.exports.getAllBills = asyncHandler(async (req, res, next) => {
  const bills = await Bill.find({ ...req.query }).sort({ createdAt: "-1" });
  return res
    .status(200)
    .send({ success: true, code: 200, bills, count: bills.length });
});

//@desc    get all
//@route   GET /bill/:id/page
//@access  public
module.exports.getBillOnPageFormat = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const bill = await Bill.findById(id);
    if (!bill) {
      logger.info(`bill not found with this id ${id}`);
      res.status(404);
      return res.render("not-found");
    }

    // Build data object for template with safe defaults
    const data = {
      ...bill._doc,
      host: process.env.APP_BASE_URL || `https://${req.headers.host}`,
      cssFix: process.env.NODE_ENV === "production",
      taxFrom: formatDate(bill.taxFromDate, true),
      taxTo: formatDate(bill.taxUptoDate, true),
      taxFrom_up: formatDate(bill.taxFromDate, false),
      taxTo_up: formatDate(bill.taxUptoDate, false),
      taxFrom_raj: formatDate(bill.taxFromDate, true),
      taxTo_raj: formatDate(bill.taxUptoDate, true),
      taxFrom_uk: formatDate(bill.taxFromDate, true),
      taxTo_uk: formatDate(bill.taxUptoDate, true),
      permitFrom: formatDate(bill.permitFrom, false),
      permitUpto: formatDate(bill.permitUpto, false),
      totalAmountInWord: inWords(bill.totalAmount || 0).toUpperCase(),
      paymentDate: formatDate(bill.paymentDate, true),
      upPaymentDate: formatDate(bill.paymentDate, false),
      upBankRefNo: "IGANXUHFSS",
      rjBankRefNo: "1KBVoBVBSMGg",
    };

    const templatePath = resolveTemplatePath(
      bill.state,
      path.join(__dirname, "../views/pages"),
      "Page.ejs"
    );

    // Debug logs to help find the issue in Render logs
    logger.info(
      `Rendering bill page. billId=${id}, billState=${bill.state}, templatePath=${templatePath}`
    );
    logger.info(`Bill document keys: ${Object.keys(bill._doc).join(", ")}`);

    // Check template exists before rendering
    if (!fs.existsSync(templatePath)) {
      logger.error(`Template missing for state=${bill.state}, path=${templatePath}`);
      return res.status(500).send("Template for this state is not available.");
    }

    ejs.renderFile(templatePath, { data }, function (err, htmlContent) {
      if (err) {
        // Log full stack and helpful context — this will appear in Render logs
        logger.error(`Error rendering bill page for id=${id}, state=${bill.state}, err=${err.message}`, {
          stack: err.stack,
          billId: id,
          billState: bill.state,
          reqQuery: req.query,
        });

        // TEMP: send full stack back to client for debugging (remove ASAP once fixed)
        return res.status(500).send(`<pre>${err.stack}</pre>`);
      }

      if (htmlContent) {
        return res.send(htmlContent);
      } else {
        logger.error(`Rendered HTML empty for id=${id}, state=${bill.state}`);
        return res.status(500).send("An error occurred");
      }
    });
  } catch (err) {
    logger.error(`Unhandled error in getBillOnPageFormat for id=${id}: ${err.message}`, {
      stack: err.stack,
      reqParams: req.params,
      reqQuery: req.query,
    });
    return res.status(500).send("An error occurred");
  }
});

const formatDateMsg = (date, state, type) => {
  if (date) {
    let x = null;
    let time = null;
    time = new Date(date);

    if (["up", "uk", "rajasthan"].includes(state)) {
      if (type !== "createdAt") {
        time.setHours(12);
        time.setMinutes(0);
      }
      time = time.toLocaleTimeString();
      if (type !== "createdAt") {
        if (time.includes("pm")) {
          time = time.replace("pm", "am");
        } else {
          time = time.replace("PM", "AM");
        }
      }
      time = time.replace(/(.*)\D\d+/, "$1").toUpperCase();
      x = `${new Date(date).getDate()}-${new Date(date)
        .toLocaleDateString("default", {
          month: "short",
        })
        .toUpperCase()}-${new Date(date).getFullYear()} ${time}`;
    } else {
      if (type === "to") {
        time.setMinutes(time.getMinutes() - 1);
      }
      time = time.toLocaleTimeString();
      time = time.replace(/(.*)\D\d+/, "$1").toUpperCase();
      x = `${new Date(date).getDate()}-${new Date(date)
        .toLocaleDateString("default", {
          month: "short",
        })
        .toUpperCase()}-${new Date(date).getFullYear()} ${time}`;
    }
    return x;
  } else {
    return `${new Date().getDate()}-${new Date().toLocaleDateString(
      "default",
      {
        month: "short",
      }
    )}-${new Date().getFullYear()} ${new Date().toLocaleTimeString()}`;
  }
};

//@desc    create bill
//@route   POST /bill
//@access  private
module.exports.createBill = asyncHandler(async (req, res, next) => {
  const { username, password } = req.body;
  console.log(username, password);
  console.log(process.env.PAYMENT_USERNAME);

  if (
    username !== process.env.PAYMENT_USERNAME &&
    password !== process.env.PAYMENT_PASSWORD
  ) {
    return next(
      new ErrorResponse("Invalid username & password", 400, false, null)
    );
  }

  const bill = new Bill({ ...req.body });
  bill.createdBy = req.user._id;
  bill.receiptNo = receiptNoGenerator(req.body.state);

  let time = new Date(req.body.taxFromDate);
  time.setSeconds(new Date().getSeconds());
  bill.paymentDate = time;

  await bill.save();

  const data = JSON.stringify({});

  const config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `http://login.redsms.in/api/smsapi?key=c2c84407ebb090fc094fc169192f9cc8&route=2&sender=UVAHAN&number=${
      bill.mobileNo
    }&sms=Your tax of Rs. ${bill.totalAmount}/- has been paid for Vehicle No. ${
      bill.vehicleNo
    }, valid from ${formatDateMsg(
      bill.taxFromDate,
      bill.state,
      "from"
    )} to ${formatDateMsg(
      bill.taxUptoDate,
      bill.state,
      "to"
    )} paid on ${formatDateMsg(
      bill.createdAt,
      bill.state,
      "createdAt"
    )}. UVAHAN&templateid=1207163490769304299`,
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
      console.log(error);
    });

  logger.info(
    `new bill generated with this id ${bill._id} and create by ${req.user._id}`
  );

  const pdfUrl = `${(process.env.APP_BASE_URL || "https://vehicle-bill-backend-1.onrender.com").replace(/\/$/, "")}/bill/${bill._id}/pdf`;

  return res.status(201).send({
    success: true,
    code: 201,
    bill,
    pdfUrl,
  });
});
