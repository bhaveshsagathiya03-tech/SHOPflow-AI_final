import { useState, useEffect, useRef } from "react";
import api from "../api/api";
import { toast } from "react-toastify";
import {
  Barcode,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  ArrowRight,
  X,
  RotateCcw,
  Truck,
  MapPin,
  Phone,
} from "lucide-react";
import "../styles/POS.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

function POS() {
  const [barcode, setBarcode] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [scannedProduct, setScannedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [quickCatalog, setQuickCatalog] = useState([]);

  // Pay on Delivery & Order Type State
  const [orderType, setOrderType] = useState("IN_STORE"); // "IN_STORE" | "DELIVERY"
  const [deliveryForm, setDeliveryForm] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    delivery_notes: "",
    payment_method: "COD",
  });

  const barcodeInputRef = useRef(null);
  const completeSaleRef = useRef(null);

  // Focus barcode input on mount and after cart actions
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [completedSale]);

  // Load quick products for manual lookup
  useEffect(() => {
    const fetchQuickCatalog = async () => {
      try {
        const res = await api.get("/products");
        setQuickCatalog(res.data);
      } catch (err) {
        console.error("Failed to load catalog for POS lookup", err);
      }
    };
    fetchQuickCatalog();
  }, []);

  // Keyboard shortcut Ctrl + Enter to complete checkout
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (completeSaleRef.current) completeSaleRef.current();
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);

  const searchProductByBarcode = async () => {
    const code = barcode.trim();
    if (!code) {
      toast.warning("Please enter or scan a barcode");
      return;
    }

    try {
      const res = await api.get(`/products/barcode/${code}`);
      setScannedProduct(res.data);
      setQuantity(1);
    } catch (err) {
      console.error(err);
      setScannedProduct(null);
      toast.error(
        err.response?.data?.detail || `No product found for barcode '${code}'`
      );
    }
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchProductByBarcode();
    }
  };

  const addProductToCart = (productToAdd, qtyToAdd = 1) => {
    if (!productToAdd) return;

    const existing = cart.find(
      (item) => item.product_id === productToAdd.product_id
    );

    const currentQtyInCart = existing ? existing.quantity : 0;
    const requestedTotalQty = currentQtyInCart + Number(qtyToAdd);

    if (requestedTotalQty > productToAdd.stock) {
      toast.warning(
        `Insufficient stock! Only ${productToAdd.stock} available (${currentQtyInCart} already in cart)`
      );
      return;
    }

    if (existing) {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.product_id === productToAdd.product_id
            ? {
                ...item,
                quantity: requestedTotalQty,
                total: requestedTotalQty * item.price,
              }
            : item
        )
      );
    } else {
      setCart((prevCart) => [
        ...prevCart,
        {
          product_id: productToAdd.product_id,
          product_name: productToAdd.product_name,
          barcode: productToAdd.barcode,
          category: productToAdd.category,
          price: Number(productToAdd.selling_price),
          stock: productToAdd.stock,
          quantity: Number(qtyToAdd),
          total: Number(productToAdd.selling_price) * Number(qtyToAdd),
        },
      ]);
    }

    toast.success(`Added ${qtyToAdd}x "${productToAdd.product_name}" to cart`);
    setBarcode("");
    setScannedProduct(null);
    setQuantity(1);

    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const updateItemQuantity = (productId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.stock) {
              toast.warning(`Maximum available stock reached (${item.stock})`);
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              total: newQty * item.price,
            };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeItem = (productId) => {
    setCart((prevCart) =>
      prevCart.filter((item) => item.product_id !== productId)
    );
    toast.info("Item removed from cart");
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Are you sure you want to clear the entire cart?")) {
      setCart([]);
      setCashTendered("");
      toast.info("Cart cleared");
    }
  };

  const grandTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const tenderedAmount = Number(cashTendered) || 0;
  const changeDue = tenderedAmount > grandTotal ? tenderedAmount - grandTotal : 0;

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.warning("Cart is empty! Add products before checkout.");
      return;
    }

    if (orderType === "DELIVERY") {
      if (
        !deliveryForm.customer_name.trim() ||
        !deliveryForm.customer_phone.trim() ||
        !deliveryForm.delivery_address.trim()
      ) {
        toast.warning(
          "Please enter Customer Name, Phone Number, and Delivery Address"
        );
        return;
      }
    }

    const isDelivery = orderType === "DELIVERY";
    const selectedMethod = isDelivery
      ? deliveryForm.payment_method
      : paymentMethod.toUpperCase();

    const salePayload = {
      payment_method: selectedMethod,
      order_type: orderType,
      delivery_info: isDelivery
        ? {
            customer_name: deliveryForm.customer_name.trim(),
            customer_phone: deliveryForm.customer_phone.trim(),
            delivery_address: deliveryForm.delivery_address.trim(),
            delivery_notes: deliveryForm.delivery_notes.trim() || undefined,
            payment_method: deliveryForm.payment_method,
          }
        : undefined,
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    };

    try {
      setIsSubmitting(true);
      const res = await api.post("/sales", salePayload);

      toast.success(
        isDelivery
          ? `Delivery order created! Tracking #${res.data.delivery?.tracking_number}`
          : "Sale completed successfully! Receipt generated."
      );

      // Save sale receipt for modal
      setCompletedSale({
        ...res.data,
        cartItems: [...cart],
        tendered: tenderedAmount,
        change: changeDue,
        timestamp: new Date().toISOString(),
      });

      // Reset cart and fields
      setCart([]);
      setBarcode("");
      setScannedProduct(null);
      setQuantity(1);
      setCashTendered("");
      if (isDelivery) {
        setDeliveryForm({
          customer_name: "",
          customer_phone: "",
          delivery_address: "",
          delivery_notes: "",
          payment_method: "COD",
        });
      }

      // Refresh quick catalog to reflect new stock counts
      const updatedCatalog = await api.get("/products");
      setQuickCatalog(updatedCatalog.data);
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || "Transaction failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  completeSaleRef.current = completeSale;

  // Filter catalog for quick-add list
  const filteredQuickCatalog = quickCatalog.filter((p) => {
    if (!catalogSearch.trim()) return true;
    const q = catalogSearch.toLowerCase();
    return (
      p.product_name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="pos-terminal-layout page">
      {/* LEFT COLUMN: Barcode Scanner, Preview, and Quick Catalog */}
      <div className="pos-left-panel">
        {/* Scanner Bar */}
        <div className="pos-card scanner-card">
          <div className="scanner-header">
            <Barcode size={20} className="scanner-icon" />
            <h3>Barcode Scanner & SKU Entry</h3>
          </div>

          <div className="barcode-input-row">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode with hardware scanner or type and hit Enter..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              className="pos-barcode-input"
            />
            <button
              className="btn btn-primary btn-scan-action"
              onClick={searchProductByBarcode}
            >
              <Search size={16} />
              <span>Lookup</span>
            </button>
          </div>
        </div>

        {/* Scanned Product Preview Card */}
        {scannedProduct && (
          <div className="pos-card product-preview-card">
            <div className="preview-card-header">
              <div>
                <span className="badge badge-purple">{scannedProduct.category}</span>
                <h4>{scannedProduct.product_name}</h4>
                <div className="preview-barcode-text">
                  Barcode: <code>{scannedProduct.barcode}</code>
                </div>
              </div>
              <div className="preview-price">
                {formatCurrency(Number(scannedProduct.selling_price))}
              </div>
            </div>

            <div className="preview-stock-status">
              <span>Available Units in Stock:</span>
              <strong
                className={
                  scannedProduct.stock <= scannedProduct.min_stock
                    ? "text-warning"
                    : "text-success"
                }
              >
                {scannedProduct.stock} units
              </strong>
            </div>

            <div className="preview-action-row">
              <div className="qty-picker">
                <button
                  type="button"
                  className="btn-qty"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  max={scannedProduct.stock}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="qty-number-input"
                />
                <button
                  type="button"
                  className="btn-qty"
                  onClick={() =>
                    setQuantity((q) => Math.min(scannedProduct.stock, q + 1))
                  }
                  disabled={quantity >= scannedProduct.stock}
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                className="btn btn-primary btn-add-preview"
                onClick={() => addProductToCart(scannedProduct, quantity)}
                disabled={scannedProduct.stock <= 0}
              >
                <Plus size={16} />
                <span>Add to Cart ({formatCurrency(Number(scannedProduct.selling_price) * quantity)})</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Product Catalog */}
        <div className="pos-card catalog-lookup-card">
          <div className="catalog-lookup-header">
            <div>
              <h4>Quick Catalog Lookup</h4>
              <p className="catalog-lookup-sub">
                1-click add items to cart without barcode scanning
              </p>
            </div>
            <div className="catalog-search-inline">
              <Search size={14} className="lookup-search-icon" />
              <input
                type="text"
                placeholder="Filter catalog..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="catalog-chips-grid">
            {filteredQuickCatalog.slice(0, 12).map((item) => (
              <button
                key={item.product_id}
                type="button"
                className="quick-item-chip"
                onClick={() => addProductToCart(item, 1)}
                disabled={item.stock <= 0}
                title={`Click to add 1x ${item.product_name}`}
              >
                <div className="quick-chip-meta">
                  <span className="quick-chip-name">{item.product_name}</span>
                  <span className="quick-chip-stock">
                    {item.stock <= 0 ? "Out of Stock" : `${item.stock} left`}
                  </span>
                </div>
                <div className="quick-chip-price">
                  {formatCurrency(Number(item.selling_price))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Active Cart Register & Checkout */}
      <div className="pos-right-panel">
        <div className="pos-card register-cart-card">
          {/* Register Header */}
          <div className="register-header">
            <div className="register-title-group">
              <ShoppingCart size={20} className="register-cart-icon" />
              <div>
                <h3>Cash Register Cart</h3>
                <span className="cart-count-badge">
                  {totalItemCount} {totalItemCount === 1 ? "unit" : "units"} ({cart.length} items)
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                className="btn-clear-cart"
                onClick={clearCart}
                title="Empty cart"
              >
                <RotateCcw size={14} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Cart Items Table */}
          <div className="cart-items-scroll-area">
            {cart.length === 0 ? (
              <div className="empty-pos-cart">
                <ShoppingCart size={44} className="empty-cart-svg" />
                <h4>Register is Empty</h4>
                <p>Scan a barcode or click an item from the quick catalog on the left to begin billing</p>
              </div>
            ) : (
              <table className="register-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th className="cart-action-col"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.product_id}>
                      <td>
                        <div className="cart-item-name-group">
                          <strong>{item.product_name}</strong>
                          <span className="cart-item-barcode">
                            <code>{item.barcode}</code>
                          </span>
                        </div>
                      </td>

                      {/* Direct + / - quantity controls */}
                      <td>
                        <div className="cart-qty-stepper">
                          <button
                            type="button"
                            className="btn-stepper"
                            onClick={() => updateItemQuantity(item.product_id, -1)}
                            title="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="stepper-val">{item.quantity}</span>
                          <button
                            type="button"
                            className="btn-stepper"
                            onClick={() => updateItemQuantity(item.product_id, 1)}
                            disabled={item.quantity >= item.stock}
                            title="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>

                      <td className="cart-price">{formatCurrency(item.price)}</td>

                      <td className="cart-total-cell">
                        {formatCurrency(item.total)}
                      </td>

                      <td className="cart-action-col">
                        <button
                          type="button"
                          className="btn-cart-remove"
                          onClick={() => removeItem(item.product_id)}
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Billing & Settlement Section */}
          <div className="checkout-settlement-panel">
            {/* Grand Total Breakdown */}
            <div className="settlement-breakdown">
              <div className="settlement-line">
                <span>Cart Subtotal</span>
                <strong>{formatCurrency(grandTotal)}</strong>
              </div>
              <div className="settlement-line">
                <span>Tax / GST (Included)</span>
                <span>₹0.00</span>
              </div>
              <div className="settlement-total-line">
                <span>Amount Due</span>
                <span className="grand-total-amount">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="payment-method-selector">
              <label className="payment-method-label">Payment Method</label>
              <div className="payment-tabs-grid">
                <button
                  type="button"
                  className={`payment-tab-btn ${
                    paymentMethod === "cash" ? "active" : ""
                  }`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Banknote size={18} />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  className={`payment-tab-btn ${
                    paymentMethod === "upi" ? "active" : ""
                  }`}
                  onClick={() => setPaymentMethod("upi")}
                >
                  <QrCode size={18} />
                  <span>UPI / QR</span>
                </button>

                <button
                  type="button"
                  className={`payment-tab-btn ${
                    paymentMethod === "card" ? "active" : ""
                  }`}
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard size={18} />
                  <span>Card</span>
                </button>
              </div>
            </div>

            {/* Cash Tendered & Change Return Helper */}
            {paymentMethod === "cash" && (
              <div className="cash-calculator-box">
                <div className="cash-calc-input-row">
                  <label htmlFor="cash-tendered-input">Cash Tendered (₹):</label>
                  <input
                    id="cash-tendered-input"
                    type="number"
                    step="1"
                    placeholder="e.g. 500"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="tendered-input"
                  />
                </div>
                {tenderedAmount > 0 && (
                  <div className="change-return-row">
                    <span>Change to Return:</span>
                    <strong
                      className={
                        tenderedAmount >= grandTotal ? "text-success" : "text-danger"
                      }
                    >
                      {tenderedAmount >= grandTotal
                        ? formatCurrency(changeDue)
                        : `Short by ${formatCurrency(grandTotal - tenderedAmount)}`}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Complete Sale Action Button */}
            <button
              type="button"
              className="btn btn-primary btn-checkout-submit"
              onClick={completeSale}
              disabled={isSubmitting || cart.length === 0}
            >
              <CheckCircle2 size={18} />
              <span>
                {isSubmitting
                  ? "Processing Transaction..."
                  : `Complete Sale (${formatCurrency(grandTotal)})`}
              </span>
            </button>
            <div className="hotkey-tip">Tip: Press Ctrl + Enter to quickly checkout</div>
          </div>
        </div>
      </div>

      {/* COMPLETED DIGITAL RECEIPT MODAL */}
      {completedSale && (
        <div className="modal-overlay" onClick={() => setCompletedSale(null)}>
          <div
            className="modal-card receipt-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="receipt-modal-actions no-print">
              <span className="receipt-badge">
                <CheckCircle2 size={14} /> Sale # {completedSale.sale_id} Complete
              </span>
              <button
                className="btn-modal-close"
                onClick={() => setCompletedSale(null)}
                aria-label="Close receipt"
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div className="printable-receipt">
              <div className="receipt-paper-header">
                <h2>🛍️ SHOPFLOW AI</h2>
                <p className="receipt-store-sub">Smart POS & Retail Register</p>
                <p className="receipt-meta">Receipt ID: #{completedSale.sale_id}</p>
                <p className="receipt-meta">
                  Date: {new Date(completedSale.timestamp).toLocaleString()}
                </p>
                <p className="receipt-meta">Cashier: Lucky • Terminal #01</p>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-items-list">
                <div className="receipt-table-header">
                  <span>Item</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Total</span>
                </div>
                {completedSale.items.map((item, idx) => (
                  <div key={idx} className="receipt-item-row">
                    <span className="item-name-col">
                      {item.product_name || `Product #${item.product_id}`}
                    </span>
                    <span className="item-qty-col">{item.quantity}</span>
                    <span className="item-price-col">
                      {formatCurrency(Number(item.subtotal))}
                    </span>
                  </div>
                ))}
              </div>

              <div className="receipt-divider" />

              <div className="receipt-totals-section">
                <div className="receipt-total-line">
                  <span>Grand Total:</span>
                  <strong>{formatCurrency(Number(completedSale.total_amount))}</strong>
                </div>
                <div className="receipt-total-line">
                  <span>Payment Method:</span>
                  <span>{completedSale.payment_method}</span>
                </div>
                {completedSale.payment_method === "CASH" && completedSale.tendered > 0 && (
                  <>
                    <div className="receipt-total-line">
                      <span>Cash Tendered:</span>
                      <span>{formatCurrency(completedSale.tendered)}</span>
                    </div>
                    <div className="receipt-total-line">
                      <span>Change Given:</span>
                      <span>{formatCurrency(completedSale.change)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="receipt-footer">
                <p>Thank you for shopping with us!</p>
                <p className="receipt-footer-sub">Powered by ShopFlow AI</p>
              </div>
            </div>

            {/* Receipt Modal Footer Actions */}
            <div className="receipt-modal-buttons no-print">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print Receipt</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCompletedSale(null)}
              >
                <span>Start Next Order</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;