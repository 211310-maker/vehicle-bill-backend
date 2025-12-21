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
const puppeteer = require("puppeteer");

// --- TEMPLATE ALIASES MAP ---
const STATE_TEMPLATE_MAP = {
  ap: "andhrapradesh",
  andhra: "andhrapradesh",
  andhrapradesh: "andhrapradesh",
  "andhra-pradesh": "andhrapradesh",
  "andhra_pradesh": "andhrapradesh",
  cg: "chhattisgarh",
  chhattisgarh: "chhattisgarh",
  chhattisgarhstate: "chhattisgarh",
  gujrat: "gujarat",
  gj: "gujarat",
  gujarat: "gujarat",
  gujaratstate: "gujarat",
  haryana: "haryana",
  hp: "himachalpradesh",
  himachalpradesh: "himachalpradesh",
  "himachal-pradesh": "himachalpradesh",
  "himachal_pradesh": "himachalpradesh",
  bihar: "bihar",
  jharkhand: "jharkhand",
  karnataka: "karnataka",
  kerala: "kerala",
  kerela: "kerala",
  mp: "madhyapradesh",
  madhyapradesh: "madhyapradesh",
  maharashtra: "maharashtra",
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

  const sanitizedKey = String(sanitizedState || "").toLowerCase();
  const rawKey = String(rawState || "").toLowerCase();
  const preserveCaseKey = String(sanitizedPreserveCase || "").toLowerCase();

  const mapped =
    STATE_TEMPLATE_MAP[sanitizedKey] ||
    STATE_TEMPLATE_MAP[rawKey] ||
    STATE_TEMPLATE_MAP[preserveCaseKey] ||
    null;

  const baseNames = mapped
    ? [mapped, sanitizedState, rawState, sanitizedPreserveCase]
    : [sanitizedState, rawState, sanitizedPreserveCase];

  const candidates = baseNames
    .filter(Boolean)
    .map((name) => path.join(baseDir, `${name}${suffix}`));

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
};

module.exports.resolveTemplatePath = resolveTemplatePath;
module.exports.STATE_TEMPLATE_MAP = STATE_TEMPLATE_MAP;

const DETAIL_DEFAULTS = {
  state: "",
  chassisNo: "",
  mobileNo: "",
  ownerName: "",
  borderBarrier: "",
  checkpostName: "",
  checkPostName: "",
  seatingCapacityExcludingDriver: "",
  serviceType: "",
  taxMode: "",
};

const normalizeDetailResponse = (detailDoc = {}) => {
  const payload =
    detailDoc && typeof detailDoc.toObject === "function"
      ? detailDoc.toObject()
      : { ...detailDoc };

  const merged = { ...DETAIL_DEFAULTS, ...payload };
  merged.checkpostName = merged.checkpostName || merged.checkPostName;
  merged.checkPostName = merged.checkPostName || merged.checkpostName;

  if (merged.state && merged.state.toLowerCase() === "kerela") {
    merged.state = "kerala";
  }

  return merged;
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
    detail: normalizeDetailResponse(detail),
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
      taxTo_raj: formatDate(bill.taxFromDate, false),
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

    logger.info(
      `[bill] resolveTemplatePath state=${bill.state} -> ${templatePath}`
    );

    if (!fs.existsSync(templatePath)) {
      logger.error(
        `Template missing for state=${bill.state}, path=${templatePath}`
      );
      return res.status(500).send("Template for this state is not available.");
    }

    // 5. Render HTML using EJS (kept for fallback and debugging)
    const htmlContent = await ejs.renderFile(templatePath, { data });
    logger.info("Html content generated");

    if (!htmlContent) {
      return res.status(500).send("An error occurred while generating HTML");
    }

    // Insert <base href> so relative assets/css resolve correctly when using setContent()
    const hostForBase = (data.host || process.env.APP_BASE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    let htmlWithBase = htmlContent;
    if (!/<base\s+href/i.test(htmlWithBase)) {
      htmlWithBase = htmlWithBase.replace(
        /<head([^>]*)>/i,
        `<head$1>\n<base href="${hostForBase}">\n`
      );
    }

    // === Generate PDF using Puppeteer from rendered HTML (avoid navigating to /bill/:id/page) ===
    let browser = null;
    try {
      // Try common system browser paths, prefer env var if provided
      const possibleBrowsers = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
      ].filter(Boolean);

      // find first that exists and is executable
      let execPath = null;
      for (const p of possibleBrowsers) {
        try {
          if (!p) continue;
          if (!fs.existsSync(p)) {
            logger.debug(`Puppeteer candidate not found: ${p}`);
            continue;
          }
          // ensure file is executable
          fs.accessSync(p, fs.constants.X_OK);
          execPath = p;
          break;
        } catch (e) {
          logger.debug(`Puppeteer candidate not executable or inaccessible: ${p} -> ${e.message}`);
          continue;
        }
      }

      // If env var was set but not usable, warn specifically
      if (process.env.PUPPETEER_EXECUTABLE_PATH && process.env.PUPPETEER_EXECUTABLE_PATH !== execPath) {
        logger.warn(
          `PUPPETEER_EXECUTABLE_PATH is configured (${process.env.PUPPETEER_EXECUTABLE_PATH}) ` +
          `but it was not found or not executable in runtime. Will try other candidates or bundled Chromium.`
        );
      }

      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
        timeout: 60000,
      };

      if (execPath) {
        launchOptions.executablePath = execPath;
        logger.info(`Puppeteer will use browser executable at: ${execPath}`);
      } else {
        logger.warn(
          'No system browser found at common paths; attempting to use Puppeteer default bundled Chromium (if present).'
        );
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60000);
      await page.setViewport({ width: 1200, height: 1000 });

      // Load the rendered HTML into the page and wait for resources to finish loading
      await page.setContent(htmlWithBase, { waitUntil: 'networkidle0', timeout: 60000 });

      // Apply print media so @media print CSS is used
      try { await page.emulateMediaType('print'); } catch (e) { /* ignore if deprecated */ }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });

      // Return PDF as attachment so browsers download it automatically
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${id}.pdf"`);
      return res.send(pdfBuffer);

    } catch (err) {
      // Log the real error for debugging, then fallback to sending HTML
      logger.error(`Puppeteer PDF generation failed for bill ${id}: ${err.message}`, { stack: err.stack });

      // Fallback: return the HTML page (existing behavior)
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(htmlContent);
    } finally {
      if (browser) {
        try { await browser.close(); } catch (e) { /* swallow */ }
      }
    }
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
      taxTo_uk: formatDate(bill.taxFromDate, true),
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
    return `${new Date().getDate()}-${new Date().toLocaleDateString("default", {
      month: "short",
    })}-${new Date().getFullYear()} ${new Date().toLocaleTimeString()}`;
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
