import React from 'react';
import '../styles/components/InvoicePreview.css';

const InvoicePreview = ({
  items,
  customer,
  discount,
  setDiscount,
  totals,
  paymentMethod,
  setPaymentMethod,
  paidAmount,
  setPaidAmount,
  onRemoveItem,
  onCreateInvoice,
  loading,
}) => {
  return (
    <div className="invoice-preview">
      <h3>📄 ملخص الفاتورة</h3>

      <div className="invoice-items">
        {items.length > 0 ? (
          <table className="items-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>السعر</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.selling_price?.toLocaleString()} جنيه</td>
                  <td>{item.quantity}</td>
                  <td>{(item.selling_price * item.quantity)?.toLocaleString()} جنيه</td>
                  <td>
                    <button
                      className="btn-remove"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-items">لا توجد منتجات في الفاتورة</p>
        )}
      </div>

      <div className="invoice-summary">
        <div className="summary-row">
          <span>الإجمالي:</span>
          <span>{totals.subtotal?.toLocaleString()} جنيه</span>
        </div>
        <div className="summary-row">
          <span>الخصم:</span>
          <span>
            <input
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value))}
              style={{ width: '60px' }}
            /> %
          </span>
        </div>
        <div className="summary-row">
          <span>مبلغ الخصم:</span>
          <span>{totals.discountAmount?.toLocaleString()} جنيه</span>
        </div>
        <div className="summary-row">
          <span>الضريبة:</span>
          <span>{totals.taxAmount?.toLocaleString()} جنيه</span>
        </div>
        <div className="summary-total">
          <span>الإجمالي النهائي:</span>
          <span>{totals.total?.toLocaleString()} جنيه</span>
        </div>
      </div>

      <div className="payment-section">
        <div className="form-group">
          <label>طريقة الدفع:</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">نقد</option>
            <option value="card">كرت</option>
            <option value="check">شيك</option>
            <option value="bank_transfer">تحويل بنكي</option>
          </select>
        </div>
        <div className="form-group">
          <label>المبلغ المدفوع:</label>
          <input
            type="number"
            value={paidAmount}
            onChange={(e) => setPaidAmount(parseFloat(e.target.value))}
            placeholder="0.00"
          />
        </div>
      </div>

      <button
        className="btn-create-invoice"
        onClick={onCreateInvoice}
        disabled={items.length === 0 || loading}
      >
        {loading ? '⏳ جاري الإنشاء...' : '🧾 إنشاء الفاتورة'}
      </button>
    </div>
  );
};

export default InvoicePreview;