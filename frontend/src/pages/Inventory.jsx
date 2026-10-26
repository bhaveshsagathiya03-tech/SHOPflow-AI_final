import { useEffect, useState, useMemo } from "react";
import api from "../api/api";
import ProductForm from "../components/ProductForm";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-toastify";
import {
  Boxes,
  Plus,
  Search,
  Edit3,
  Trash2,
  Barcode,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  X,
} from "lucide-react";
import "../styles/Inventory.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

function Inventory() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load inventory products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      setIsDeleting(true);
      await api.delete(`/products/${productToDelete.product_id}`);
      toast.success(`Deleted "${productToDelete.product_name}"`);
      setProductToDelete(null);
      fetchProducts();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || "Failed to delete product from database"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Derive unique categories
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filter products by search text, category, and stock status
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        item.product_name.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q));

      const matchCategory =
        selectedCategory === "all" || item.category === selectedCategory;

      let matchStock = true;
      if (stockFilter === "low") {
        matchStock = item.stock > 0 && item.stock <= item.min_stock;
      } else if (stockFilter === "out") {
        matchStock = item.stock <= 0;
      } else if (stockFilter === "healthy") {
        matchStock = item.stock > item.min_stock;
      }

      return matchSearch && matchCategory && matchStock;
    });
  }, [products, search, selectedCategory, stockFilter]);

  // Inventory Metrics
  const totalStockUnits = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const totalValuation = products.reduce(
    (sum, p) => sum + (Number(p.stock) || 0) * (Number(p.buying_price) || 0),
    0
  );
  const lowStockCount = products.filter(
    (p) => p.stock > 0 && p.stock <= p.min_stock
  ).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="inventory-page page">
      {/* Metrics Banner */}
      <div className="inventory-kpi-bar">
        <div className="inv-stat-item">
          <span className="inv-stat-label">Total SKUs</span>
          <span className="inv-stat-value">{products.length}</span>
        </div>
        <div className="inv-stat-divider" />
        <div className="inv-stat-item">
          <span className="inv-stat-label">Stock Units</span>
          <span className="inv-stat-value">{totalStockUnits.toLocaleString()}</span>
        </div>
        <div className="inv-stat-divider" />
        <div className="inv-stat-item">
          <span className="inv-stat-label">Inventory Valuation</span>
          <span className="inv-stat-value">{formatCurrency(totalValuation)}</span>
        </div>
        <div className="inv-stat-divider" />
        <div className="inv-stat-item">
          <span className="inv-stat-label">Low Stock</span>
          <span className={`inv-stat-value ${lowStockCount > 0 ? "text-warning" : ""}`}>
            {lowStockCount}
          </span>
        </div>
        <div className="inv-stat-divider" />
        <div className="inv-stat-item">
          <span className="inv-stat-label">Out of Stock</span>
          <span className={`inv-stat-value ${outOfStockCount > 0 ? "text-danger" : ""}`}>
            {outOfStockCount}
          </span>
        </div>
      </div>

      {/* Main Header & Actions */}
      <div className="inventory-header">
        <div>
          <h2>Product Inventory & SKUs</h2>
          <p className="inventory-subtitle">
            Manage barcode catalog, stock inventory, and cost-to-retail pricing
          </p>
        </div>

        <button
          className="btn btn-primary btn-add-product"
          onClick={() => {
            setSelectedProduct(null);
            setShowForm(true);
          }}
        >
          <Plus size={18} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="inventory-toolbar-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            className="inventory-search-box"
            type="text"
            placeholder="Search by product name, barcode, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="clear-search-btn"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-controls-group">
          {/* Category Filter */}
          <div className="filter-select-wrapper">
            <Filter size={15} className="filter-icon" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Health Filter */}
          <select
            className="stock-filter-select"
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="all">All Stock Statuses</option>
            <option value="healthy">In Stock (&gt; Min)</option>
            <option value="low">Low Stock Alerts</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU / Barcode</th>
                <th>Product Details</th>
                <th>Category</th>
                <th>Buying Price</th>
                <th>Selling Price</th>
                <th>Margin</th>
                <th>Current Stock</th>
                <th>Min Alert</th>
                <th className="actions-header">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-inventory-cell">
                    <div className="empty-catalog-state">
                      <Boxes size={38} className="empty-icon" />
                      <h4>No Products Matching Filter</h4>
                      <p>
                        {products.length === 0
                          ? "Your catalog is empty. Click '+ Add New Product' to register your first SKU."
                          : "Try adjusting your search query or category filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((item) => {
                  const buying = Number(item.buying_price);
                  const selling = Number(item.selling_price);
                  const margin = selling - buying;
                  const marginPct = buying > 0 ? ((margin / buying) * 100).toFixed(0) : 0;
                  const stock = Number(item.stock);
                  const minStock = Number(item.min_stock);

                  let stockBadge;
                  if (stock <= 0) {
                    stockBadge = (
                      <span className="badge badge-danger">
                        <XCircle size={12} /> Out of Stock
                      </span>
                    );
                  } else if (stock <= minStock) {
                    stockBadge = (
                      <span className="badge badge-warning">
                        <AlertTriangle size={12} /> Low Stock ({stock})
                      </span>
                    );
                  } else {
                    stockBadge = (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> In Stock ({stock})
                      </span>
                    );
                  }

                  return (
                    <tr key={item.product_id}>
                      {/* Barcode */}
                      <td>
                        <div className="barcode-badge">
                          <Barcode size={15} />
                          <code>{item.barcode}</code>
                        </div>
                      </td>

                      {/* Product Name */}
                      <td>
                        <div className="product-identity">
                          <strong>{item.product_name}</strong>
                          <span className="product-id-sub">ID: #{item.product_id}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="category-pill">{item.category}</span>
                      </td>

                      {/* Buying Price */}
                      <td className="price-numeric">{formatCurrency(buying)}</td>

                      {/* Selling Price */}
                      <td className="price-numeric font-bold">
                        {formatCurrency(selling)}
                      </td>

                      {/* Margin */}
                      <td>
                        <span
                          className={`margin-pill ${
                            margin >= 0 ? "margin-pill-pos" : "margin-pill-neg"
                          }`}
                        >
                          +{marginPct}% ({formatCurrency(margin)})
                        </span>
                      </td>

                      {/* Stock Status */}
                      <td>{stockBadge}</td>

                      {/* Min Stock */}
                      <td className="min-stock-text">{minStock} units</td>

                      {/* Actions */}
                      <td className="actions-cell">
                        <div className="actions-button-group">
                          <button
                            className="btn-action btn-action-edit"
                            onClick={() => {
                              setSelectedProduct(item);
                              setShowForm(true);
                            }}
                            title="Edit Product"
                          >
                            <Edit3 size={15} />
                            <span>Edit</span>
                          </button>

                          <button
                            className="btn-action btn-action-delete"
                            onClick={() => setProductToDelete(item)}
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Modal */}
      {showForm && (
        <ProductForm
          product={selectedProduct}
          onClose={() => {
            setShowForm(false);
            setSelectedProduct(null);
          }}
          refreshProducts={fetchProducts}
        />
      )}

      {/* In-App Delete Confirmation Modal */}
      {productToDelete && (
        <div className="modal-overlay" onClick={() => setProductToDelete(null)}>
          <div
            className="modal-card delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-content">
              <div className="delete-warning-icon">
                <AlertTriangle size={28} />
              </div>
              <h3>Confirm Product Deletion</h3>
              <p>
                Are you sure you want to permanently delete{" "}
                <strong>"{productToDelete.product_name}"</strong> (Barcode:{" "}
                <code>{productToDelete.barcode}</code>)? Past sales history will
                retain archived records, but the SKU will be removed from POS
                scanning.
              </p>
              <div className="delete-modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setProductToDelete(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;