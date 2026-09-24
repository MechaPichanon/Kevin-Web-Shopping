const nodemailer = require("nodemailer");

// SMTP is optional. When unset (local dev default), callers fall back to a
// dev-mode response (e.g. returning the reset link directly in the API
// response) instead of actually sending mail.
function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Returns true if a real email was sent, false if SMTP isn't configured.
async function sendPasswordResetEmail(toEmail, resetLink) {
  const transporter = getTransporter();
  if (!transporter) return false;

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: toEmail,
    subject: "รีเซ็ตรหัสผ่าน KevinStore",
    html: `
      <p>คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี KevinStore ของคุณ</p>
      <p><a href="${resetLink}">คลิกที่นี่เพื่อตั้งรหัสผ่านใหม่</a></p>
      <p>ลิงก์นี้จะหมดอายุใน 15 นาที หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
    `,
  });
  return true;
}

module.exports = { sendPasswordResetEmail };
