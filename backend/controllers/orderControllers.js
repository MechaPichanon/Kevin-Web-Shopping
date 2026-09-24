const db = require("../db");
const { getValidDiscount } = require("./discountControllers");

const VALID_ORDER_STATUSES = ["pending", "confirmed", "shipped", "cancelled"];
const VALID_PAYMENT_STATUSES = [
  "unpaid",
  "pending_verification",
  "paid",
  "rejected",
];
// Orders auto-confirm this many days after being marked 'shipped' if the
// customer never clicks "I received it".
const ORDER_AUTO_CONFIRM_DAYS = Number(process.env.ORDER_AUTO_CONFIRM_DAYS) || 7;
// Slugs, not display labels — the frontend maps each to a Thai label + the
// courier's own tracking-page URL (see frontend/lib/couriers.ts).
const VALID_COURIERS = [
  "thailand_post",
  "kerry",
  "flash",
  "jt",
  "ninja_van",
  "dhl",
  "other",
];

const createOrder = async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const {
      user_id,
      firstName,
      lastName,
      phone,
      addressLine1,
      addressLine2 = "",
      province,
      postalCode,
      payment_method,
      discount_code,
    } = req.body;

    const name = `${firstName || ""} ${lastName || ""}`.trim();

    const cartResult = await client.query(
      `
      SELECT
        ci.quantity,
        v.variant_id,
        v.price,
        p.product_name
      FROM carts c
      JOIN cart_items ci ON c.cart_id = ci.cart_id
      JOIN variants v ON ci.variant_id = v.variant_id
      JOIN products p ON v.product_id = p.product_id
      WHERE c.user_id = $1
      `,
      [user_id]
    );

    const cartItems = cartResult.rows;

    if (cartItems.length === 0) {
      return res.status(400).json({
        error: "Cart Empty",
      });
    }

    for (const item of cartItems) {
      const setComponentsResult = await client.query(
        `SELECT component_variant_id, quantity FROM set_components WHERE set_variant_id = $1`,
        [item.variant_id]
      );

      if (setComponentsResult.rows.length > 0) {
        for (const comp of setComponentsResult.rows) {
          const needed = comp.quantity * item.quantity;
          const stockResult = await client.query(
            `SELECT stock FROM variants WHERE variant_id = $1 FOR UPDATE`,
            [comp.component_variant_id]
          );
          const available = stockResult.rows[0]?.stock ?? 0;
          if (available < needed) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              error: `สินค้าบางรายการในเซ็ต "${item.product_name}" มีไม่เพียงพอ`,
            });
          }
          await client.query(
            `UPDATE variants SET stock = stock - $1 WHERE variant_id = $2`,
            [needed, comp.component_variant_id]
          );
        }
      } else {
        const stockResult = await client.query(
          `SELECT stock FROM variants WHERE variant_id = $1 FOR UPDATE`,
          [item.variant_id]
        );
        const available = stockResult.rows[0]?.stock ?? 0;
        if (available < item.quantity) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `สินค้า "${item.product_name}" มีไม่เพียงพอ`,
          });
        }
        await client.query(
          `UPDATE variants SET stock = stock - $1 WHERE variant_id = $2`,
          [item.quantity, item.variant_id]
        );
      }
    }

    let subtotal = 0;

    cartItems.forEach((item) => {
      subtotal += item.price * item.quantity;
    });

    const shippingFee = subtotal >= 1500 ? 0 : 50;

    // Discount is always re-validated and recalculated server-side here —
    // never trust discount_amount from the client, since it can be edited
    // via devtools before the request is sent.
    let discountAmount = 0;
    let appliedDiscountCodeId = null;

    if (discount_code) {
      const discountResult = await getValidDiscount(discount_code, subtotal, client, user_id);
      if (discountResult.error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: discountResult.error });
      }
      discountAmount = discountResult.discountAmount;
      appliedDiscountCodeId = discountResult.discount.code_id;
    }

    const totalPrice = Math.max(0, subtotal - discountAmount) + shippingFee;

    const defaultAddressResult = await client.query(
      `SELECT a.address_id
       FROM user_addresses ua
       JOIN addresses a ON a.address_id = ua.address_id
       WHERE ua.user_id = $1 AND ua.is_default = TRUE`,
      [user_id]
    );

    let addressId;
    if (defaultAddressResult.rows.length > 0) {
      addressId = defaultAddressResult.rows[0].address_id;
      await client.query(
        `
        UPDATE addresses
        SET recipient_name = $1,
            phone = $2,
            address_line1 = $3,
            address_line2 = $4,
            province = $5,
            postal_code = $6
        WHERE address_id = $7
        `,
        [name, phone, addressLine1, addressLine2, province, postalCode, addressId]
      );
    } else {
      const addressResult = await client.query(
        `
        INSERT INTO addresses (
          user_id,
          recipient_name,
          phone,
          address_line1,
          address_line2,
          province,
          postal_code
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING address_id
        `,
        [user_id, name, phone, addressLine1, addressLine2, province, postalCode]
      );

      addressId = addressResult.rows[0].address_id;

      await client.query(
        `INSERT INTO user_addresses (user_id, address_id, is_default) VALUES ($1, $2, TRUE)`,
        [user_id, addressId]
      );
    }

    const shippingSnapshot = {
      recipient_name: name,
      phone,
      address_line1: addressLine1,
      address_line2: addressLine2,
      province,
      postal_code: postalCode,
    };

    const orderResult = await client.query(
      `
      INSERT INTO orders (
        user_id,
        address_id,
        shipping_snapshot,
        subtotal,
        shipping_fee,
        discount_code,
        discount_amount,
        total_price
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING order_id
      `,
      [
        user_id,
        addressId,
        JSON.stringify(shippingSnapshot),
        subtotal,
        shippingFee,
        discount_code || null,
        discountAmount,
        totalPrice,
      ]
    );

    const orderId =
      orderResult.rows[0].order_id;

    for (const item of cartItems) {
      await client.query(
        `
        INSERT INTO order_items (
          order_id,
          variant_id,
          product_name,
          variant_desc,
          quantity,
          unit_price,
          subtotal
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          orderId,
          item.variant_id,
          item.product_name,
          "-",
          item.quantity,
          item.price,
          item.price * item.quantity,
        ]
      );
    }

    await client.query(
      `
      INSERT INTO payments (
        order_id,
        method,
        amount
      )
      VALUES ($1,$2,$3)
      `,
      [
        orderId,
        payment_method,
        totalPrice,
      ]
    );

    if (appliedDiscountCodeId) {
      await client.query(
        `UPDATE discount_codes SET used_count = used_count + 1 WHERE code_id = $1`,
        [appliedDiscountCodeId]
      );
    }

    await client.query(
      `
      DELETE FROM cart_items
      WHERE cart_id IN (
        SELECT cart_id
        FROM carts
        WHERE user_id = $1
      )
      `,
      [user_id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      order_id: orderId,
      subtotal,
      shippingFee,
      discountAmount,
      totalPrice,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  } finally {
    client.release();
  }
};

// ── Shared helpers: reverse the side effects of createOrder ────────────────
// restoreOrderStock is the mirror image of the stock-decrement loop at the top
// of createOrder. CONTRACT: the caller must already hold
// `SELECT ... FROM orders WHERE order_id = $1 FOR UPDATE` in the same
// transaction AND must only call this when the order is NOT already
// 'cancelled' — otherwise stock is inflated on a repeat call.
async function restoreOrderStock(client, orderId) {
  const { rows: items } = await client.query(
    `SELECT variant_id, quantity FROM order_items WHERE order_id = $1`,
    [orderId]
  );

  for (const item of items) {
    const { rows: comps } = await client.query(
      `SELECT component_variant_id, quantity FROM set_components WHERE set_variant_id = $1`,
      [item.variant_id]
    );

    if (comps.length > 0) {
      for (const comp of comps) {
        await client.query(
          `UPDATE variants SET stock = stock + $1 WHERE variant_id = $2`,
          [comp.quantity * item.quantity, comp.component_variant_id]
        );
      }
    } else {
      await client.query(
        `UPDATE variants SET stock = stock + $1 WHERE variant_id = $2`,
        [item.quantity, item.variant_id]
      );
    }
  }
}

// Give back one use of a discount code. orders.discount_code stores the raw
// code text the customer typed; getValidDiscount (which did the increment)
// resolves it as trim().toUpperCase() — match that exactly here or the
// decrement silently no-ops. No-op when the order carried no code.
async function restoreDiscountUse(client, discountCode) {
  if (!discountCode || !discountCode.trim()) return;
  await client.query(
    `UPDATE discount_codes SET used_count = GREATEST(used_count - 1, 0) WHERE code = $1`,
    [discountCode.trim().toUpperCase()]
  );
}

// Shared: order_items joined with variants so each item also carries the
// product_id it belongs to — needed for the review flow (reviews.product_id).
async function itemsByOrderId(orderIds) {
  const itemsResult = await db.query(
    `
    SELECT oi.*, v.product_id
    FROM order_items oi
    JOIN variants v ON v.variant_id = oi.variant_id
    WHERE oi.order_id = ANY($1::int[])
    `,
    [orderIds]
  );

  const map = {};
  itemsResult.rows.forEach((item) => {
    if (!map[item.order_id]) map[item.order_id] = [];
    map[item.order_id].push({
      productId: item.product_id,
      name: item.product_name,
      variant: item.variant_desc,
      qty: item.quantity,
      price: Number(item.unit_price),
    });
  });
  return map;
}

async function itemsForOrder(orderId) {
  const itemsResult = await db.query(
    `
    SELECT oi.*, v.product_id
    FROM order_items oi
    JOIN variants v ON v.variant_id = oi.variant_id
    WHERE oi.order_id = $1
    `,
    [orderId]
  );

  return itemsResult.rows.map((item) => ({
    productId: item.product_id,
    name: item.product_name,
    variant: item.variant_desc,
    qty: item.quantity,
    price: Number(item.unit_price),
  }));
}

// Payment-slip history for one or more orders (oldest → newest). Fetched
// separately, not JOINed into ORDER_SELECT, to avoid fanning out order rows.
async function slipsByOrderId(orderIds) {
  const result = await db.query(
    `
    SELECT order_id, slip_url, status, reject_reason, uploaded_at
    FROM payment_slips
    WHERE order_id = ANY($1::int[])
    ORDER BY uploaded_at ASC, slip_id ASC
    `,
    [orderIds]
  );

  const map = {};
  result.rows.forEach((s) => {
    if (!map[s.order_id]) map[s.order_id] = [];
    map[s.order_id].push(s);
  });
  return map;
}

async function slipsForOrder(orderId) {
  const result = await db.query(
    `
    SELECT order_id, slip_url, status, reject_reason, uploaded_at
    FROM payment_slips
    WHERE order_id = $1
    ORDER BY uploaded_at ASC, slip_id ASC
    `,
    [orderId]
  );
  return result.rows;
}

function formatOrderRow(o, items, slips) {
  const snap = o.shipping_snapshot || {};
  const recipient = snap.recipient_name || o.recipient_name;
  const phone = snap.phone || o.phone;
  const addressLine1 = snap.address_line1 || o.address_line1;
  const addressLine2 = snap.address_line2 || o.address_line2;
  const province = snap.province || o.province;
  const postalCode = snap.postal_code || o.postal_code;

  return {
    id: o.order_id,
    customer: recipient,
    phone,
    address: [addressLine1, addressLine2, province, postalCode]
      .filter(Boolean)
      .join(" "),
    items: items || [],
    subtotal: Number(o.subtotal),
    shippingFee: Number(o.shipping_fee),
    discountCode: o.discount_code || null,
    discountAmount: o.discount_amount != null ? Number(o.discount_amount) : 0,
    total: Number(o.total_price),
    status: o.status,
    paymentStatus: o.payment_status,
    paymentSlipUrl: o.payment_slip_url,
    paymentMethod: o.payment_method,
    trackingNumber: o.tracking_number,
    courierName: o.courier_name,
    notes: o.notes,
    slips: (slips || []).map((s) => ({
      url: s.slip_url,
      status: s.status,
      rejectReason: s.reject_reason,
      uploadedAt: s.uploaded_at,
    })),
    // Only surfaced while the order is actually in the rejected state — a later
    // approved slip must not leave a stale reason showing on a paid order.
    paymentRejectReason:
      o.payment_status === "rejected"
        ? [...(slips || [])].reverse().find((s) => s.status === "rejected")
            ?.reject_reason || null
        : null,
    date: o.ordered_at,
  };
}

const ORDER_SELECT = `
  SELECT
    o.order_id,
    o.user_id,
    o.status,
    o.payment_status,
    o.payment_slip_url,
    o.subtotal,
    o.shipping_fee,
    o.discount_code,
    o.discount_amount,
    o.total_price,
    o.tracking_number,
    o.courier_name,
    o.notes,
    o.ordered_at,
    o.updated_at,
    o.shipping_snapshot,
    a.recipient_name,
    a.phone,
    a.address_line1,
    a.address_line2,
    a.province,
    a.postal_code,
    pm.method AS payment_method,
    pm.amount AS payment_amount
  FROM orders o
  JOIN addresses a ON a.address_id = o.address_id
  LEFT JOIN payments pm ON pm.order_id = o.order_id
`;

// ---- Customer: list the logged-in user's own orders ----
const getMyOrders = async (req, res) => {
  try {
    const user_id = req.user.id;

    const ordersResult = await db.query(
      `${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.ordered_at DESC`,
      [user_id]
    );

    const orders = ordersResult.rows;
    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((o) => o.order_id);
    const itemsMap = await itemsByOrderId(orderIds);
    const slipsMap = await slipsByOrderId(orderIds);
    res.json(
      orders.map((o) =>
        formatOrderRow(o, itemsMap[o.order_id], slipsMap[o.order_id])
      )
    );
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

// ---- Customer: get one of the logged-in user's own orders ----
const getMyOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const orderResult = await db.query(
      `${ORDER_SELECT} WHERE o.order_id = $1 AND o.user_id = $2`,
      [id, user_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    const items = await itemsForOrder(id);
    const slips = await slipsForOrder(id);
    res.json(formatOrderRow(orderResult.rows[0], items, slips));
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

// ---- Admin: list all orders (with items, address, payment info) ----
const getAllOrders = async (req, res) => {
  try {
    const ordersResult = await db.query(`${ORDER_SELECT} ORDER BY o.ordered_at DESC`);

    const orders = ordersResult.rows;
    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((o) => o.order_id);
    const itemsMap = await itemsByOrderId(orderIds);
    const slipsMap = await slipsByOrderId(orderIds);
    res.json(
      orders.map((o) =>
        formatOrderRow(o, itemsMap[o.order_id], slipsMap[o.order_id])
      )
    );
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

// ---- Admin: get one order ----
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await db.query(`${ORDER_SELECT} WHERE o.order_id = $1`, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    const items = await itemsForOrder(id);
    const slips = await slipsForOrder(id);
    res.json(formatOrderRow(orderResult.rows[0], items, slips));
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

// ---- Admin: update order status (pending / confirmed / shipped / cancelled) ----
const updateOrderStatus = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
      });
    }

    await client.query("BEGIN");

    const current = await client.query(
      `SELECT status, discount_code FROM orders WHERE order_id = $1 FOR UPDATE`,
      [id]
    );

    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    const wasReversed = current.rows[0].status === "cancelled";
    const nowReversed = status === "cancelled";

    // cancelled is terminal: stock and the discount use have already been
    // handed back, so moving back to pending/etc. would be a lie and would
    // let the restock run a second time on the next cancel. Refuse it.
    if (wasReversed && !nowReversed) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "คำสั่งซื้อที่ยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะได้",
      });
    }

    // First transition into cancelled: hand stock + discount use back.
    // The wasReversed guard above means this runs at most once per order.
    if (nowReversed && !wasReversed) {
      await restoreOrderStock(client, id);
      await restoreDiscountUse(client, current.rows[0].discount_code);
      await client.query(
        `UPDATE payments SET status = 'failed' WHERE order_id = $1`,
        [id]
      );
    }

    // Stamp shipped_at the first time status becomes 'shipped' — it drives
    // the "I received it" button's eligibility and the auto-confirm sweep,
    // and must not be reset by unrelated later updates (e.g. tracking info).
    await client.query(
      `UPDATE orders
       SET status = $2::varchar,
           shipped_at = CASE WHEN $2::varchar = 'shipped'::varchar AND status <> 'shipped'
                              THEN NOW() ELSE shipped_at END,
           updated_at = NOW()
       WHERE order_id = $1`,
      [id, status]
    );

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  } finally {
    client.release();
  }
};

// ---- Admin: set courier + tracking number (no courier API integration — the
// customer looks it up on the courier's own site) ----
const updateOrderTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const { tracking_number, courier_name } = req.body;

    if (courier_name && !VALID_COURIERS.includes(courier_name)) {
      return res.status(400).json({
        error: `Invalid courier_name. Must be one of: ${VALID_COURIERS.join(", ")}`,
      });
    }

    const result = await db.query(
      `UPDATE orders
       SET tracking_number = $2, courier_name = $3, updated_at = NOW()
       WHERE order_id = $1
       RETURNING order_id`,
      [id, tracking_number || null, courier_name || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order Not Found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// ---- Admin: update payment status (unpaid / pending_verification / paid / rejected) ----
const updatePaymentStatus = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;
    const { payment_status, reason } = req.body;

    if (!VALID_PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        error: `Invalid payment_status. Must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `
      UPDATE orders
      SET payment_status = $2, updated_at = NOW()
      WHERE order_id = $1
      RETURNING order_id
      `,
      [id, payment_status]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    if (payment_status === "paid") {
      await client.query(
        `UPDATE payments SET status = 'success', paid_at = NOW() WHERE order_id = $1`,
        [id]
      );
    } else if (payment_status === "rejected") {
      await client.query(
        `UPDATE payments SET status = 'failed' WHERE order_id = $1`,
        [id]
      );
    }

    // Record the verdict on the most recent slip. Re-rejecting an already
    // rejected order just overwrites reject_reason — this is how the admin
    // "sends more detail" to the customer.
    if (payment_status === "paid" || payment_status === "rejected") {
      const latestSlip = await client.query(
        `SELECT slip_id FROM payment_slips
         WHERE order_id = $1
         ORDER BY uploaded_at DESC, slip_id DESC
         LIMIT 1`,
        [id]
      );

      if (latestSlip.rows.length > 0) {
        const slipId = latestSlip.rows[0].slip_id;
        if (payment_status === "rejected") {
          await client.query(
            `UPDATE payment_slips
             SET status = 'rejected', reject_reason = $2, reviewed_by = $3, reviewed_at = NOW()
             WHERE slip_id = $1`,
            [slipId, reason ?? null, req.user.id]
          );
        } else {
          await client.query(
            `UPDATE payment_slips
             SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
             WHERE slip_id = $1`,
            [slipId, req.user.id]
          );
        }
      }
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  } finally {
    client.release();
  }
};

// ---- Customer: upload a payment slip for an existing order (checkout flow) ----
const uploadPaymentSlip = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error: "No slip file uploaded",
      });
    }

    const slipUrl = `http://localhost:5000/uploads/${req.file.filename}`;

    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT status, payment_status FROM orders WHERE order_id = $1 FOR UPDATE`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order Not Found" });
    }

    const { status, payment_status } = orderResult.rows[0];
    if (
      payment_status === "paid" ||
      ["confirmed", "shipped", "cancelled"].includes(status)
    ) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "ไม่สามารถอัปโหลดสลิปสำหรับคำสั่งซื้อนี้ได้" });
    }

    await client.query(
      `INSERT INTO payment_slips (order_id, slip_url) VALUES ($1, $2)`,
      [id, slipUrl]
    );

    await client.query(
      `
      UPDATE orders
      SET payment_slip_url = $2, payment_status = 'pending_verification', updated_at = NOW()
      WHERE order_id = $1
      `,
      [id, slipUrl]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      payment_slip_url: slipUrl,
      payment_status: "pending_verification",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  } finally {
    client.release();
  }
};

// ---- Customer: re-upload a slip after the previous one was rejected ----
const customerReuploadPaymentSlip = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No slip file uploaded" });
    }

    const slipUrl = `http://localhost:5000/uploads/${req.file.filename}`;

    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT user_id, payment_status FROM orders WHERE order_id = $1 FOR UPDATE`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order Not Found" });
    }

    if (orderResult.rows[0].user_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    if (orderResult.rows[0].payment_status !== "rejected") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "อัปโหลดสลิปใหม่ได้เฉพาะเมื่อสลิปถูกปฏิเสธ",
      });
    }

    // New history row; the earlier rejected slip(s) stay on record.
    await client.query(
      `INSERT INTO payment_slips (order_id, slip_url) VALUES ($1, $2)`,
      [id, slipUrl]
    );

    await client.query(
      `
      UPDATE orders
      SET payment_slip_url = $2, payment_status = 'pending_verification', updated_at = NOW()
      WHERE order_id = $1
      `,
      [id, slipUrl]
    );

    await client.query(
      `UPDATE payments SET status = 'pending' WHERE order_id = $1`,
      [id]
    );

    await client.query("COMMIT");

    res.json({ success: true, payment_status: "pending_verification" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  } finally {
    client.release();
  }
};

// ---- Customer: cancel own order (restores stock + one discount-code use) ----
const cancelMyOrder = async (req, res) => {
  const client = await db.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT user_id, status, payment_status, discount_code
       FROM orders WHERE order_id = $1 FOR UPDATE`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order Not Found" });
    }

    const order = orderResult.rows[0];

    if (order.user_id !== req.user.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    const cancellable =
      order.status === "pending" &&
      ["unpaid", "pending_verification", "rejected"].includes(order.payment_status);

    if (!cancellable) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "คำสั่งซื้อนี้ไม่สามารถยกเลิกได้" });
    }

    await restoreOrderStock(client, id);
    await restoreDiscountUse(client, order.discount_code);

    await client.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE order_id = $1`,
      [id]
    );
    await client.query(
      `UPDATE payments SET status = 'failed' WHERE order_id = $1`,
      [id]
    );

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  } finally {
    client.release();
  }
};

// ---- Customer: "I received it" — confirm receipt of a shipped order ----
const confirmMyOrderReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE orders SET status = 'confirmed', updated_at = NOW()
       WHERE order_id = $1 AND user_id = $2 AND status = 'shipped'
       RETURNING order_id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        error: "ไม่สามารถยืนยันการรับสินค้าสำหรับคำสั่งซื้อนี้ได้",
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Error" });
  }
};

// ---- Background sweep: auto-confirm orders shipped for too long without the
// customer confirming receipt themselves. Called once at server startup and
// then on an hourly setInterval (see server.js) — no cron dependency needed
// since a plain periodic UPDATE is all this requires. ----
const autoConfirmShippedOrders = async () => {
  try {
    const result = await db.query(
      `UPDATE orders SET status = 'confirmed', updated_at = NOW()
       WHERE status = 'shipped'
         AND shipped_at < NOW() - ($1 || ' days')::INTERVAL
       RETURNING order_id`,
      [ORDER_AUTO_CONFIRM_DAYS]
    );

    if (result.rows.length > 0) {
      console.log(`Auto-confirmed ${result.rows.length} order(s) shipped for over ${ORDER_AUTO_CONFIRM_DAYS} day(s).`);
    }
  } catch (err) {
    console.error("autoConfirmShippedOrders error:", err);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderTracking,
  updatePaymentStatus,
  uploadPaymentSlip,
  customerReuploadPaymentSlip,
  cancelMyOrder,
  confirmMyOrderReceipt,
  autoConfirmShippedOrders,
};
