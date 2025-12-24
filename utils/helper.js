const axios = require("axios");

module.exports.inWords = (num) => {
  if (num === undefined || num === null) {
    return "NA";
  }
  var a = [
    "",
    "one ",
    "two ",
    "three ",
    "four ",
    "five ",
    "six ",
    "seven ",
    "eight ",
    "nine ",
    "ten ",
    "eleven ",
    "twelve ",
    "thirteen ",
    "fourteen ",
    "fifteen ",
    "sixteen ",
    "seventeen ",
    "eighteen ",
    "nineteen ",
  ];
  var b = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  if ((num = num.toString()).length > 9) return "overflow";
  n = ("000000000" + num)
    .substr(-9)
    .match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return;
  var str = "";
  str +=
    n[1] != 0
      ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + "crore "
      : "";
  str +=
    n[2] != 0
      ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + "lakh "
      : "";
  str +=
    n[3] != 0
      ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + "thousand "
      : "";
  str +=
    n[4] != 0
      ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + "hundred "
      : "";
  str +=
    n[5] != 0
      ? (str != "" ? "and " : "") +
        (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]])
      : "";
  return str + "only";
};

// ✅ Receipt generator for ALL STATES:
// prefix depends on state
// date logic same for all states (YYMMDD from taxFromDate)
// tail random 7 digits
module.exports.receiptNoGenerator = (state, taxFromDate) => {
  const s = String(state || "").toLowerCase().trim();

  // Add as many states as you want here; unknown states fall back to "RCP"
  const PREFIX = {
    bihar: "BRT",
    punjab: "PBT",
    haryana: "HRT",
    up: "UPT",
    uk: "UKT",
    gujrat: "GJ",
    gujarat: "GJ", // ✅ handle both spellings
    maharashtra: "MH",
    rajasthan: "RJ",
    jharkhand: "JHT",
    chhattisgarh: "CGT",

    // ✅ add Puducherry
    puducherry: "PYR",
    pondicherry: "PYR",
  };

  const inititals = PREFIX[s] || "RCP";

  const d = new Date(taxFromDate);
  // if taxFromDate is invalid, fallback to today's date (not a fixed number)
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;

  const yy = String(safeDate.getFullYear()).slice(-2);
  const mm = String(safeDate.getMonth() + 1).padStart(2, "0");
  const dd = String(safeDate.getDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;

  const tail = Math.floor(1000000 + Math.random() * 9000000);

  return `${inititals}${datePart}${tail}`;
};

module.exports.randomNumber = (length) => {
  return `${Math.floor(
    Math.pow(10, length - 1) +
      Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1)
  )}`;
};

module.exports.sendSms = async ({}) => {
  try {
  } catch (error) {}
};

module.exports.formatDate = (date, showTime) => {
  let a = new Date(date)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .split(" ")
    .join("-")
    .toUpperCase();
  let b = new Date(date)
    .toLocaleString("en-GB", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
  if (showTime) {
    return `${a} ${b}`;
  } else {
    return `${a}`;
  }
};

function addZero(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}

// ahead 2 min time
module.exports.getAheadTimeWithDate = (date) => {
  let a = new Date(date)
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .split(" ")
    .join("-")
    .toUpperCase();
  let b = new Date(date);

  let time = new Date(b).getMinutes() + 2;
  b.setMinutes(time);
  b = b
    .toLocaleString("en-GB", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    .toUpperCase();
  return `${a} ${b}`;
};
