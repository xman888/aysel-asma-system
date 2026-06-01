const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

// ============================================================
// الحصول على حركة المخزون
// ============================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const product_id = req.query.product_id;
    const movement_type = req.query.movement_type;

    const connection = await pool.getConnection();

    let query = 'SELECT im.*, p.name as product_name FROM inventory_movements im JOIN products p ON im.product_id = p.id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM inventory_movements WHERE 1=1';
    const params = [];

    if (product_id) {
      query += ' AND im.product_id = ?';
      countQuery += ' AND product_id = ?';
      params.push(product_id);
    }

    if (movement_type) {
      query += ' AND im.movement_type = ?';
      countQuery += ' AND movement_type = ?';
      params.push(movement_type);
    }

    const [totalRows] = await connection.query(countQuery, params);
    const total = totalRows[0].total;

    query += ` ORDER BY im.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    const [movements] = await connection.query(query, params);

    connection.release();

    res.json({
      total,
      page,
      limit,
      movements,
    });
  } catch (error) {
    logger.error('خطأ في جلب حركة المخزون:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// جرد المخزون (Inventory Check)
// ============================================================
router.post('/inventory-check', authenticateToken, authorize(['warehouse', 'manager', 'admin']), async (req, res) => {
  try {
    const { products } = req.body;
    const connection = await pool.getConnection();

    let adjustments = [];

    for (const item of products) {
      const [product] = await connection.query(
        'SELECT quantity_stock FROM products WHERE id = ?',
        [item.product_id]
      );

      if (product.length === 0) {
        connection.release();
        return res.status(404).json({ message: `المنتج ${item.product_id} غير موجود` });
      }

      const currentStock = product[0].quantity_stock;
      const difference = item.actual_quantity - currentStock;

      if (difference !== 0) {
        // تحديث المخزون
        await connection.query(
          'UPDATE products SET quantity_stock = ? WHERE id = ?',
          [item.actual_quantity, item.product_id]
        );

        // تسجيل حركة التعديل
        await connection.query(
          `INSERT INTO inventory_movements 
           (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
           VALUES (?, 'adjustment', ?, 'inventory_check', ?, ?, ?)`,
          [item.product_id, difference, 0, item.notes || null, req.userId]
        );

        adjustments.push({
          product_id: item.product_id,
          old_quantity: currentStock,
          new_quantity: item.actual_quantity,
          difference,
        });
      }
    }

    connection.release();

    logger.info(`✅ تم جرد المخزون: ${adjustments.length} تعديل`);

    res.json({
      message: 'تم جرد المخزون بنجاح',
      adjustments,
    });
  } catch (error) {
    logger.error('خطأ في جرد المخزون:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// إضافة تعديل على المخزون (تلف، فقدان، إلخ)
// ============================================================
router.post('/adjustment', authenticateToken, authorize(['warehouse', 'manager', 'admin']), async (req, res) => {
  try {
    const { product_id, quantity, adjustment_type, reason } = req.body;
    const connection = await pool.getConnection();

    const [product] = await connection.query(
      'SELECT quantity_stock FROM products WHERE id = ?',
      [product_id]
    );

    if (product.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }

    // تحديث المخزون
    const newQuantity = adjustment_type === 'add' 
      ? product[0].quantity_stock + quantity 
      : product[0].quantity_stock - quantity;

    if (newQuantity < 0) {
      connection.release();
      return res.status(400).json({ message: 'الكمية المطلوب طرحها أكبر من المتوفر' });
    }

    await connection.query(
      'UPDATE products SET quantity_stock = ? WHERE id = ?',
      [newQuantity, product_id]
    );

    // تسجيل الحركة
    const movementType = adjustment_type === 'add' ? 'in' : 'damage';
    await connection.query(
      `INSERT INTO inventory_movements 
       (product_id, movement_type, quantity, notes, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [product_id, movementType, quantity, reason || null, req.userId]
    );

    connection.release();

    logger.info(`✅ تم تعديل المخزون: ${product_id}`);

    res.status(201).json({
      message: 'تم تعديل المخزون بنجاح',
      new_quantity: newQuantity,
    });
  } catch (error) {
    logger.error('خطأ في تعديل المخزون:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// الحصول على المنتجات التي تحتاج إعادة تخزين (Low Stock)
// ============================================================
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [lowStock] = await connection.query(
      `SELECT id, name, sku, quantity_stock, min_stock_level, 
              (min_stock_level - quantity_stock) as needed_quantity
       FROM products 
       WHERE quantity_stock <= min_stock_level AND is_active = TRUE
       ORDER BY quantity_stock ASC`
    );

    connection.release();

    res.json({
      low_stock_products: lowStock,
      count: lowStock.length,
    });
  } catch (error) {
    logger.error('خطأ في جلب المنتجات الناقصة:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
