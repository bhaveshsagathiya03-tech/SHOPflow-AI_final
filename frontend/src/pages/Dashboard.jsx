import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import DashboardCard from "../components/DashboardCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ProductForm from "../components/ProductForm";
import "../styles/Dashboard.css";
import { toast } from "react-toastify";
import {
  ShoppingCart,
  Banknote,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Boxes,
  CheckCircle2,
  Calendar,
  CreditCard,
  QrCode,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

function Dashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [insights, setInsights] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [productRes, salesRes, insightsRes, analyticsRes] = await Promise.all([
        api.get("/products"),
        api.get("/sales"),
        api.get("/predict/insights"),
        api.get("/analytics"),
      ]);

      setProducts(productRes.data);
      setSales(salesRes.data);
      setInsights(insightsRes.data);
      setAnalytics(analyticsRes.data);

      if (isManual) toast.success("Dashboard refreshed");
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      toast.error("Failed to load dashboard data. Check backend connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalProducts = products.length;
  const totalSales = sales.length;

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const lowStockProducts = products.filter(
    (product) => Number(product.stock) <= Number(product.min_stock)
  );

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

  if (loading) {
    return (
      <div className="dashboard-loading-state">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="dashboard page">
      {/* Top Controls Header */}
      <div className="dashboard-action-bar">
        <div>
          <h2 className="dashboard-overview-heading">Executive Store Summary</h2>
          <p className="dashboard-overview-sub">
            Real-time telemetry and machine learning demand forecasts
          </p>
        </div>

        <div className="dashboard-action-buttons">
          <button
            className="btn btn-secondary btn-refresh"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
            <span>{refreshing ? "Refreshing..." : "Sync Live Data"}</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => navigate("/pos")}
          >
            <ShoppingCart size={16} />
            <span>Open POS Terminal</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-cards-grid">
        <DashboardCard
          title="Total SKUs"
          value={totalProducts.toLocaleString()}
          color="#4F46E5"
          icon={<Boxes size={22} />}
          subtitle="Catalog catalog items"
          badge="Catalog"
        />

        <DashboardCard
          title="Sales Completed"
          value={totalSales.toLocaleString()}
          color="#10B981"
          icon={<ShoppingCart size={22} />}
          subtitle="Processed transactions"
          badge="Live"
        />

        <DashboardCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          color="#0EA5E9"
          icon={<Banknote size={22} />}
          subtitle="Gross lifetime sales"
          badge="Gross"
        />

        <DashboardCard
          title="Low Stock Alerts"
          value={lowStockProducts.length}
          color={lowStockProducts.length > 0 ? "#EF4444" : "#10B981"}
          icon={<AlertTriangle size={22} />}
          subtitle={
            lowStockProducts.length > 0
              ? "Items at or below min threshold"
              : "All stock levels optimal"
          }
          badge={lowStockProducts.length > 0 ? "Action Required" : "Healthy"}
        />
      </div>

      {/* AI Predictive Intelligence Section */}
      {insights && (
        <div className="ai-intelligence-section">
          <div className="ai-banner-header">
            <div className="ai-banner-title-group">
              <div className="ai-sparkle-pill">
                <Sparkles size={16} />
                <span>AI PREDICTIVE ENGINE</span>
              </div>
              <h3>Machine Learning Demand & Restock Intelligence</h3>
            </div>
            <div className="ai-model-meta-tag">
              <span>Model: {insights.model_name || "Random Forest Regressor"}</span>
              <span className="meta-separator">•</span>
              <span className="accuracy-pill">
                🎯 {((insights.model_accuracy || 0.74) * 100).toFixed(0)}% Accuracy
              </span>
            </div>
          </div>

          <div className="ai-insights-grid">
            {/* Top Performing Product */}
            <div className="ai-feature-card">
              <div className="feature-card-header">
                <span className="card-tag">TOP SELLING ITEM</span>
                <TrendingUp size={18} className="text-ai-accent" />
              </div>
              <div className="feature-main-stat">
                <h4>{insights.top_product}</h4>
                <p className="feature-subtext">
                  Units Sold to Date: <strong>{insights.total_units_sold ?? "N/A"}</strong>
                </p>
              </div>
              <div className="feature-card-footer">
                <span>Current Stock Level:</span>
                <span className="stock-counter-badge">
                  {insights.current_stock?.toLocaleString()} units
                </span>
              </div>
            </div>

            {/* Demand Forecast */}
            <div className="ai-feature-card">
              <div className="feature-card-header">
                <span className="card-tag">DEMAND FORECAST</span>
                <Calendar size={18} className="text-ai-accent" />
              </div>
              <div className="feature-main-stat">
                <div className="stat-large-val">
                  {insights.predicted_sales}
                  <span className="stat-unit"> units tomorrow</span>
                </div>
                <p className="feature-subtext">
                  Projected next-day sales volume based on weekday patterns
                </p>
              </div>
              <div className="feature-card-footer">
                <span>Confidence Index:</span>
                <span className="badge badge-purple">High Confidence</span>
              </div>
            </div>

            {/* Restock Recommendation */}
            <div
              className={`ai-feature-card recommendation-card ${
                insights.recommended_order > 0 ? "urgent-restock" : "sufficient-stock"
              }`}
            >
              <div className="feature-card-header">
                <span className="card-tag">PURCHASE RECOMMENDATION</span>
                {insights.recommended_order > 0 ? (
                  <AlertTriangle size={18} className="text-danger" />
                ) : (
                  <CheckCircle2 size={18} className="text-success" />
                )}
              </div>
              <div className="feature-main-stat">
                <div className="stat-large-val">
                  {insights.recommended_order > 0
                    ? `+${insights.recommended_order} Units`
                    : "Optimal Level"}
                </div>
                <p className="feature-subtext">
                  {insights.status ||
                    (insights.recommended_order > 0
                      ? "Purchase recommended to prevent stockouts"
                      : "Stock buffer meets predicted demand")}
                </p>
              </div>
              <div className="feature-card-footer">
                <span>Buffer Status:</span>
                <span
                  className={`badge ${
                    insights.recommended_order > 0
                      ? "badge-warning"
                      : "badge-success"
                  }`}
                >
                  {insights.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts Grid */}
      {analytics && (
        <div className="analytics-section">
          <div className="section-title-wrap">
            <h3 className="section-title">Store Performance Analytics</h3>
            <span className="section-subtitle">Financial trends and inventory velocity</span>
          </div>

          <div className="charts-grid">
            {/* Daily Revenue Trend */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h4>Daily Revenue Velocity</h4>
                <span className="chart-tag">Gross (₹)</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.daily_sales || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748B" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), "Revenue"]}
                    contentStyle={{
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 15px -3px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Bar dataKey="revenue" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sales Volume Curve */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h4>Revenue Growth Trajectory</h4>
                <span className="chart-tag">Trend</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={analytics.daily_sales || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748B" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), "Revenue"]}
                    contentStyle={{
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 15px -3px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ fill: "#FFFFFF", stroke: "#10B981", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Category Breakdown */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h4>Sales by Category</h4>
                <span className="chart-tag">Volume Share</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.category_sales || []}
                    dataKey="quantity"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {(analytics.category_sales || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} units`, name]}
                    contentStyle={{
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 15px -3px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Products Volume */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h4>Top Selling Products</h4>
                <span className="chart-tag">Units Sold</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.top_products || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="product_name" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748B" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val) => [`${val} Units`, "Quantity"]}
                    contentStyle={{
                      background: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 10px 15px -3px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Bar dataKey="quantity" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Operational Grids: Recent Transactions & Low Stock Alerts */}
      <div className="dashboard-tables-grid">
        {/* Recent Transactions */}
        <div className="dashboard-table-card">
          <div className="table-card-header">
            <div>
              <h4>Recent Transactions</h4>
              <p className="table-card-subtitle">Last recorded checkout slips</p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/sales-history")}
            >
              <span>View All</span>
              <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="modern-dashboard-table">
              <thead>
                <tr>
                  <th>Sale ID</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-cell">
                      No transactions recorded yet
                    </td>
                  </tr>
                ) : (
                  sales
                    .slice()
                    .reverse()
                    .slice(0, 5)
                    .map((sale) => (
                      <tr key={sale.sale_id}>
                        <td>
                          <span className="sale-id-chip">#{sale.sale_id}</span>
                        </td>
                        <td>{getPaymentBadge(sale.payment_method)}</td>
                        <td className="amount-col">
                          {formatCurrency(Number(sale.total_amount))}
                        </td>
                        <td className="date-col">
                          {new Date(sale.sale_date).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="dashboard-table-card">
          <div className="table-card-header">
            <div>
              <h4>Low Stock Watchlist</h4>
              <p className="table-card-subtitle">SKUs requiring immediate replenishment</p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/inventory")}
            >
              <span>All Inventory</span>
              <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="modern-dashboard-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Stock</th>
                  <th>Min Threshold</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-cell text-success">
                      <CheckCircle2 size={16} className="inline-icon" /> All inventory levels are above minimum threshold
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.slice(0, 5).map((product) => (
                    <tr key={product.product_id}>
                      <td>
                        <div className="product-cell-name">
                          <strong>{product.product_name}</strong>
                          <span className="product-category-tag">{product.category}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-danger">
                          {product.stock} units
                        </span>
                      </td>
                      <td>
                        <span className="threshold-text">{product.min_stock} units</span>
                      </td>
                      <td>
                        <button
                          className="btn-quick-restock"
                          onClick={() => setEditProduct(product)}
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Direct Product Restock Modal */}
      {editProduct && (
        <ProductForm
          product={editProduct}
          onClose={() => setEditProduct(null)}
          refreshProducts={fetchDashboardData}
        />
      )}
    </div>
  );
}

export default Dashboard;