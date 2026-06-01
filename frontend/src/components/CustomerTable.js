import React from 'react';
import '../styles/components/CustomerTable.css';

const CustomerTable = ({ customers, onDelete }) => {
  return (
    <div className="table-container">
      <table className="customers-table">
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الهاتف</th>
            <th>النوع</th>
            <th>إجمالي المشتريات</th>
            <th>الديون</th>
            <th>نقاط الولاء</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {customers.length > 0 ? (
            customers.map(customer => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.phone || '-'}</td>
                <td>
                  <span className={`badge badge-${customer.customer_type}`}>
                    {customer.customer_type === 'regular' ? 'عادي' : customer.customer_type === 'vip' ? 'VIP' : 'جملة'}
                  </span>
                </td>
                <td>{customer.total_purchases?.toLocaleString()} جنيه</td>
                <td className={customer.total_debt > 0 ? 'debt' : ''}>{customer.total_debt?.toLocaleString()} جنيه</td>
                <td>{customer.loyalty_points}</td>
                <td className="actions">
                  <button className="btn-edit">✏️</button>
                  <button className="btn-delete" onClick={() => onDelete(customer.id)}>🗑️</button>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="7" className="no-data">لا توجد عملاء</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CustomerTable;