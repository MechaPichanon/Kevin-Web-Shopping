const express = require("express");
const QRCode = require("qrcode");
const generatePayload = require("promptpay-qr");

const router = express.Router();

router.post("/promptpay", async (req, res) => {

    const { amount } = req.body;

    const payload = generatePayload(
        "0812345678",
        {
            amount
        }
    );

    const qr = await QRCode.toDataURL(payload);

    res.json({
        qr
    });

});

module.exports = router;