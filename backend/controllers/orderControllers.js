const db = require("../db");

const createOrder = async (req, res) => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const {
      user_id,
      name,
      phone,
      address,
      address_line2,
      postalCode,
      payment_method,
    } = req.body;

    const cartResult = await client.query(
      `
      SELECT
        ci.quantity,
        v.variant_id,
        v.price,
        p.product_name,
        pi.image_url
      FROM carts c
      JOIN cart_items ci ON c.cart_id = ci.cart_id
      JOIN variants v ON ci.variant_id = v.variant_id
      JOIN products p ON v.product_id = p.product_id
      LEFT JOIN product_images pi
        ON pi.product_id = p.product_id
        AND pi.is_primary = true
      WHERE c.user_id = $1
      `,
      [user_id]
    );

    const cartItems = cartResult.rows;

    if (cartItems.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Cart Empty",
      });
    }

    let subtotal = 0;

    cartItems.forEach((item) => {
      subtotal += Number(item.price) * item.quantity;
    });

    const shippingFee =
      subtotal >= 1500 ? 0 : 50;

    const totalPrice =
      subtotal + shippingFee;

    const addressResult = await client.query(
      `
      INSERT INTO addresses
      (
        user_id,
        recipient_name,
        phone,
        address_line1,
        address_line2,
        province,
        postal_code
      )
      VALUES
      ($1,$2,$3,$4,$5,'-',$6)
      RETURNING address_id
      `,
      [
        user_id,
        name,
        phone,
        address,
        address_line2,
        postalCode,
      ]
    );

    const addressId =
      addressResult.rows[0].address_id;

    const orderResult =
      await client.query(
        `
        INSERT INTO orders
        (
          user_id,
          address_id,
          subtotal,
          shipping_fee,
          total_price
        )
        VALUES
        ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          user_id,
          addressId,
          subtotal,
          shippingFee,
          totalPrice,
        ]
      );

    const order =
      orderResult.rows[0];

    for (const item of cartItems) {
      await client.query(
        `
        INSERT INTO order_items
        (
          order_id,
          variant_id,
          product_name,
          variant_desc,
          quantity,
          unit_price,
          subtotal
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          order.order_id,
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
      INSERT INTO payments
      (
        order_id,
        method,
        amount
      )
      VALUES
      ($1,$2,$3)
      `,
      [
        order.order_id,
        payment_method,
        totalPrice,
      ]
    );

    await client.query(
      `
      DELETE FROM cart_items
      WHERE cart_id IN
      (
        SELECT cart_id
        FROM carts
        WHERE user_id=$1
      )
      `,
      [user_id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      order_id: order.order_id,
      total_price: totalPrice,
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

const getMyOrders = async (req, res) => {

  try {

    const user_id = req.user.id

    const result = await db.query(
      `
      SELECT

      order_id,
      status,
      payment_status,
      total_price,
      ordered_at

      FROM orders

      WHERE user_id=$1

      ORDER BY ordered_at DESC
      `,
      [user_id]
    );

    res.json(result.rows);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Server Error"
    });

  }

};

const getMyOrderById = async (req, res) => {
  try {
    const { id } = req.params
    const user_id = req.user.id  // จาก auth middleware

    const orderResult = await db.query(
      `SELECT 
        o.order_id, o.status, o.payment_status,
        o.total_price, o.shipping_fee, o.subtotal, o.ordered_at,
        a.recipient_name, a.phone,
        a.address_line1, a.address_line2, a.province, a.postal_code,
        p.method AS payment_method
       FROM orders o
       JOIN addresses a ON o.address_id = a.address_id
       LEFT JOIN payments p ON p.order_id = o.order_id
       WHERE o.order_id = $1 AND o.user_id = $2`, 
    [id, user_id]
    )

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" })
    }

    const itemsResult = await db.query(
      `SELECT product_name, variant_desc, quantity, unit_price
       FROM order_items WHERE order_id = $1`,
      [id]
    )

    const order = orderResult.rows[0]
    res.json({
      id: order.order_id,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shipping_fee),
      total: Number(order.total_price),
      orderedAt: order.ordered_at,
      recipient: order.recipient_name,
      phone: order.phone,
      address: `${order.address_line1} ${order.address_line2} ${order.province} ${order.postal_code}`,
      paymentMethod: order.payment_method,
      items: itemsResult.rows
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Server Error" })
  }


};

// =========================
// Admin : Get All Orders
// =========================

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

        a.recipient_name,
        a.phone,
        a.address_line1,
        a.address_line2,
        a.province,
        a.postal_code,

        p.method AS payment_method,
        p.amount

      FROM orders o

      LEFT JOIN addresses a
      ON a.address_id = o.address_id

      LEFT JOIN payments p
      ON p.order_id = o.order_id

      ORDER BY o.ordered_at DESC
      `
    );

    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.json([]);
    }

    const ids = orders.map(o => o.order_id);

    const itemsResult = await db.query(
      `
      SELECT
        order_id,
        product_name,
        variant_desc,
        quantity,
        unit_price

      FROM order_items

      WHERE order_id = ANY($1::int[])
      `,
      [ids]
    );

    const itemsMap = {};

    itemsResult.rows.forEach(item => {

      if (!itemsMap[item.order_id]) {
        itemsMap[item.order_id] = [];
      }

      itemsMap[item.order_id].push({

        name: item.product_name,

        variant: item.variant_desc,

        qty: item.quantity,

        price: Number(item.unit_price)

      });

    });

    const data = orders.map(order => ({

      id: order.order_id,

      customer: order.recipient_name,

      phone: order.phone,

      address:
        `${order.address_line1}
${order.address_line2}
${order.province}
${order.postal_code}`,

      items:
        itemsMap[order.order_id] || [],

      subtotal:
        Number(order.subtotal),

      shippingFee:
        Number(order.shipping_fee),

      total:
        Number(order.total_price),

      paymentMethod:
        order.payment_method,

      paymentStatus:
        order.payment_status,

      status:
        order.status,

      trackingNumber:
        order.tracking_number,

      notes:
        order.notes,

      date:
        order.ordered_at

    }));

    res.json(data);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Server Error"
    });

  }
};


// =========================
// Admin : Get Order Detail
// =========================

const getOrderById = async (req, res) => {

  try {

    const { id } = req.params;

    const orderResult = await db.query(
      `
      SELECT

      o.order_id,
      o.status,
      o.payment_status,
      o.subtotal,
      o.shipping_fee,
      o.total_price,
      o.tracking_number,
      o.notes,
      o.ordered_at,

      a.recipient_name,
      a.phone,
      a.address_line1,
      a.address_line2,
      a.province,
      a.postal_code,

      p.method

      FROM orders o

      LEFT JOIN addresses a
      ON a.address_id=o.address_id

      LEFT JOIN payments p
      ON p.order_id=o.order_id

      WHERE o.order_id=$1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {

      return res.status(404).json({
        error: "Order not found"
      });

    }

    const itemsResult = await db.query(
      `
      SELECT

      product_name,
      variant_desc,
      quantity,
      unit_price

      FROM order_items

      WHERE order_id=$1
      `,
      [id]
    );

    const order = orderResult.rows[0];

    res.json({

      id: order.order_id,

      customer:
        order.recipient_name,

      phone:
        order.phone,

      address:
        `${order.address_line1}
${order.address_line2}
${order.province}
${order.postal_code}`,

      subtotal:
        Number(order.subtotal),

      shippingFee:
        Number(order.shipping_fee),

      total:
        Number(order.total_price),

      paymentMethod:
        order.method,

      paymentStatus:
        order.payment_status,

      trackingNumber:
        order.tracking_number,

      notes:
        order.notes,

      status:
        order.status,

      orderedAt:
        order.ordered_at,

      items:
        itemsResult.rows

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Server Error"
    });

  }

};


// =========================
// Update Status
// =========================

const updateOrderStatus = async (req, res) => {

  try {

    const { id } = req.params;

    const { status } = req.body;

    await db.query(
      `
      UPDATE orders

      SET status=$1,
      updated_at=NOW()

      WHERE order_id=$2
      `,
      [
        status,
        id
      ]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Server Error"
    });

  }

};


// =========================
// Update Payment
// =========================

const updatePaymentStatus = async (req, res) => {

  try {

    const { id } = req.params;

    const { payment_status } = req.body;

    await db.query(
      `
      UPDATE orders

      SET payment_status=$1,
      updated_at=NOW()

      WHERE order_id=$2
      `,
      [
        payment_status,
        id
      ]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Server Error"
    });

  }

};


// =========================
// Export
// =========================

module.exports = {

  createOrder,

  getMyOrders,

  getMyOrderById,

  getAllOrders,

  getOrderById,

  updateOrderStatus,

  updatePaymentStatus

};