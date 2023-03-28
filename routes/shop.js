const express = require("express");
const router = express.Router();

let {
  register,
  verifyContact,
  retryContactVerification,
  addProducts,
  viewOneProduct,
  viewProducts,
  refillStock,
  readQrData,
  customerCount,
  qrStatus,
  qrStatus1,
  addToPreviousOrders,
  addToCart,
  viewPreviousOrders,
  updateProduct,
  deleteProduct,
  viewCart,
  removeFromCart,
  salesToday,
  sales,
} = require("../controllers/shop_controller");

let {
  adminAuth,
  staffAuth,
  customerAuth,
  allAuth,
  someAuth,
  staffandadminAuth,
} = require("../config/auth");

router.post("/register", adminAuth, register);
router.post("/verifyMobile/:contact", verifyContact);
router.get("/retryVerification/:contact", retryContactVerification);
router.post("/add", staffandadminAuth, addProducts);
router.get("/viewone/:id", allAuth, viewOneProduct);
router.get("/viewall", allAuth, viewProducts);
router.post("/refill", adminAuth, refillStock);
router.get("/readQrCode/:_id", staffandadminAuth, readQrData);
router.get("/count", staffandadminAuth, customerCount); //check
router.get("/qrStatus", customerAuth, qrStatus);
router.get("/status", customerAuth, qrStatus1);
router.post("/previousOrders", customerAuth, addToPreviousOrders); //amount = 232.8+51.828+1568+120
router.get("/previousOrders", customerAuth, viewPreviousOrders);
router.put("/:id", adminAuth, updateProduct);
router.delete("/:id", adminAuth, deleteProduct);
// router.post("/cart/:id", customerAuth, addToCart);
// router.get("/viewcart", customerAuth, viewCart);
// router.post("/cart/remove/:id", customerAuth, removeFromCart);
router.get("/salesToday", adminAuth, salesToday); //check
router.get("/sales/:specdate", adminAuth, sales); //check
//delete put
//razorpay

module.exports = router;
