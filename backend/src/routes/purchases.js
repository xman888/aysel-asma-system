const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

// ============================================================
// إنشاء فاتورة شراء من مورد
// ============================================================
router.post('/', authenticateToken, authorize(['manager', 'admin']), [
  body('supplier_id').isInt().withMessage('المورد مطلوب'),
  body('items').isArray({ min: 1 }).withMessage('يجب اختيار منتج واحد على الأقل'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      supplier_id,
      items,
      discount_amount,
      payment_method,
      notes,
    } = req.body;

    const connection = await pool.getConnection();

    const purchaseNumber = `PUR-${Date.now()}`;
    let totalAmount = 0;
    let taxAmount = 0;

    // حساب الإجمالي
    for (const item of items) {
      const itemTotal = item.unit_price * item.quantity;
      totalAmount += itemTotal;
      const itemTax = (itemTotal * (item.tax_rate || 0)) / 100;
      taxAmount += itemTax;
    }

    totalAmount += taxAmount;
    const netAmount = totalAmount - (discount_amount || 0);

    // إدراج الشراء
    const [purchaseResult] = await connection.query(
      `INSERT INTO purchases 
       (purchase_number, supplier_id, purchase_date, status, total_amount, tax_amount, 
        discount_amount, net_amount, payment_method, payment_status, created_by, notes)
       VALUES (?, ?, NOW(), 'pending', ?, ?, ?, ?, ?, 'unpaid', ?, ?)`,
      [
        purchaseNumber,
        supplier_id,
        totalAmount,
        taxAmount,
        discount_amount || 0,
        netAmount,
        payment_method || 'cash',
        req.userId,
        notes || null,
      ]
    );

    const purchaseId = purchaseResult.insertId;

    // إدراج تفاصيل الشراء
    for (const item of items) {
      const itemTotal = item.unit_price * item.quantity;
      const itemTax = (itemTotal * (item.tax_rate || 0)) / 100;

      await connection.query(
        `INSERT INTO purchase_items 
         (purchase_id, product_id, quantity, unit_price, total_price, tax_rate, tax_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [purchaseId, item.product_id, item.quantity, item.unit_price, itemTotal, item.tax_rate || 0, itemTax]
      );
    }

    connection.release();

    logger.info(`✅ تم إنشاء فاتورة شراء: ${purchaseNumber}`);

    res.status(201).json({
      message: 'تم إنشاء فاتورة الشراء بنجاح',
      purchase: {
        id: purchaseId,
        purchase_number: purchaseNumber,
        total_amount: totalAmount,
        tax_amount: taxAmount,
        net_amount: netAmount,
      },
    });
  } catch (error) {
    logger.error('خطأ في إنشاء فاتورة الشراء:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// الحصول على قائمة المشتريات
// ============================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const connection = await pool.getConnection();

    let query = `SELECT p.*, s.name as supplier_name FROM purchases p
                 LEFT JOIN suppliers s ON p.supplier_id = s.id`;
    let countQuery = 'SELECT COUNT(*) as total FROM purchases';
    const params = [];

    if (status) {
      query += ' WHERE p.status = ?';
      countQuery += ' WHERE status = ?';
      params.push(status);
    }

    const [totalRows] = await connection.query(countQuery, params);
    const total = totalRows[0].total;

    query += ` ORDER BY p.purchase_date DESC LIMIT ${limit} OFFSET ${offset}`;
    const [purchases] = await connection.query(query, params);

    connection.release();

    res.json({
      total,
      page,
      limit,
      purchases,
    });
  } catch (error) {
    logger.error('خطأ في جلب المشتريات:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// الحصول على فاتورة شراء واحدة
// ============================================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    const [purchases] = await connection.query(
      `SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, s.email as supplier_email
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [id]
    );

    if (purchases.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'فاتورة الشراء غير موجودة' });
    }

    const [items] = await connection.query(
      `SELECT pi.*, p.name as product_name, p.sku 
       FROM purchase_items pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.purchase_id = ?`,
      [id]
    );

    connection.release();

    res.json({
      purchase: purchases[0],
      items,
    });
  } catch (error) {
    logger.error('خطأ في جلب فاتورة الشراء:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// تحديث حالة الشراء (pending -> received -> accepted)
// ============================================================
router.put('/:id/status', authenticateToken, authorize(['manager', 'admin']), [
  body('status').isIn(['pending', 'received', 'accepted', 'cancelled']).withMessage('حالة غير صحيحة'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;
    const connection = await pool.getConnection();

    const [purchase] = await connection.query(
      'SELECT * FROM purchases WHERE id = ?',
      [id]
    );

    if (purchase.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'فاتورة الشراء غير موجودة' });
    }

    // إذا تم قبول الشراء، يتم إضافة المنتجات للمخزون
    if (status === 'accepted' && purchase[0].status !== 'accepted') {
      const [items] = await connection.query(
        'SELECT * FROM purchase_items WHERE purchase_id = ?',
        [id]
      );

      for (const item of items) {
        // تحديث المخزون
        await connection.query(
          'UPDATE products SET quantity_stock = quantity_stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );

        // تسجيل حركة المخزون
        await connection.query(
          `INSERT INTO inventory_movements 
           (product_id, movement_type, quantity, reference_type, reference_id, created_by)
           VALUES (?, 'in', ?, 'purchase', ?, ?)`,
          [item.product_id, item.quantity, id, req.userId]
        );
      }
    }

    await connection.query(
      'UPDATE purchases SET status = ? WHERE id = ?',
      [status, id]
    );

    connection.release();

    logger.info(`✅ تم تحديث حالة الشراء: ${status}`);

    res.json({ message: 'تم تحديث حالة الشراء بنجاح' });
  } catch (error) {
    logger.error('خطأ في تحديث حالة الشراء:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// تحديث حالة الدفع
// ============================================================
router.put('/:id/payment', authenticateToken, authorize(['accountant', 'manager', 'admin']), [
  body('paid_amount').isDecimal().withMessage('المبلغ مطلوب'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { paid_amount, payment_method } = req.body;
    const connection = await pool.getConnection();

    const [purchase] = await connection.query(
      'SELECT * FROM purchases WHERE id = ?',
      [id]
    );

    if (purchase.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'فاتورة الشراء غير موجودة' });
    }

    const newPaidAmount = (purchase[0].paid_amount || 0) + paid_amount;
    const paymentStatus = newPaidAmount >= purchase[0].net_amount ? 'paid' : 'partial';

    await connection.query(
      'UPDATE purchases SET paid_amount = ?, payment_status = ?, payment_method = ? WHERE id = ?',
      [newPaidAmount, paymentStatus, payment_method || purchase[0].payment_method, id]
    );

    connection.release();

    logger.info(`✅ تم تحديث دفع الشراء`);

    res.json({
      message: 'تم تحديث الدفع بنجاح',
      payment_status: paymentStatus,
      paid_amount: newPaidAmount,
    });
  } catch (error) {
    logger.error('خطأ في تحديث الدفع:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
