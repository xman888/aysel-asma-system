const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');
const logger = require('../config/logger');

// ============================================================
// تقرير المبيعات اليومية
// ============================================================
router.get('/daily-sales', authenticateToken, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const connection = await pool.getConnection();

    const [dailySales] = await connection.query(
      `SELECT 
        DATE(sale_date) as sale_date,
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        COUNT(DISTINCT customer_id) as unique_customers,
        SUM(tax_amount) as total_tax,
        SUM(discount_amount) as total_discount
      FROM sales
      WHERE DATE(sale_date) = ? AND status = 'completed'
      GROUP BY DATE(sale_date)`,
      [date]
    );

    connection.release();

    if (dailySales.length === 0) {
      return res.json({
        sale_date: date,
        total_sales: 0,
        total_revenue: 0,
        unique_customers: 0,
        total_tax: 0,
        total_discount: 0,
      });
    }

    res.json(dailySales[0]);
  } catch (error) {
    logger.error('خطأ في تقرير المبيعات اليومية:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// تقرير الأرباح والخسائر
// ============================================================
router.get('/profit-loss', authenticateToken, async (req, res) => {
  try {
    const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = req.query.end_date || new Date().toISOString().split('T')[0];
    const connection = await pool.getConnection();

    // إجمالي الإيرادات من المبيعات
    const [sales] = await connection.query(
      `SELECT SUM(total_amount) as total_revenue, SUM(tax_amount) as total_tax
       FROM sales
       WHERE DATE(sale_date) BETWEEN ? AND ? AND status = 'completed'`,
      [startDate, endDate]
    );

    // إجمالي تكاليف المشتريات
    const [purchases] = await connection.query(
      `SELECT SUM(net_amount) as total_cost
       FROM purchases
       WHERE DATE(purchase_date) BETWEEN ? AND ? AND status = 'accepted'`,
      [startDate, endDate]
    );

    connection.release();

    const totalRevenue = sales[0]?.total_revenue || 0;
    const totalCost = purchases[0]?.total_cost || 0;
    const profit = totalRevenue - totalCost;

    res.json({
      period: `${startDate} to ${endDate}`,
      total_revenue: totalRevenue,
      total_cost: totalCost,
      total_profit: profit,
      profit_margin: totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    logger.error('خطأ في تقرير الأرباح والخسائر:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// أفضل المنتجات مبيعاً
// ============================================================
router.get('/top-products', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const connection = await pool.getConnection();

    const [topProducts] = await connection.query(
      `SELECT 
        p.id, p.name, c.name as category,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN sale_items si ON p.id = si.product_id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'completed'
      GROUP BY p.id, p.name, c.name
      ORDER BY total_quantity DESC
      LIMIT ?`,
      [parseInt(limit)]
    );

    connection.release();

    res.json({ products: topProducts });
  } catch (error) {
    logger.error('خطأ في تقرير أفضل المنتجات:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// أفضل العملاء
// ============================================================
router.get('/top-customers', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const connection = await pool.getConnection();

    const [topCustomers] = await connection.query(
      `SELECT 
        id, name, customer_type, total_purchases, total_paid, 
        loyalty_points, COUNT(*) as purchase_count
      FROM customers
      ORDER BY total_purchases DESC
      LIMIT ?`,
      [parseInt(limit)]
    );

    connection.release();

    res.json({ customers: topCustomers });
  } catch (error) {
    logger.error('خطأ في تقرير أفضل العملاء:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// تقرير حركة المخزون
// ============================================================
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = req.query.end_date || new Date().toISOString().split('T')[0];
    const connection = await pool.getConnection();

    const [movements] = await connection.query(
      `SELECT 
        movement_type, COUNT(*) as count, SUM(quantity) as total_quantity
      FROM inventory_movements
      WHERE DATE(created_at) BETWEEN ? AND ?
      GROUP BY movement_type`,
      [startDate, endDate]
    );

    connection.release();

    res.json({
      period: `${startDate} to ${endDate}`,
      movements,
    });
  } catch (error) {
    logger.error('خطأ في تقرير حركة المخزون:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ============================================================
// تقرير الموظفين
// ============================================================
router.get('/employees', authenticateToken, authorize(['admin', 'manager', 'accountant']), async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().split('-').slice(0, 2).join('-');
    const connection = await pool.getConnection();

    const [employees] = await connection.query(
      `SELECT 
        u.id, u.full_name, u.role, 
        COUNT(a.id) as working_days,
        SUM(a.working_hours) as total_hours,
        s.base_salary, s.bonus, s.deductions, s.total_salary
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id AND DATE_FORMAT(a.attendance_date, '%Y-%m') = ?
      LEFT JOIN salaries s ON u.id = s.user_id AND DATE_FORMAT(s.salary_month, '%Y-%m') = ?
      WHERE u.status = 'active'
      GROUP BY u.id, u.full_name, u.role, s.base_salary, s.bonus, s.deductions, s.total_salary`,
      [month, month]
    );

    connection.release();

    res.json({ month, employees });
  } catch (error) {
    logger.error('خطأ في تقرير الموظفين:', error.message);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
