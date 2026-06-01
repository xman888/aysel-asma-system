import React, { useState } from 'react';
import axios from 'axios';
import '../styles/components/CustomerForm.css';

const CustomerForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    customer_type: 'regular',
    default_discount_percent: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await axios.post(
        `${process.env.REACT_APP_API_URL}/customers`,
        formData,
        config
      );

      alert('تم إضافة العميل بنجاح');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في إضافة العميل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customer-form">
      <h3>إضافة عميل جديد</h3>
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>الاسم *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>الهاتف</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>نوع العميل</label>
            <select name="customer_type" value={formData.customer_type} onChange={handleChange}>
              <option value="regular">عادي</option>
              <option value="vip">VIP</option>
              <option value="wholesale">جملة</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>المدينة</label>
            <input type="text" name="city" value={formData.city} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>الدولة</label>
            <input type="text" name="country" value={formData.country} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label>العنوان</label>
          <textarea name="address" value={formData.address} onChange={handleChange} rows="2" />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'جاري الحفظ...' : '💾 حفظ العميل'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerForm;