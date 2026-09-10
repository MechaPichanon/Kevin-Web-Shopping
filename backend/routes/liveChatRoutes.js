// routes/liveChatRoutes.js
const express = require("express")
const router = express.Router()
const { auth, requireAdminOrStaff } = require("../middleware/auth")
const {
  escalate,
  postCustomerMessage,
  pollConversation,
  leaveConversation,
  getQueue,
  claimSession,
  getAdminSession,
  postAdminMessage,
  closeSession,
} = require("../controllers/liveChatControllers")

// ── customer side — unauthenticated, keyed by conversation_id ──
router.post("/escalate", escalate)
router.post("/message", postCustomerMessage)
router.get("/poll", pollConversation)
router.post("/leave", leaveConversation)

// ── admin side — admin or staff ──
router.get("/admin/queue", auth, requireAdminOrStaff, getQueue)
router.post("/admin/claim", auth, requireAdminOrStaff, claimSession)
router.get("/admin/session/:conversationId", auth, requireAdminOrStaff, getAdminSession)
router.post("/admin/message", auth, requireAdminOrStaff, postAdminMessage)
router.post("/admin/close", auth, requireAdminOrStaff, closeSession)

module.exports = router
