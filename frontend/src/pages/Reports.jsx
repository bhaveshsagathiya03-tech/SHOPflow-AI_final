import { useState, useEffect, useMemo } from "react";
import api from "../api/api";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ShoppingBag,
  Truck,
  AlertTriangle,
  BarChart3,
  Package,
  CreditCard,
  IndianRupee,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  Award,
} from "lucide-react";
import "../styles/Reports.css";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatCurrencyFull = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);

// Chart palette
const CHART_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e",
  "#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#e879f9",
];

const PERIOD_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "365d", label: "Last Year" },
  { value: "all", label: "All Time" },
];

// Custom recharts tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {p.name === "orders" ? p.value : formatCurrencyFull(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function Reports() {
  const [period, setPeriod] = useState("30d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) setRefreshing(true);
      else setLoading(true);

      const res = await api.get(`/reports/summary?period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load reports. Is the backend running?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  const profitMargin = useMemo(() => {
    if (!data || !data.total_revenue || data.total_revenue === 0) return 0;
    return ((data.gross_profit / data.total_revenue) * 100).toFixed(1);
  }, [data]);

  const avgOrderValue = useMemo(() => {
    if (!data || !data.total_sales_count || data.total_sales_count === 0) return 0;
    return data.total_revenue / data.total_sales_count;
  }, [data]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="reports-page page">
      {/* Page Header */}
      <div className="reports-page-header">
        <div>
          <h1 className="reports-title">
            <BarChart3 size={26} className="title-icon" />
            Business Reports & Analytics
          </h1>
          <p className="reports-subtitle">
            Revenue, profit, delivery, and inventory performance at a glance
          </p>
        </div>

        <div className="reports-header-controls">
          {/* Period Selector */}
          <div className="period-selector-tabs">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`period-tab ${period === opt.value ? "active" : ""}`}
                onClick={() => setPeriod(opt.value)}
              >
                <Calendar size={13} />
                {opt.label}
              </button>
            ))}
          </div>

          <button
            className="btn-refresh"
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            title="Refresh report data"
          >
            <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* ─── KPI CARDS ─── */}
          <div className="kpi-grid">
            <div className="kpi-card primary">
              <div className="kpi-icon-wrap">
                <IndianRupee size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Total Revenue</span>
                <span className="kpi-value">{formatCurrency(data.total_revenue)}</span>
              </div>
              <ArrowUpRight size={18} className="kpi-trend-icon" />
            </div>

            <div className="kpi-card success">
              <div className="kpi-icon-wrap">
                <TrendingUp size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Gross Profit</span>
                <span className="kpi-value">{formatCurrency(data.gross_profit)}</span>
                <span className="kpi-sub">{profitMargin}% margin</span>
              </div>
            </div>

            <div className="kpi-card info">
              <div className="kpi-icon-wrap">
                <ShoppingBag size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Total Orders</span>
                <span className="kpi-value">{data.total_sales_count.toLocaleString()}</span>
                <span className="kpi-sub">Avg {formatCurrency(avgOrderValue)}/order</span>
              </div>
            </div>

            <div className="kpi-card warning">
              <div className="kpi-icon-wrap">
                <Package size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Units Sold</span>
                <span className="kpi-value">{data.total_units_sold.toLocaleString()}</span>
                <span className="kpi-sub">{data.in_store_count} in-store · {data.delivery_count} delivery</span>
              </div>
            </div>

            <div className="kpi-card delivery">
              <div className="kpi-icon-wrap">
                <Truck size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Deliveries</span>
                <span className="kpi-value">{data.delivery_stats.total}</span>
                <span className="kpi-sub">{data.delivery_stats.delivered} delivered · {data.delivery_stats.out_for_delivery} en route</span>
              </div>
            </div>

            <div className={`kpi-card ${data.delivery_stats.pod_outstanding > 0 ? "danger" : "neutral"}`}>
              <div className="kpi-icon-wrap">
                <CreditCard size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-label">POD Outstanding</span>
                <span className="kpi-value">{formatCurrency(data.delivery_stats.pod_outstanding)}</span>
                <span className="kpi-sub">{formatCurrency(data.delivery_stats.pod_collected)} collected</span>
              </div>
            </div>
          </div>

          {/* ─── CHARTS ROW 1: Revenue Trend + Payment Methods ─── */}
          <div className="charts-row">
            {/* Daily Revenue Line Chart */}
            <div className="chart-card wide">
              <div className="chart-card-header">
                <h3>Revenue & Orders — Daily Trend</h3>
                <span className="chart-badge">{PERIOD_OPTIONS.find(p => p.value === period)?.label}</span>
              </div>
              {data.daily_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.daily_trend} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                      }
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      name="revenue"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      name="orders"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">No sales data in this period</div>
              )}
            </div>

            {/* Payment Method Donut */}
            <div className="chart-card narrow">
              <div className="chart-card-header">
                <h3>Revenue by Payment Method</h3>
              </div>
              {data.payment_method_breakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.payment_method_breakdown}
                        dataKey="revenue"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={2}
                      >
                        {data.payment_method_breakdown.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => formatCurrencyFull(val)}
                        contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-legend-list">
                    {data.payment_method_breakdown.map((pm, idx) => (
                      <div key={idx} className="pie-legend-item">
                        <span
                          className="pie-dot"
                          style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="pie-method">{pm.method}</span>
                        <span className="pie-amount">{formatCurrency(pm.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="chart-empty">No payment data</div>
              )}
            </div>
          </div>

          {/* ─── CHARTS ROW 2: Top Products Bar + Category ─── */}
          <div className="charts-row">
            {/* Top Products by Revenue */}
            <div className="chart-card medium">
              <div className="chart-card-header">
                <h3>
                  <Award size={16} className="header-icon" />
                  Top Products by Revenue
                </h3>
              </div>
              {data.top_products.length > 0 ? (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart
                    layout="vertical"
                    data={data.top_products.slice(0, 7)}
                    margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="product_name"
                      type="category"
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      width={100}
                    />
                    <Tooltip
                      formatter={(val, name) =>
                        name === "revenue" ? formatCurrencyFull(val) : val
                      }
                      contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8 }}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">No product sales data</div>
              )}
            </div>

            {/* Category Breakdown */}
            <div className="chart-card medium">
              <div className="chart-card-header">
                <h3>Category Sales Breakdown</h3>
              </div>
              {data.category_breakdown.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.category_breakdown} margin={{ top: 5, right: 16, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="category"
                        tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(val) => formatCurrencyFull(val)}
                        contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8 }}
                      />
                      <Bar dataKey="revenue" name="Revenue">
                        {data.category_breakdown.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Category table */}
                  <div className="category-table-compact">
                    {data.category_breakdown.map((cat, idx) => (
                      <div key={idx} className="cat-row">
                        <span className="cat-dot" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span className="cat-name">{cat.category || "Uncategorized"}</span>
                        <span className="cat-qty">{cat.qty_sold} units</span>
                        <span className="cat-rev">{formatCurrency(cat.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="chart-empty">No category data</div>
              )}
            </div>
          </div>

          {/* ─── BOTTOM ROW: Delivery Stats + Low Stock Alerts ─── */}
          <div className="charts-row">
            {/* Delivery Status Breakdown */}
            <div className="chart-card narrow">
              <div className="chart-card-header">
                <h3>
                  <Truck size={16} className="header-icon" />
                  Delivery Status Breakdown
                </h3>
              </div>
              <div className="delivery-stats-grid">
                {[
                  { label: "Pending", value: data.delivery_stats.pending, color: "#f59e0b" },
                  { label: "Out for Delivery", value: data.delivery_stats.out_for_delivery, color: "#22d3ee" },
                  { label: "Delivered", value: data.delivery_stats.delivered, color: "#10b981" },
                  { label: "Failed", value: data.delivery_stats.failed, color: "#f43f5e" },
                  { label: "Cancelled", value: data.delivery_stats.cancelled, color: "#6b7280" },
                ].map((item, i) => (
                  <div key={i} className="del-stat-row">
                    <span className="del-dot" style={{ background: item.color }} />
                    <span className="del-label">{item.label}</span>
                    <span className="del-count" style={{ color: item.color }}>{item.value}</span>
                  </div>
                ))}
                <div className="del-stat-divider" />
                <div className="del-stat-row pod-highlight">
                  <span className="del-label">POD Collected</span>
                  <span className="del-amount text-success">{formatCurrency(data.delivery_stats.pod_collected)}</span>
                </div>
                {data.delivery_stats.pod_outstanding > 0 && (
                  <div className="del-stat-row">
                    <span className="del-label">POD Outstanding</span>
                    <span className="del-amount text-danger">{formatCurrency(data.delivery_stats.pod_outstanding)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="chart-card wide">
              <div className="chart-card-header">
                <h3>
                  <AlertTriangle size={16} className="header-icon text-warning" />
                  Low Stock Alerts
                  {data.low_stock_alerts.length > 0 && (
                    <span className="alert-count-badge">{data.low_stock_alerts.length}</span>
                  )}
                </h3>
              </div>
              {data.low_stock_alerts.length === 0 ? (
                <div className="chart-empty all-good">
                  ✅ All products are well-stocked. No reorder alerts at this time.
                </div>
              ) : (
                <div className="low-stock-table-wrap">
                  <table className="low-stock-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Barcode</th>
                        <th>Current Stock</th>
                        <th>Min. Level</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.low_stock_alerts.map((item) => {
                        const isOut = item.stock === 0;
                        return (
                          <tr key={item.product_id} className={isOut ? "row-out" : "row-low"}>
                            <td className="product-name-cell">{item.product_name}</td>
                            <td>{item.category}</td>
                            <td><code>{item.barcode}</code></td>
                            <td className={isOut ? "text-danger" : "text-warning"}>
                              <strong>{item.stock}</strong>
                            </td>
                            <td>{item.min_stock}</td>
                            <td>
                              {isOut ? (
                                <span className="badge badge-danger">Out of Stock</span>
                              ) : (
                                <span className="badge badge-warning">Low Stock</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ─── TOP PRODUCTS DETAILED TABLE ─── */}
          <div className="chart-card full-width">
            <div className="chart-card-header">
              <h3>
                <Award size={16} className="header-icon" />
                Detailed Product Performance
              </h3>
            </div>
            {data.top_products.length === 0 ? (
              <div className="chart-empty">No product sales in this period</div>
            ) : (
              <div className="low-stock-table-wrap">
                <table className="low-stock-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Units Sold</th>
                      <th>Revenue</th>
                      <th>Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_products.map((prod, idx) => {
                      const share = data.total_revenue > 0
                        ? ((prod.revenue / data.total_revenue) * 100).toFixed(1)
                        : 0;
                      return (
                        <tr key={idx}>
                          <td className="text-muted">#{idx + 1}</td>
                          <td className="product-name-cell">{prod.product_name}</td>
                          <td>{prod.category}</td>
                          <td>{prod.qty_sold.toLocaleString()}</td>
                          <td><strong>{formatCurrencyFull(prod.revenue)}</strong></td>
                          <td>
                            <div className="share-bar-wrap">
                              <div
                                className="share-bar-fill"
                                style={{
                                  width: `${share}%`,
                                  background: CHART_COLORS[idx % CHART_COLORS.length],
                                }}
                              />
                              <span className="share-pct">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
