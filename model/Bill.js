const mongoose = require("mongoose");
const BillSchema = new mongoose.Schema(
  {
    vehicleNo: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    chassisNo: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    ownerName: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    mobileNo: {
      type: String,
      default: "",
      trim: true,
    },
    totalAmount: {
      type: String,
      default: "",
      trim: true,
    },
    taxAmount: {
      type: String,
      default: "",
      trim: true,
    },
    userCharge: {
      type: String,
      default: "",
      trim: true,
    },
    infraCess: {
      type: String,
      default: "",
      trim: true,
    },
    permitFee: {
      type: String,
      default: "",
      trim: true,
    },
    permitValidity: {
      type: String,
      default: "",
      trim: true,
    },
    // vehicle type
    vehiclePermitType: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    fromState: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    vehicleClass: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    mvTax: {
      type: String,
      default: "",
      trim: true,
    },
    surChargeFee: {
      type: String,
      default: "",
      trim: true,
    },
    grossVehicleWeight: {
      type: String,
      default: "",
      trim: true,
    },
    unladenWeight: {
      type: String,
      default: "",
      trim: true,
    },
    additionalSeatingCapacity: {
      type: String,
      default: "0",
      trim: true,
    },

    additionalSleeperCapacity: {
      type: String,
      default: "0",
      trim: true,
    },

    seatingCapacityExcludingDriver: {
      type: String,
      default: "0",
      trim: true,
    },
    sleeperCapacityExcludingDriver: {
      type: String,
      default: "0",
      trim: true,
    },
    serviceType: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    makerStatus: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    ownerType: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    distance: {
      type: String,
      default: "",

      trim: true,
    },
    taxMode: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    paymentMode: {
      type: String,
      default: "ONLINE",
      trim: true,
    },
    counterSignatureFree: {
      type: String,
      default: "",
      trim: true,
    },
    borderBarrier: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    bankRefNo: {
      type: String,
      default: "NA",
      trim: true,
    },
    taxFromDate: {
      type: String,
      default: "",
      trim: true,
    },
    taxUptoDate: {
      type: String,
      default: "",
      trim: true,
    },
    checkpostName: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    permitNo: {
      type: String,
      default: "",
      trim: true,
    },
    permitFrom: {
      type: String,
      default: "",
      trim: true,
    },
    permitUpto: {
      type: String,
      default: "",
      trim: true,
    },
    permitType: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    sleeperCap: {
      type: String,
      default: "0",
      trim: true,
    },
    numberOfPeriod: {
      type: String,
      default: "",
      trim: true,
    },
    fitnessValidity: {
      type: String,
      default: "",
      trim: true,
    },
    insuranceValidity: {
      type: String,
      default: "",
      trim: true,
    },
    puccValidity: {
      type: String,
      default: "",
      trim: true,
    },
    permitAuthorizationNo: {
      type: String,
      default: "",
      trim: true,
    },
    permitAuthorizationValidity: {
      type: String,
      default: "",
      trim: true,
    },
    greenTaxValidity: {
      type: String,
      default: "",
      trim: true,
    },
    regnDate: {
      type: String,
      default: "",
      trim: true,
    },
    permitEndoresment: {
      type: String,
      default: "",
      trim: true,
    },
    rtoName: {
      type: String,
      default: "",
      trim: true,
    },

    vehicleType: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    barrierName: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    districtName: {
      type: String,
      default: "",
      uppercase: true,
      trim: true,
    },
    issuingAuthority: {
      type: String,
      default: "",
      trim: true,
    },
    generatedBy: {
      type: String,
      default: "",
      trim: true,
    },
    paymentDate: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    receiptNo: {
      ref: "User",
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Bill = mongoose.model("Bill", BillSchema);

module.exports = Bill;
