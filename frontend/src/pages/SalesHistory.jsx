import { useEffect, useState, useMemo } from "react";
import api from "../api/api";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-toastify";
import {
  Receipt,
  Search,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  X,
} from "lucide-react";
import "../styles/SalesHistory.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await api.get("/sales");
      setSales(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load sales history");
    } finally {
      setLoading(false);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setSelectedSale(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getPaymentBadge = (method) => {
    const m = (method || "").toLowerCase();
    if (m === "upi") {
      return (
        <span className="badge badge-purple">
          <QrCode size={12} /> UPI
        </span>
      );
    }
    if (m === "card") {
      return (
        <span className="badge badge-info">
          <CreditCard size={12} /> Card
        </span>
      );
    }
    return (
      <span className="badge badge-success">
        <Banknote size={12} /> Cash
      </span>
    );
  };

  // Metrics
  const totalSalesCount = sales.length;
  const totalGrossRevenue = sales.reduce(
    (sum, s) => sum + Number(s.total_amount || 0),
    0
  );
  const averageOrderValue =
    totalSalesCount > 0 ? totalGrossRevenue / totalSalesCount : 0;

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        sale.sale_id.toString().includes(q) ||
        sale.payment_method.toLowerCase().includes(q) ||
        sale.items.some(
          (item) =>
            item.product_name && item.product_name.toLowerCase().includes(q)
        );

      const matchPayment =
        paymentFilter === "all" ||
        sale.payment_method.toLowerCase() === paymentFilter.toLowerCase();

      return matchSearch && matchPayment;
    });
  }, [sales, search, paymentFilter]);

  return (
    <div className="sales-history-page page">
      {/* Metrics Summary Strip */}
      <div className="sales-kpi-bar">
        <div className="sales-stat-item">
          <span className="sales-stat-label">Total Transactions</span>
          <span className="sales-stat-value">{totalSalesCount}</span>
        </div>
        <div className="sales-stat-divider" />
        <div className="sales-stat-item">
          <span className="sales-stat-label">Cumulative Volume</span>
          <span className="sales-stat-value">
            {formatCurrency(totalGrossRevenue)}
          </span>
        </div>
        <div className="sales-stat-divider" />
        <div className="sales-stat-item">
          <span className="sales-stat-label">Average Order Value (AOV)</span>
          <span className="sales-stat-value">
            {formatCurrency(averageOrderValue)}
          </span>
        </div>
      </div>

      {/* Main Header */}
      <div className="sales-header">
        <div>
          <h2>Sales History & Digital Receipts</h2>
          <p className="sales-subtitle">
            Audit all completed POS checkout transactions, line items, and payment methods
          </p>
        </div>
      </div>

      {/* Toolbar Search & Filter */}
      <div className="sales-toolbar-card">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            className="sales-search-box"
            type="text"
            placeholder="Search by Sale ID #, payment method, or product name..."
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

        {/* Payment Filter Pills */}
        <div className="payment-filter-pills">
          <button
            type="button"
            className={`pill-btn ${paymentFilter === "all" ? "active" : ""}`}
            onClick={() => setPaymentFilter("all")}
          >
            All Methods
          </button>
          <button
            type="button"
            className={`pill-btn ${paymentFilter === "cash" ? "active" : ""}`}
            onClick={() => setPaymentFilter("cash")}
          >
            Cash
          </button>
          <button
            type="button"
            className={`pill-btn ${paymentFilter === "upi" ? "active" : ""}`}
            onClick={() => setPaymentFilter("upi")}
          >
            UPI
          </button>
          <button
            type="button"
            className={`pill-btn ${paymentFilter === "card" ? "active" : ""}`}
            onClick={() => setPaymentFilter("card")}
          >
            Card
          </button>
        </div>
      </div>

      {/* Sales Records Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-container">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Invoice / Sale #</th>
                <th>Transaction Date</th>
                <th>Payment Method</th>
                <th>Items Count</th>
                <th>Total Billed</th>
                <th className="receipt-action-header">Receipt</th>
              </tr>
            </thead>

            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-sales-cell">
                    <div className="empty-sales-state">
                      <Receipt size={38} className="empty-icon" />
                      <h4>No Sales Records Found</h4>
                      <p>
                        {sales.length === 0
                          ? "No transactions have been recorded yet. Go to POS Terminal to process sales."
                          : "No transactions match your current search query or filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const totalUnits = sale.items.reduce(
                    (sum, i) => sum + i.quantity,
                    0
                  );

                  return (
                    <tr key={sale.sale_id}>
                      {/* Sale ID */}
                      <td>
                        <div className="sale-id-badge">
                          <Receipt size={14} />
                          <span>#{sale.sale_id}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="sales-date-col">
                        {new Date(sale.sale_date).toLocaleString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      {/* Payment */}
                      <td>{getPaymentBadge(sale.payment_method)}</td>

                      {/* Items Count */}
                      <td className="items-count-col">
                        {totalUnits} {totalUnits === 1 ? "unit" : "units"} ({sale.items.length} SKUs)
                      </td>

                      {/* Total */}
                      <td className="sales-amount-col">
                        {formatCurrency(Number(sale.total_amount))}
                      </td>

                      {/* Action */}
                      <td className="receipt-action-cell">
                        <button
                          className="btn-view-receipt"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <span>View Invoice</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* DIGITAL RECEIPT INVOICE MODAL */}
      {selectedSale && (
        <div className="modal-overlay" onClick={() => setSelectedSale(null)}>
          <div
            className="modal-card receipt-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="receipt-modal-actions no-print">
              <span className="receipt-badge">
                <Receipt size={15} /> Official Sales Receipt
              </span>
              <button
                className="btn-modal-close"
                onClick={() => setSelectedSale(null)}
                aria-label="Close invoice"
              >
                <X size={20} />
              </button>
            </div>

            {/* Printable Receipt Paper */}
            <div className="printable-receipt">
              <div className="receipt-paper-header">
                <h2>🛍️ SHOPFLOW AI</h2>
                <p className="receipt-store-sub">Smart POS & Retail Register</p>
                <p className="receipt-meta">Receipt #: {selectedSale.sale_id}</p>
                <p className="receipt-meta">
                  Date: {new Date(selectedSale.sale_date).toLocaleString()}
                </p>
                <p className="receipt-meta">
                  Cashier: Lucky • Terminal #01
                </p>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-items-list">
                <div className="receipt-table-header">
                  <span>Product</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Subtotal</span>
                </div>
                {selectedSale.items.map((item) => (
                  <div key={item.sale_item_id} className="receipt-item-row">
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
                  <span>Subtotal:</span>
                  <span>{formatCurrency(Number(selectedSale.total_amount))}</span>
                </div>
                <div className="receipt-total-line">
                  <span>Tax / GST:</span>
                  <span>₹0.00</span>
                </div>
                <div className="receipt-total-line">
                  <strong>Total Paid:</strong>
                  <strong>{formatCurrency(Number(selectedSale.total_amount))}</strong>
                </div>
                <div className="receipt-total-line">
                  <span>Settlement:</span>
                  <span>{selectedSale.payment_method.toUpperCase()}</span>
                </div>
              </div>

              <div className="receipt-footer">
                <p>Thank you for your business!</p>
                <p className="receipt-footer-sub">Verified Digital Record</p>
              </div>
            </div>

            {/* Modal Actions */}
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
                onClick={() => setSelectedSale(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesHistory;