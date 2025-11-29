const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const User = require('../model/User');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../logger');

const protect = asyncHandler(async (req, res, next) => {
  // check for token preset in header
  const token = req.header('x-auth-token');
  if (!token) {
    return next(new ErrorResponse('Access Denied', 401, false, null));
  }

  // check token validity
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.exp < (new Date().getTime() + 1) / 1000) {
    return next(
      new ErrorResponse('Session Expired, Please Login again', 401, false, null)
    );
  }

  // check if id in token exist
  const user = await User.findById(decoded._id);
  if (!user) {
    logger.info(`user is trying with invalid token ${token}`);
    next(
      new ErrorResponse(
        'invalid user id in token / Access Denied ',
        401,
        false,
        null
      )
    );
  }

  // check if user is not blocked
  if (user.isBlocked) {
    next(
      new ErrorResponse(
        'You are blocked, please contact admin',
        403,
        false,
        null
      )
    );
  }

  req.user = user;
  next();
});

const authorize = (...roles) => {
  return (req, _, next) => {
    if (!roles.includes(req.user.role)) {
      next(
        new ErrorResponse(
          `role ${req.user.role} is not authorized to perform this operation`,
          403,
          false
        )
      );
    }
    next();
  };
};

//protect routh
module.exports.protect = protect;
//grant access to specific roles
module.exports.authorize = authorize;
