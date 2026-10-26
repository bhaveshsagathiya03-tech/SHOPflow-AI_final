import { useEffect, useState } from "react";
import api from "../api/api";
import { toast } from "react-toastify";
import { X, Sparkles, Save, Barcode } from "lucide-react";
import "../styles/ProductForm.css";

const COMMON_CATEGORIES = [
  "Beverages",
  "Bakery",
  "Grocery",
  "Noodles",
  "Dairy",
  "Snacks",
  "Personal Care",
  "Household",
];

function ProductForm({ product, onClose, refreshProducts }) {
  const [formData, setFormData] = useState({
    barcode: "",
    product_name: "",
    category: "",
    buying_price: "",
    selling_price: "",
    stock: "",
    min_stock: "10",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        barcode: product.barcode || "",
        product_name: product.product_name || "",
        category: product.category || "",
        buying_price: product.buying_price || "",
        selling_price: product.selling_price || "",
        stock: product.stock !== undefined ? String(product.stock) : "",
        min_stock: product.min_stock !== undefined ? String(product.min_stock) : "10",
      });
    }
  }, [product]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const generateRandomBarcode = () => {
    const randomCode = "890" + Math.floor(100000 + Math.random() * 900000);
    setFormData((prev) => ({ ...prev, barcode: randomCode }));
  };

  const buying = Number(formData.buying_price) || 0;
  const selling = Number(formData.selling_price) || 0;
  const profitMargin = selling - buying;
  const marginPercentage = buying > 0 ? ((profitMargin / buying) * 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.barcode.trim()) {
      toast.warning("Barcode is required");
      return;
    }
    if (!formData.product_name.trim()) {
      toast.warning("Product name is required");
      return;
    }
    if (buying <= 0 || selling <= 0) {
      toast.warning("Prices must be greater than zero");
      return;
    }

    const payload = {
      barcode: formData.barcode.trim(),
      product_name: formData.product_name.trim(),
      category: formData.category.trim() || "General",
      buying_price: buying,
      selling_price: selling,
      stock: Number(formData.stock) || 0,
      min_stock: Number(formData.min_stock) || 0,
    };

    try {
      setSaving(true);
      if (product) {
        await api.put(`/products/${product.product_id}`, payload);
        toast.success(`Updated "${payload.product_name}"`);
      } else {
        await api.post("/products", payload);
        toast.success(`Added "${payload.product_name}" to catalog`);
      }

      await refreshProducts();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || "Failed to save product. Check inputs."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card product-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="product-form-header">
          <div>
            <h3>{product ? "Edit Catalog Item" : "Add New Product"}</h3>
            <p className="product-form-sub">
              {product
                ? `Updating product ID #${product.product_id}`
                : "Create a new barcode SKU for POS checkout and inventory tracking"}
            </p>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="product-modal-body">
          {/* Barcode field with auto-generator */}
          <div className="form-field-group">
            <label htmlFor="barcode-input">
              Barcode / SKU <span className="req">*</span>
            </label>
            <div className="input-with-action">
              <input
                id="barcode-input"
                type="text"
                name="barcode"
                placeholder="Scan or enter barcode (e.g. 89010001)"
                value={formData.barcode}
                onChange={handleChange}
                required
                autoFocus={!product}
              />
              {!product && (
                <button
                  type="button"
                  className="btn-generate-barcode"
                  onClick={generateRandomBarcode}
                  title="Generate Random Barcode"
                >
                  <Barcode size={15} />
                  <span>Generate</span>
                </button>
              )}
            </div>
          </div>

          {/* Product Name */}
          <div className="form-field-group">
            <label htmlFor="name-input">
              Product Name <span className="req">*</span>
            </label>
            <input
              id="name-input"
              type="text"
              name="product_name"
              placeholder="e.g. Maggi 2-Minute Noodles 70g"
              value={formData.product_name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Category with Datalist */}
          <div className="form-field-group">
            <label htmlFor="category-input">
              Category <span className="req">*</span>
            </label>
            <input
              id="category-input"
              list="category-suggestions"
              name="category"
              placeholder="Select or type category (e.g. Grocery)"
              value={formData.category}
              onChange={handleChange}
              required
            />
            <datalist id="category-suggestions">
              {COMMON_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Pricing Row */}
          <div className="form-row-two-col">
            <div className="form-field-group">
              <label htmlFor="buying-price-input">
                Cost / Buying Price (₹) <span className="req">*</span>
              </label>
              <input
                id="buying-price-input"
                type="number"
                step="0.01"
                min="0.01"
                name="buying_price"
                placeholder="0.00"
                value={formData.buying_price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field-group">
              <label htmlFor="selling-price-input">
                Retail / Selling Price (₹) <span className="req">*</span>
              </label>
              <input
                id="selling-price-input"
                type="number"
                step="0.01"
                min="0.01"
                name="selling_price"
                placeholder="0.00"
                value={formData.selling_price}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Profit Margin Preview Callout */}
          {buying > 0 && selling > 0 && (
            <div
              className={`margin-preview-banner ${
                profitMargin >= 0 ? "margin-positive" : "margin-negative"
              }`}
            >
              <Sparkles size={16} />
              <span>
                Profit Margin:{" "}
                <strong>
                  ₹{profitMargin.toFixed(2)} ({marginPercentage}%)
                </strong>
                {profitMargin < 0 && " — Warning: Selling price is below cost!"}
              </span>
            </div>
          )}

          {/* Inventory Stocks Row */}
          <div className="form-row-two-col">
            <div className="form-field-group">
              <label htmlFor="stock-input">
                Current Stock Units <span className="req">*</span>
              </label>
              <input
                id="stock-input"
                type="number"
                min="0"
                name="stock"
                placeholder="0"
                value={formData.stock}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field-group">
              <label htmlFor="min-stock-input">
                Low Stock Threshold <span className="req">*</span>
              </label>
              <input
                id="min-stock-input"
                type="number"
                min="0"
                name="min_stock"
                placeholder="10"
                value={formData.min_stock}
                onChange={handleChange}
                required
              />
              <span className="field-hint">
                Triggers reorder alert when stock reaches this level
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="product-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary btn-save-product"
              disabled={saving}
            >
              <Save size={16} />
              <span>{saving ? "Saving..." : product ? "Update Product" : "Create Product"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductForm;