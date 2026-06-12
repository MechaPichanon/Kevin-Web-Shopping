const db = require("../db");

const addToCart = async (req, res) => {
  try {
    const { user_id, variant_id, quantity } = req.body;

    let cart = await db.query(
      `
      SELECT cart_id
      FROM carts
      WHERE user_id = $1
      `,
      [user_id]
    );

    let cartId;

    if (cart.rows.length === 0) {
      const newCart = await db.query(
        `
        INSERT INTO carts (user_id)
        VALUES ($1)
        RETURNING cart_id
        `,
        [user_id]
      );

      cartId = newCart.rows[0].cart_id;
    } else {
      cartId = cart.rows[0].cart_id;
    }

    await db.query(
      `
      INSERT INTO cart_items
      (
        cart_id,
        variant_id,
        quantity
      )
      VALUES ($1,$2,$3)

      ON CONFLICT (cart_id, variant_id)
      DO UPDATE
      SET quantity = cart_items.quantity + EXCLUDED.quantity
      `,
      [cartId, variant_id, quantity]
    );

    res.json({
      message: "เพิ่มลงตะกร้าแล้ว",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      error: "Server Error",
    });
  }
};

const getCart = async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await db.query(
      `
      SELECT
        ci.cart_item_id,
        ci.quantity,

        p.product_name,

        v.variant_id,
        v.price,

        pi.image_url

      FROM carts c

      JOIN cart_items ci
      ON c.cart_id = ci.cart_id

      JOIN variants v
      ON ci.variant_id = v.variant_id

      JOIN products p
      ON v.product_id = p.product_id

      LEFT JOIN product_images pi
      ON p.product_id = pi.product_id
      AND pi.is_primary = true

      WHERE c.user_id = $1
      `,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  addToCart,
  getCart,
};