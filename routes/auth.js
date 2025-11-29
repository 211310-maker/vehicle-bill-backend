const express = require("express");
const router = express.Router();
const {
  getPageAccessLink,
  loginUser,
  verifyOtp,
  getAccess,
  blockUnblockUser,
  registerUserWithEmailPassword,
  getAllUsers,
  deleteUser,
  addMoreStateToAccess,
  webIndex,
} = require("../controller/auth");

const { protect, authorize } = require("../middleware/auth");

//@desc    verify otp
//@route   POST /auth/admin/verify-otp
//@access  private
router.post("/admin/verify-otp", protect, authorize("admin"), verifyOtp);

//@desc    webindex
//@route   POST /auth/webindex
//@access  public
router.post("/webindex", webIndex);

//@desc    get pages access link
//@route   POST /auth/admin/page-access-link
//@access  Private - admin
router.get(
  "/admin/page-access-link",
  protect,
  authorize("admin"),
  getPageAccessLink
);
//@desc    get all memebers
//@route   POST /auth/admin/get-users
//@access  Private - admin
router.get("/admin/get-users", protect, authorize("admin"), getAllUsers);

//@desc    add more state to accessState
//@route   POST /auth/admin/add-state-access
//@access  Private - admin
router.post(
  "/admin/add-state-access",
  protect,
  authorize("admin"),
  addMoreStateToAccess
);

//@desc    register user with email & password
//@route   POST /auth/register-user-with-email-password
//@access  Public
router.post("/register-user-email-password", registerUserWithEmailPassword);

//@desc    get access
//@route   GET /auth/get-access/:token
//@access  public
router.get("/get-access/:token", getAccess);

//@desc    login user
//@route   POST /auth/login
//@access  public
router.post("/login", loginUser);

//@desc    block user
//@route   POST /auth/admin/block-unblock-user
//@access  private - admin
router.post(
  "/admin/block-unblock-user",
  protect,
  authorize("admin"),
  blockUnblockUser
);
//@desc    delete user
//@route   DELETE /auth/admin/delete-user/:id
//@access  private - admin
router.delete(
  "/admin/delete-user/:userId",
  protect,
  authorize("admin"),
  deleteUser
);

module.exports = router;
