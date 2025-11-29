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

//@desc    get details
//@route   get /bill/:state/get-details/:vehicleNo
//@access  public
module.exports.getDetails = asyncHandler(async (req, res, next) => {
  // find from db
  logger.info(
    `member asked detail for ${req.query.vehicleNo} from ${req.params.state} form`
  );
  const detail = await Bill.findOne({ ...req.query }).sort({ createdAt: "-1" });
  if (!detail) {
    res.status(404).send({
      success: false,
      code: 404,
      message: "No detail found",
    });
  } else {
    res.status(200).send({
      success: true,
      code: 200,
      detail,
    });
  }

  //TODO:
  // send different fields data based on different state
});

//@desc    get pdf
//@route   get /bill/:id/pdf
//@access  public
module.exports.getBillInPdfFormat = asyncHandler(async (req, res, next) => {
  // get id from params
  const { id } = req.params;
  // // get the bill details
  const bill = await Bill.findById(id);
  if (!bill) {
    logger.info(`bill not found with this id ${id}`);
    res.status(404);
    return res.render("not-found");
  }
  logger.info(`bill found with this id ${id}`);
  const pdfData = `${
    process.env.NODE_ENV === "production"
      ? process.env.APP_BASE_IP
      : ip.address()
  }/bill/${id}/page?ChassisNo=${bill.chassisNo}&ownerName=${bill.ownerName}
  
  `;
  // const pdfData = `Vehicle No :  ${bill.vehicleNo} \nOwner name : ${bill.ownerName} \nfrom State : ${bill.fromState} \nVehicle class : ${bill.vehicleClass}`;

  qrCode.toDataURL(pdfData, (err, src) => {
    if (err) {
      logger.error(`Unable to generate pdf package callback error`);
      return next(
        new ErrorResponse(
          "Unbale to generate pdf, try again later",
          400,
          false,
          null
        )
      );
    }
    logger.error(`Qr code generated`);
    const data = {
      ...bill._doc,
      src,
      host: process.env.APP_BASE_URL,
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
      totalAmountInWord: inWords(bill.totalAmount).toUpperCase(),
      paymentDate: formatDate(bill.paymentDate, true),
      upPaymentDate: formatDate(bill.paymentDate, false),
      upBankRefNo: "IGANXUHFSS",
      rjBankRefNo: "1KBVoBVBSMGg",
    };

    ejs.renderFile(
      path.join(__dirname, `../views/${bill.state}Pdf.ejs`),
      { data },
      function (err, htmlContent) {
        logger.error(`Html content generated`);
        // render on success
        if (htmlContent) {
          res.setHeader("Content-Type", "application/pdf");
          res.pdfFromHTML({
            filename: `${bill.vehicleNo}.pdf`,
            htmlContent,
            options: {
              format: "Letter",
              orientation: "portrait",
              type: "pdf",
              quality: "75",
            },
          });
        } else {
          res.status(500).send("An error occurred");
        }
      }
    );
  });
});

//@desc    get all
//@route   GET /bill
//@access  private
//@query   ?from=&to=&createdBy=&
module.exports.getAllBills = asyncHandler(async (req, res, next) => {
  const bills = await Bill.find({ ...req.query }).sort({ createdAt: "-1" });
  res
    .status(200)
    .send({ success: true, code: 200, bills, count: bills.length });
});

//@desc    get all
//@route   GET /bill/:id/page
//@access  public
module.exports.getBillOnPageFormat = asyncHandler(async (req, res, next) => {
  // get id from params
  const { id } = req.params;
  // // get the bill details
  const bill = await Bill.findById(id);
  if (!bill) {
    logger.info(`bill not found with this id ${id}`);
    res.status(404);
    return res.render("not-found");
  }
  const data = {
    ...bill._doc,
    host: process.env.APP_BASE_URL,
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
    totalAmountInWord: inWords(bill.totalAmount).toUpperCase(),
    paymentDate: formatDate(bill.paymentDate, true),
    upPaymentDate: formatDate(bill.paymentDate, false),
    upBankRefNo: "IGANXUHFSS",
    rjBankRefNo: "1KBVoBVBSMGg",
  };

  ejs.renderFile(
    path.join(__dirname, `../views/pages/${bill.state}Page.ejs`),
    { data },
    function (err, htmlContent) {
      // render on success
      if (htmlContent) {
        res.send(htmlContent);
      } else {
        res.status(500).send("An error occurred");
      }
    }
  );
});

const formatDateMsg = (date, state, type) => {
  if (date) {
    let x = null;
    let time = null;
    time = new Date(date);

    if (["up", "uk", "rajasthan"].includes(state)) {
      if (type !== "createdAt") {
        time.setHours(12);
        time.setMinutes(00);
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
      if (type == "to") {
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
    // fallback current date
    return `${new Date().getDate()}-${new Date().toLocaleDateString("default", {
      month: "short",
    })}-${new Date().getFullYear()} ${new Date().toLocaleTimeString()}`;
  }
};

//@desc    create bill
//@route   POST /bill/post
//@access  private
module.exports.createBill = asyncHandler(async (req, res, next) => {
  // get data from body
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
  // save to db

  await bill.save();
  var data = JSON.stringify({});

  var config = {
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
  // generate pdf url
  const pdfUrl = `${process.env.APP_BASE_URL}/bill/${bill._id}/pdf`;
  // send message to number
  //TODO:
  // return response
  res.status(201).send({
    success: true,
    code: 201,
    bill,
    pdfUrl,
  });
});
