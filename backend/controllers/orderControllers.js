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
      city,
      postalCode,
      payment_method,
    } = req.body;

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

    let subtotal = 0;

    cartItems.forEach((item) => {
      subtotal += item.price * item.quantity;
    });

    const shippingFee = subtotal >= 1500 ? 0 : 50;
    const totalPrice = subtotal + shippingFee;

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
      VALUES ($1,$2,$3,$4,$5,'-',$6)
      RETURNING address_id
      `,
      [
        user_id,
        name,
        phone,
        address,
        city,
        postalCode,
      ]
    );

    const addressId =
      addressResult.rows[0].address_id;

    const orderResult = await client.query(
      `
      INSERT INTO orders (
        user_id,
        address_id,
        subtotal,
        shipping_fee,
        total_price
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING order_id
      `,
      [
        user_id,
        addressId,
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

module.exports = {
  createOrder,
};