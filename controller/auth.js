const User = require("../model/User");
const TempUser = require("../model/TempUser");
const _ = require("lodash");
const asyncHandler = require("../middleware/asyncHandler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateLogin } = require("../utils/validation");
const ErrorResponse = require("../utils/errorResponse");
const logger = require("../logger");
const { randomNumber } = require("../utils/helper");

const ALL_STATES = [
  "BIHAR",
  "HARYANA",
  "PUNJAB",
  "UTTAR PRADESH",
  "UTTARAKHAND",
  "GUJRAT",
  "RAJASTHAN",
  "MADHYA PRADESH",
  "MAHARASHTRA",
  "HIMACHAL PRADESH",
  "KARNATAKA",
  "JHARKHAND",
  "CHHATTISGARH",
  "ODISHA",
  "TAMILNADU",
];

//@desc    register user
//@route   GET /auth/page-access-link
//@access  Private
module.exports.getPageAccessLink = asyncHandler(async (req, res, next) => {
  let user = new TempUser({
    isBlocked: true,
  });
  await user.save();
  const token = jwt.sign({ id: user._id }, "page-access", {
    expiresIn: "1d",
  });
  res.status(200).send({
    success: true,
    code: 200,
    url: `/app/register/${token}/get-access`,
    tempUser: user,
  });
});

//@desc    get access
//@route   get /auth/get-access/:token
//@access  Private
module.exports.getAccess = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  const decoded = jwt.verify(token, "page-access");
  let user;
  if (decoded.exp < (new Date().getTime() + 1) / 1000) {
    res.status(400).send({
      success: false,
      code: 400,
      message: "link expired",
    });
    return;
  }

  user = await TempUser.findById(decoded.id);
  let otp = randomNumber(6);
  user.otp = otp;
  await user.save();
  const pageAccessToken = jwt.sign(
    { id: decoded.id },
    "valid-page-access-token"
  );
  res.status(200).send({
    success: true,
    code: 200,
    pageAccessToken,
    otp,
  });
});
//@desc    verify Otp
//@route   get /auth/admin/verify-otp
//@access  Private
module.exports.verifyOtp = asyncHandler(async (req, res, next) => {
  const { otp, password, username, tempUserId, accessState } = req.body;
  const tempUser = await TempUser.findOne({ _id: tempUserId, otp });
  if (!tempUser) {
    return next(
      new ErrorResponse(
        "Invalid Otp please start registering again",
        400,
        false,
        null
      )
    );
  }
  let user = await User.findOne({ username });
  if (user) {
    return next(new ErrorResponse("Username already exists", 400, false, null));
  }

  user = new User({
    username,
    accessState,
    isBlocked: false,
    completed: true,
  });
  // const salt = await bcrypt.genSalt(10);
  // user.password = await bcrypt.hash(password, salt);
  user.password = password;
  await user.save();
  logger.info(`new user is created with id ${user._id}`);
  await TempUser.findByIdAndDelete(tempUserId);
  res.status(201).send({
    success: true,
    status: 201,
    message: "User created successfully!",
    user: _.pick(user, ["username", "role", "__v"]),
  });
});

//@desc    add more state to accessState
//@route   get /auth/admin/add-state-access
//@access  Private
module.exports.addMoreStateToAccess = asyncHandler(async (req, res, next) => {
  const { accessState, id } = req.body;
  const user = await User.findByIdAndUpdate(
    id,
    { accessState },
    {
      runValidators: true,
    }
  );
  if (!user) {
    return next(
      new ErrorResponse("User not found with this id", 404, false, null)
    );
  }
  user.accessState = accessState;
  await user.save();
  logger.info(`more state access added to user with id ${user._id}`);
  res.status(200).send({
    success: true,
    status: 200,
    message: "More state added successfully!",
  });
});

//@desc    block-unblock user
//@route   post /auth/block-unblock-user
//@access  Private
module.exports.blockUnblockUser = asyncHandler(async (req, res, next) => {
  const { id } = req.body;
  const user = await User.findById(id);
  if (!user) {
    return next(
      new ErrorResponse(
        "User not found with id the provided id",
        404,
        false,
        null
      )
    );
  }

  user.isBlocked = !user.isBlocked;
  await user.save();
  res.status(201).send({
    success: true,
    status: 200,
    message: "User status changed!",
  });
});
//@desc    get all users
//@route   get /auth/admin/get-users
//@access  Private
module.exports.getAllUsers = asyncHandler(async (req, res, next) => {
  let filter = {};
  if (req.query) {
    filter = { ...req.query };
  } else {
    if (Object.keys(req.query)) {
      filter = { role: "member" };
    }
  }
  let users = await User.find({ ...filter }).populate("createdBy");
  // .sort({ createdAt: '-1' })
  // .select('-otp')

  res.status(201).send({
    success: true,
    status: 200,
    count: users.length,
    users: users.filter((e) => e.username !== req.user.username),
  });
});

//@desc    register user
//@route   GET /auth/register-user-email-password
//@access  Public
module.exports.registerUserWithEmailPassword = asyncHandler(
  async (req, res, next) => {
    const { username, password } = req.body;
    const isUserNameExist = await User.find({ username });
    if (isUserNameExist.length > 0) {
      return next(
        new ErrorResponse("Username already exist", 400, false, null)
      );
    } else if (!username) {
      return next(new ErrorResponse("Please add username", 400, false, null));
    }
    let user = new User({
      isBlocked: true,
      username,
      password,
    });
    // const salt = await bcrypt.genSalt(10);
    // user.password = await bcrypt.hash(user.password, salt);
    user.password = password;
    const token = user.generateAuthToken();
    await user.save();
    user.token = token;
    logger.info(`user registered with direct email & password`);
    res.status(200).send({
      success: true,
      code: 200,
      user: _.pick(user, [
        "username",
        "role",
        "isBlocked",
        "createdAt",
        "updatedAt",
        "token",
        "__v",
      ]),
    });
  }
);

//@desc    Login User
//@route   POST /auth/login
//@access  Private
module.exports.loginUser = asyncHandler(async (req, res, next) => {
  const errors = await validateLogin(req.body);
  if (errors) {
    return next(new ErrorResponse("Not valid inputs", 400, false, errors));
  }

  const { username, password } = req.body;
  let user = await User.findOne({ username, password });
  if (!user) {
    return next(new ErrorResponse("Invalid Credentials", 400, false));
  }

  // const validPassword = await bcrypt.compare(password, user.password);
  // if (!validPassword) {
  //   return next(new ErrorResponse('Invalid Credentials', 400, false));
  // }

  if (user.isBlocked) {
    return next(new ErrorResponse("You are blocked", 400, false));
  }

  if (req.headers.referer.includes("/admin/login")) {
    if (user.role !== "admin") {
      return next(new ErrorResponse("Invalid Credentials", 400, false));
    }
  }

  const token = user.generateAuthToken();
  if (user.role === "admin") {
    user.accessState = ALL_STATES;
  }
  await user.save();
  user.token = token;
  logger.info(`user ${user._id} logged in`);
  res.status(200).send({
    success: true,
    code: 200,
    user: _.pick(user, [
      "role",
      "_id",
      "username",
      "createdAt",
      "updatedAt",
      "token",
      "accessState",
      "__v",
    ]),
  });
});
//@desc    Web index
//@route   POST /auth/webindex
//@access  Public
module.exports.webIndex = asyncHandler(async (req, res, next) => {
  const { authToken } = req.body;
  if (!authToken) {
    return next(new ErrorResponse("Please add auth token", 400, false, {}));
  }
  const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
  if (decoded.exp < (new Date().getTime() + 1) / 1000) {
    return next(
      new ErrorResponse("Session Expired, Please Login again", 401, false, null)
    );
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    logger.info(`user is trying with invalid token ${authToken}`);
    return next(
      new ErrorResponse(
        "invalid user id in token / Access Denied ",
        401,
        false,
        null
      )
    );
  }

  if (user && user.isBlocked) {
    return next(new ErrorResponse("You are blocked", 400, false));
  }

  if (req.headers.referer.includes("/admin/login")) {
    if (user.role !== "admin") {
      return next(new ErrorResponse("Invalid Credentials", 400, false));
    }
  }

  const token = user.generateAuthToken();
  if (user.role === "admin") {
    user.accessState = ALL_STATES;
  }
  await user.save();
  user.token = token;
  logger.info(`user ${user._id} logged in`);
  res.status(200).send({
    success: true,
    code: 200,
    user: _.pick(user, [
      "role",
      "_id",
      "username",
      "createdAt",
      "updatedAt",
      "token",
      "accessState",
      "__v",
    ]),
  });
});

//@desc    Delete User
//@route   Delete /admin/delete-user/:userId
//@access  Private
module.exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  let user = await User.findById(userId);
  if (!user) {
    return next(new ErrorResponse("User not found with this id", 404, false));
  }
  if (user.username === req.user.username) {
    return next(new ErrorResponse("Cannot delete yourself!", 422, false));
  }
  await User.findByIdAndRemove(userId);
  res.status(200).send({
    success: true,
    code: 200,
    message: "User deleted successfully!",
  });
});
