const db = require("../db");

const createOrder = async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const {
      user_id,
      firstName,
      lastName,
      phone,
      address,
      province,
      postalCode,
      payment_method,
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

    // Check availability and decrement stock. A "set" item (variant_id
    // present as set_variant_id in set_components) has no independent
    // stock of its own — it draws from its real component variants, so
    // decrementing here also keeps any other set sharing that component
    // correct (recomputed automatically by the DB trigger).
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
    const totalPrice = subtotal + shippingFee;

    // Upsert into the user's one default address (shared with the profile
    // page) instead of inserting a throwaway row every order. There's no
    // separate district/city field in the UI, so "province" (จังหวัด) is
    // stored in both the city and province columns until one exists.
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
            city = $4,
            province = $4,
            postal_code = $5
        WHERE address_id = $6
        `,
        [name, phone, address, province, postalCode, addressId]
      );
    } else {
      const addressResult = await client.query(
        `
        INSERT INTO addresses (
          user_id,
          recipient_name,
          phone,
          address_line1,
          city,
          province,
          postal_code
        )
        VALUES ($1,$2,$3,$4,$5,$5,$6)
        RETURNING address_id
        `,
        [user_id, name, phone, address, province, postalCode]
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
      address_line1: address,
      city: province,
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
        total_price
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING order_id
      `,
      [
        user_id,
        addressId,
        JSON.stringify(shippingSnapshot),
        subtotal,
        shippingFee,
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

// ---- Admin: list all orders (with items, address, payment info) ----
const getAllOrders = async (req, res) => {
  try {
    const ordersResult = await db.query(
      `
      SELECT
        o.order_id,
        o.user_id,
        o.status,
        o.payment_status,
        o.subtotal,
        o.shipping_fee,
        o.total_price,
        o.tracking_number,
        o.notes,
        o.ordered_at,
        o.updated_at,
        a.recipient_name,
        a.phone,
        a.address_line1,
        a.city,
        a.province,
        a.postal_code,
        pm.method AS payment_method,
        pm.amount AS payment_amount
      FROM orders o
      JOIN addresses a ON a.address_id = o.address_id
      LEFT JOIN payments pm ON pm.order_id = o.order_id
      ORDER BY o.ordered_at DESC
      `
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    const orderIds = orders.map((o) => o.order_id);

    const itemsResult = await db.query(
      `
      SELECT *
      FROM order_items
      WHERE order_id = ANY($1::int[])
      `,
      [orderIds]
    );

    const itemsByOrder = {};

    itemsResult.rows.forEach((item) => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push({
        name: item.product_name,
        variant: item.variant_desc,
        qty: item.quantity,
        price: Number(item.unit_price),
      });
    });

    const formatted = orders.map((o) => ({
      id: o.order_id,
      customer: o.recipient_name,
      phone: o.phone,
      address: [o.address_line1, o.city, o.province, o.postal_code]
        .filter(Boolean)
        .join(" "),
      items: itemsByOrder[o.order_id] || [],
      subtotal: Number(o.subtotal),
      shippingFee: Number(o.shipping_fee),
      total: Number(o.total_price),
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      trackingNumber: o.tracking_number,
      notes: o.notes,
      date: o.ordered_at,
    }));

    res.json(formatted);
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

    const orderResult = await db.query(
      `
      SELECT
        o.order_id,
        o.user_id,
        o.status,
        o.payment_status,
        o.subtotal,
        o.shipping_fee,
        o.total_price,
        o.tracking_number,
        o.notes,
        o.ordered_at,
        o.updated_at,
        a.recipient_name,
        a.phone,
        a.address_line1,
        a.city,
        a.province,
        a.postal_code,
        pm.method AS payment_method,
        pm.amount AS payment_amount
      FROM orders o
      JOIN addresses a ON a.address_id = o.address_id
      LEFT JOIN payments pm ON pm.order_id = o.order_id
      WHERE o.order_id = $1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    const itemsResult = await db.query(
      `
      SELECT *
      FROM order_items
      WHERE order_id = $1
      `,
      [id]
    );

    const o = orderResult.rows[0];

    res.json({
      id: o.order_id,
      customer: o.recipient_name,
      phone: o.phone,
      address: [o.address_line1, o.city, o.province, o.postal_code]
        .filter(Boolean)
        .join(" "),
      items: itemsResult.rows.map((item) => ({
        name: item.product_name,
        variant: item.variant_desc,
        qty: item.quantity,
        price: Number(item.unit_price),
      })),
      subtotal: Number(o.subtotal),
      shippingFee: Number(o.shipping_fee),
      total: Number(o.total_price),
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      trackingNumber: o.tracking_number,
      notes: o.notes,
      date: o.ordered_at,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

// ---- Admin: update order status (pending / shipping / completed / cancelled) ----
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await db.query(
      `
      UPDATE orders
      SET status = $2, updated_at = NOW()
      WHERE order_id = $1
      RETURNING order_id
      `,
      [id, status]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

// ---- Admin: update payment status (unpaid / pending_verification / paid / rejected) ----
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    const result = await db.query(
      `
      UPDATE orders
      SET payment_status = $2, updated_at = NOW()
      WHERE order_id = $1
      RETURNING order_id
      `,
      [id, payment_status]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Order Not Found",
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
};