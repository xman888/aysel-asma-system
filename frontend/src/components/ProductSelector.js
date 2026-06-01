import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/components/ProductSelector.css';

const ProductSelector = ({ onAddItem }) => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/products?search=${search}`,
        config
      );
      setProducts(response.data.products);
    } catch (error) {
      console.error('خطأ في جلب المنتجات:', error);
    }
  };

  const handleAddItem = () => {
    if (selectedProduct) {
      onAddItem({ ...selectedProduct, quantity });
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  return (
    <div className="product-selector">
      <h3>🔍 اختيار المنتجات</h3>
      
      <div className="search-input">
        <input
          type="text"
          placeholder="ابحث عن المنتج..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="products-grid">
        {products.map(product => (
          <div
            key={product.id}
            className={`product-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
            onClick={() => setSelectedProduct(product)}
          >
            <p className="product-name">{product.name}</p>
            <p className="product-price">{product.selling_price?.toLocaleString()} جنيه</p>
            <p className={`product-stock ${product.quantity_stock < product.min_stock_level ? 'low' : ''}`}>
              المتوفر: {product.quantity_stock}
            </p>
          </div>
        ))}
      </div>

      {selectedProduct && (
        <div className="selected-product">
          <p><strong>{selectedProduct.name}</strong></p>
          <input
            type="number"
            min="1"
            max={selectedProduct.quantity_stock}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
          />
          <button onClick={handleAddItem} className="btn-add">➕ إضافة للفاتورة</button>
        </div>
      )}
    </div>
  );
};

export default ProductSelector;