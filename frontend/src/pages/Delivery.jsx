import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import api from "../api/api";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-toastify";
import { QRCodeSVG } from "qrcode.react";
import {
  Truck,
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Phone,
  MapPin,
  QrCode,
  Banknote,
  Printer,
  ChevronRight,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  X,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import "../styles/Delivery.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Valid status transitions map matching backend
const ALLOWED_TRANSITIONS = {
  PENDING: [
    { status: "PREPARING", label: "Mark Preparing", icon: Package },
    { status: "CANCELLED", label: "Cancel Delivery", icon: XCircle, isDanger: true },
  ],
  PREPARING: [
    { status: "OUT_FOR_DELIVERY", label: "Dispatch (Out for Delivery)", icon: Truck },
    { status: "CANCELLED", label: "Cancel Delivery", icon: XCircle, isDanger: true },
  ],
  OUT_FOR_DELIVERY: [
    { status: "DELIVERED", label: "Mark Delivered", icon: CheckCircle2, isSuccess: true },
    { status: "FAILED", label: "Report Failed Delivery", icon: AlertTriangle, isDanger: true },
  ],
  FAILED: [
    { status: "OUT_FOR_DELIVERY", label: "Retry Delivery (Dispatch)", icon: Truck },
    { status: "CANCELLED", label: "Cancel Order", icon: XCircle, isDanger: true },
  ],
  DELIVERED: [],
  CANCELLED: [],
};

function Delivery() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackingNumber: routeTrackingNumber } = useParams();

  // Tab: "staff" (Delivery Management) or "track" (Customer Tracking)
  const [activeTab, setActiveTab] = useState(
    routeTrackingNumber || searchParams.get("tab") === "track" ? "track" : "staff"
  );

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Selected delivery for staff detail modal / drawer
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // Status update modal state
  const [statusModalDelivery, setStatusModalDelivery] = useState(null);
  const [targetStatus, setTargetStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [statusStaffName, setStatusStaffName] = useState("Lucky");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Pay on Delivery collection modal state
  const [paymentModalDelivery, setPaymentModalDelivery] = useState(null);
  const [podMethod, setPodMethod] = useState("CASH");
  const [podAmount, setPodAmount] = useState("");
  const [podReference, setPodReference] = useState("");
  const [podStaffName, setPodStaffName] = useState("Lucky");
  const [podNotes, setPodNotes] = useState("");
  const [isCollectingPayment, setIsCollectingPayment] = useState(false);
  const [verifiedPaymentReceipt, setVerifiedPaymentReceipt] = useState(null);

  // Customer tracking search state
  const [trackingQuery, setTrackingQuery] = useState(routeTrackingNumber || "");
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch all deliveries for staff view
  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await api.get("/deliveries");
      setDeliveries(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load delivery orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // If tracking route param or query is provided, auto-lookup
  useEffect(() => {
    if (routeTrackingNumber) {
      lookupCustomerTracking(routeTrackingNumber);
    }
  }, [routeTrackingNumber]);

  const lookupCustomerTracking = async (trackingCode) => {
    const code = (trackingCode || trackingQuery).trim();
    if (!code) {
      toast.warning("Please enter a tracking number or delivery ID");
      return;
    }

    try {
      setTrackingLoading(true);
      const res = await api.get(`/deliveries/track/${code}`);
      setTrackedOrder(res.data);
    } catch (err) {
      console.error(err);
      setTrackedOrder(null);
      toast.error(
        err.response?.data?.detail || `No delivery found for tracking code '${code}'`
      );
    } finally {
      setTrackingLoading(false);
    }
  };

  // Status transition handler
  const handleStatusUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!statusModalDelivery || !targetStatus) return;

    try {
      setIsUpdatingStatus(true);
      const res = await api.get; // ensure api is ready
      const updateRes = await api.put(
        `/deliveries/${statusModalDelivery.delivery_id}/status`,
        {
          status: targetStatus,
          note: statusNote.trim() || undefined,
          staff_name: statusStaffName.trim() || "Staff",
        }
      );

      toast.success(
        `Delivery #${updateRes.data.delivery_id} marked as ${updateRes.data.delivery_status}`
      );

      setStatusModalDelivery(null);
      setTargetStatus("");
      setStatusNote("");

      // Update in selectedDelivery view if open
      if (selectedDelivery?.delivery_id === updateRes.data.delivery_id) {
        setSelectedDelivery(updateRes.data);
      }

      fetchDeliveries();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || "Failed to update delivery status"
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Payment collection handler (Pay on Delivery)
  const handlePaymentCollectionSubmit = async (e) => {
    e.preventDefault();
    if (!paymentModalDelivery) return;

    const amount = Number(podAmount || paymentModalDelivery.amount_due);
    if (amount <= 0) {
      toast.warning("Payment amount must be greater than zero");
      return;
    }

    try {
      setIsCollectingPayment(true);
      const res = await api.post(
        `/deliveries/${paymentModalDelivery.delivery_id}/collect-payment`,
        {
          payment_method: podMethod,
          amount: amount,
          payment_reference: podReference.trim() || undefined,
          staff_name: podStaffName.trim() || "Staff",
          notes: podNotes.trim() || undefined,
        }
      );

      toast.success(
        `Payment of ${formatCurrency(amount)} collected via ${podMethod}!`
      );

      setVerifiedPaymentReceipt({
        delivery: res.data,
        method: podMethod,
        amount: amount,
        reference: podReference.trim(),
        collectedBy: podStaffName,
        timestamp: new Date().toISOString(),
      });

      setPaymentModalDelivery(null);
      setPodAmount("");
      setPodReference("");
      setPodNotes("");

      if (selectedDelivery?.delivery_id === res.data.delivery_id) {
        setSelectedDelivery(res.data);
      }

      fetchDeliveries();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || "Failed to record payment collection"
      );
    } finally {
      setIsCollectingPayment(false);
    }
  };

  const copyTrackingLink = (trackingNumber) => {
    const url = `${window.location.origin}/track/${trackingNumber}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.info("Customer tracking link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Filtered deliveries for staff
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        d.tracking_number.toLowerCase().includes(q) ||
        d.customer_name.toLowerCase().includes(q) ||
        d.customer_phone.toLowerCase().includes(q) ||
        d.delivery_address.toLowerCase().includes(q) ||
        String(d.sale_id).includes(q);

      const matchStatus =
        statusFilter === "all" ||
        d.delivery_status.toLowerCase() === statusFilter.toLowerCase();

      const matchPayment =
        paymentFilter === "all" ||
        d.payment_status.toLowerCase() === paymentFilter.toLowerCase();

      return matchSearch && matchStatus && matchPayment;
    });
  }, [deliveries, search, statusFilter, paymentFilter]);

  // Metrics
  const totalDeliveries = deliveries.length;
  const pendingCount = deliveries.filter((d) => d.delivery_status === "PENDING").length;
  const outForDeliveryCount = deliveries.filter(
    (d) => d.delivery_status === "OUT_FOR_DELIVERY"
  ).length;
  const deliveredUnpaidCount = deliveries.filter(
    (d) => d.delivery_status === "DELIVERED" && d.payment_status === "UNPAID"
  ).length;
  const totalCollectedAmount = deliveries
    .filter((d) => d.payment_status === "PAID")
    .reduce((sum, d) => sum + Number(d.amount_collected || d.amount_due || 0), 0);

  // Status badge generator
  const getDeliveryStatusBadge = (status) => {
    switch ((status || "").toUpperCase()) {
      case "PENDING":
        return (
          <span className="badge badge-warning">
            <Clock size={12} /> Pending Dispatch
          </span>
        );
      case "PREPARING":
        return (
          <span className="badge badge-purple">
            <Package size={12} /> Packing & Ready
          </span>
        );
      case "OUT_FOR_DELIVERY":
        return (
          <span className="badge badge-info">
            <Truck size={12} /> Out for Delivery
          </span>
        );
      case "DELIVERED":
        return (
          <span className="badge badge-success">
            <CheckCircle2 size={12} /> Delivered
          </span>
        );
      case "FAILED":
        return (
          <span className="badge badge-danger">
            <AlertTriangle size={12} /> Delivery Failed
          </span>
        );
      case "CANCELLED":
        return (
          <span className="badge badge-neutral">
            <XCircle size={12} /> Cancelled
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getPaymentStatusBadge = (delivery) => {
    const isPaid = (delivery.payment_status || "").toUpperCase() === "PAID";
    const method = delivery.payment_method || "COD";

    if (isPaid) {
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} /> Paid ({method})
        </span>
      );
    }

    return (
      <span className="badge badge-warning pod-unpaid-badge">
        <Clock size={12} /> Unpaid ({method})
      </span>
    );
  };

  return (
    <div className="delivery-page page">
      {/* Top View Selector Tabs */}
      <div className="delivery-mode-nav">
        <button
          type="button"
          className={`mode-nav-btn ${activeTab === "staff" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("staff");
            setSearchParams({ tab: "staff" });
          }}
        >
          <Truck size={18} />
          <span>Staff Delivery Management</span>
          {deliveredUnpaidCount > 0 && (
            <span className="badge-notification-count">
              {deliveredUnpaidCount} To Collect
            </span>
          )}
        </button>

        <button
          type="button"
          className={`mode-nav-btn ${activeTab === "track" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("track");
            setSearchParams({ tab: "track" });
          }}
        >
          <Search size={18} />
          <span>Customer Tracking Portal</span>
        </button>
      </div>

      {/* ================================================= */}
      {/* TAB 1: STAFF DELIVERY MANAGEMENT                  */}
      {/* ================================================= */}
      {activeTab === "staff" && (
        <div className="staff-delivery-view">
          {/* Metrics Banner */}
          <div className="delivery-kpi-bar">
            <div className="del-stat-item">
              <span className="del-stat-label">Total Orders</span>
              <span className="del-stat-value">{totalDeliveries}</span>
            </div>
            <div className="del-stat-divider" />
            <div className="del-stat-item">
              <span className="del-stat-label">Pending Prep</span>
              <span className="del-stat-value">{pendingCount}</span>
            </div>
            <div className="del-stat-divider" />
            <div className="del-stat-item">
              <span className="del-stat-label">On The Road</span>
              <span className="del-stat-value text-info">{outForDeliveryCount}</span>
            </div>
            <div className="del-stat-divider" />
            <div className="del-stat-item">
              <span className="del-stat-label">Delivered & Unpaid</span>
              <span
                className={`del-stat-value ${
                  deliveredUnpaidCount > 0 ? "text-danger" : ""
                }`}
              >
                {deliveredUnpaidCount} Action Req
              </span>
            </div>
            <div className="del-stat-divider" />
            <div className="del-stat-item">
              <span className="del-stat-label">Settled Revenue</span>
              <span className="del-stat-value text-success">
                {formatCurrency(totalCollectedAmount)}
              </span>
            </div>
          </div>

          {/* Header & Quick Launch Scanner */}
          <div className="delivery-section-header">
            <div>
              <h2>Store Delivery & Dispatch Management</h2>
              <p className="delivery-section-sub">
                Manage order lifecycles, courier assignments, and post-delivery payment collections
              </p>
            </div>

            <button
              className="btn btn-secondary btn-launch-scanner"
              onClick={() => navigate("/scanner")}
              title="Open Camera Barcode Scanner"
            >
              <QrCode size={16} />
              <span>Camera Scanner</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="delivery-toolbar-card">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by Tracking # (SF-DEL-...), customer name, phone, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="delivery-search-box"
              />
              {search && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearch("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="filter-select-wrapper">
              <Filter size={15} className="filter-icon" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Delivery States</option>
                <option value="PENDING">Pending</option>
                <option value="PREPARING">Preparing</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Payment Filter */}
            <select
              className="payment-filter-select"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="all">All Payment States</option>
              <option value="UNPAID">Unpaid (Action Required)</option>
              <option value="PAID">Paid / Settled</option>
            </select>
          </div>

          {/* Deliveries Table */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="table-container">
              <table className="delivery-table">
                <thead>
                  <tr>
                    <th>Tracking #</th>
                    <th>Customer & Address</th>
                    <th>Order Items</th>
                    <th>Amount Due</th>
                    <th>Delivery Status</th>
                    <th>Payment State</th>
                    <th className="delivery-actions-header">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-delivery-cell">
                        <div className="empty-delivery-state">
                          <Truck size={38} className="empty-icon" />
                          <h4>No Delivery Orders Found</h4>
                          <p>
                            {deliveries.length === 0
                              ? "No delivery orders have been created. Select 'Delivery Order' in the POS Terminal to place one."
                              : "No orders match your filter criteria."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDeliveries.map((del) => {
                      const isDelivered = del.delivery_status === "DELIVERED";
                      const isUnpaid = del.payment_status === "UNPAID";
                      const allowedNext = ALLOWED_TRANSITIONS[del.delivery_status] || [];

                      return (
                        <tr key={del.delivery_id}>
                          {/* Tracking Number */}
                          <td>
                            <div className="tracking-cell">
                              <span className="tracking-code-badge">
                                {del.tracking_number}
                              </span>
                              <span className="order-id-sub">
                                Order #{del.sale_id}
                              </span>
                            </div>
                          </td>

                          {/* Customer & Address */}
                          <td>
                            <div className="customer-cell">
                              <strong>{del.customer_name}</strong>
                              <span className="customer-phone-sub">
                                <Phone size={11} className="inline-icon" /> {del.customer_phone}
                              </span>
                              <span className="customer-address-sub" title={del.delivery_address}>
                                <MapPin size={11} className="inline-icon" /> {del.delivery_address}
                              </span>
                            </div>
                          </td>

                          {/* Items Preview */}
                          <td>
                            <div className="items-preview-cell">
                              {del.items && del.items.length > 0 ? (
                                <>
                                  <span className="items-summary-text">
                                    {del.items[0].product_name || `Product #${del.items[0].product_id}`}
                                    {del.items.length > 1 && ` +${del.items.length - 1} more`}
                                  </span>
                                  <span className="items-qty-tag">
                                    {del.items.reduce((s, i) => s + i.quantity, 0)} units total
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted">Order items</span>
                              )}
                            </div>
                          </td>

                          {/* Amount Due */}
                          <td className="amount-due-cell">
                            <strong>{formatCurrency(del.amount_due)}</strong>
                          </td>

                          {/* Delivery Status */}
                          <td>{getDeliveryStatusBadge(del.delivery_status)}</td>

                          {/* Payment State */}
                          <td>{getPaymentStatusBadge(del)}</td>

                          {/* Actions */}
                          <td className="delivery-actions-cell">
                            <div className="delivery-action-buttons">
                              {/* If Unpaid and Delivered: Highlight Pay on Delivery action */}
                              {isDelivered && isUnpaid && (
                                <button
                                  className="btn-action-collect-pay"
                                  onClick={() => {
                                    setPaymentModalDelivery(del);
                                    setPodAmount(String(del.amount_due));
                                    setPodMethod(del.payment_method || "CASH");
                                  }}
                                  title="Record Cash or UPI collection"
                                >
                                  <Banknote size={14} />
                                  <span>Collect Pay</span>
                                </button>
                              )}

                              {/* Update Status button if next steps available */}
                              {allowedNext.length > 0 && (
                                <button
                                  className="btn-action-step"
                                  onClick={() => {
                                    setStatusModalDelivery(del);
                                    setTargetStatus(allowedNext[0].status);
                                  }}
                                  title="Progress Delivery Lifecycle"
                                >
                                  <span>Next: {allowedNext[0].label}</span>
                                  <ChevronRight size={14} />
                                </button>
                              )}

                              {/* View Details Drawer */}
                              <button
                                className="btn-action-view"
                                onClick={() => setSelectedDelivery(del)}
                                title="View full delivery details & activity timeline"
                              >
                                View
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
        </div>
      )}

      {/* ================================================= */}
      {/* TAB 2: CUSTOMER TRACKING PORTAL                   */}
      {/* ================================================= */}
      {activeTab === "track" && (
        <div className="customer-tracking-view">
          {/* Tracking Search Hero Card */}
          <div className="tracking-hero-card">
            <div className="tracking-hero-text">
              <h3>Track Your Delivery</h3>
              <p>
                Enter your Tracking Number (e.g. <code>SF-DEL-1015</code>) to inspect live order progress, delivery address, and pay-on-delivery balance
              </p>
            </div>

            <div className="tracking-search-bar">
              <input
                type="text"
                placeholder="Enter tracking number (e.g. SF-DEL-1015)..."
                value={trackingQuery}
                onChange={(e) => setTrackingQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupCustomerTracking()}
                className="tracking-hero-input"
              />
              <button
                className="btn btn-primary btn-track-hero"
                onClick={() => lookupCustomerTracking()}
                disabled={trackingLoading}
              >
                <Search size={16} />
                <span>{trackingLoading ? "Locating..." : "Track Package"}</span>
              </button>
            </div>
          </div>

          {/* Tracked Order Result Card */}
          {trackedOrder && (
            <div className="tracked-order-result-card">
              {/* Result Header */}
              <div className="result-header">
                <div>
                  <div className="result-tracking-pill">
                    <Truck size={16} />
                    <span>TRACKING #{trackedOrder.tracking_number}</span>
                  </div>
                  <h4>Delivery for {trackedOrder.customer_name}</h4>
                  <p className="result-address">
                    <MapPin size={13} className="inline-icon" /> {trackedOrder.delivery_address}
                  </p>
                </div>

                <div className="result-header-right">
                  <button
                    className="btn btn-secondary btn-copy-link"
                    onClick={() => copyTrackingLink(trackedOrder.tracking_number)}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? "Link Copied" : "Share Tracking Link"}</span>
                  </button>
                  <div className="current-status-large">
                    {getDeliveryStatusBadge(trackedOrder.delivery_status)}
                  </div>
                </div>
              </div>

              {/* Pay on Delivery Notice Banner */}
              <div
                className={`pod-notice-banner ${
                  trackedOrder.payment_status === "PAID"
                    ? "pod-banner-paid"
                    : "pod-banner-unpaid"
                }`}
              >
                {trackedOrder.payment_status === "PAID" ? (
                  <>
                    <CheckCircle2 size={20} className="text-success" />
                    <div>
                      <strong>Payment Settled & Verified</strong>
                      <p>
                        Amount of {formatCurrency(trackedOrder.amount_collected || trackedOrder.amount_due)} has been successfully collected via {trackedOrder.payment_method}.
                        {trackedOrder.payment_reference && ` (Ref: ${trackedOrder.payment_reference})`}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Banknote size={20} className="text-warning" />
                    <div>
                      <strong>Pay on Delivery Required: {formatCurrency(trackedOrder.amount_due)}</strong>
                      <p>
                        Please keep {formatCurrency(trackedOrder.amount_due)} ready via {trackedOrder.payment_method === "POD_UPI" ? "UPI (Scan on Delivery)" : "Cash on Delivery"}. Payment is collected upon doorstep handover.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Visual 4-Step Progress Stepper */}
              <div className="visual-stepper-container">
                {(() => {
                  const s = trackedOrder.delivery_status;
                  const step1 = true;
                  const step2 = ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(s);
                  const step3 = ["OUT_FOR_DELIVERY", "DELIVERED"].includes(s);
                  const step4 = s === "DELIVERED";
                  const isFailed = s === "FAILED";
                  const isCancelled = s === "CANCELLED";

                  return (
                    <div className="stepper-track">
                      {/* Step 1 */}
                      <div className={`step-node ${step1 ? "completed" : ""}`}>
                        <div className="step-circle">
                          <Check size={16} />
                        </div>
                        <span className="step-title">Order Placed</span>
                        <span className="step-desc">Received at Store</span>
                      </div>

                      <div className={`step-connector ${step2 ? "active" : ""}`} />

                      {/* Step 2 */}
                      <div className={`step-node ${step2 ? "completed" : ""}`}>
                        <div className="step-circle">
                          {step2 ? <Check size={16} /> : "2"}
                        </div>
                        <span className="step-title">Packed & Ready</span>
                        <span className="step-desc">Staged for Pickup</span>
                      </div>

                      <div className={`step-connector ${step3 ? "active" : ""}`} />

                      {/* Step 3 */}
                      <div className={`step-node ${step3 ? "completed" : ""}`}>
                        <div className="step-circle">
                          {step3 ? <Check size={16} /> : "3"}
                        </div>
                        <span className="step-title">Out for Delivery</span>
                        <span className="step-desc">Courier En Route</span>
                      </div>

                      <div className={`step-connector ${step4 ? "active" : ""}`} />

                      {/* Step 4 */}
                      <div
                        className={`step-node ${
                          step4
                            ? "completed"
                            : isFailed
                            ? "failed"
                            : isCancelled
                            ? "cancelled"
                            : ""
                        }`}
                      >
                        <div className="step-circle">
                          {step4 ? (
                            <Check size={16} />
                          ) : isFailed ? (
                            <AlertTriangle size={16} />
                          ) : (
                            "4"
                          )}
                        </div>
                        <span className="step-title">
                          {isFailed
                            ? "Delivery Failed"
                            : isCancelled
                            ? "Cancelled"
                            : "Delivered"}
                        </span>
                        <span className="step-desc">
                          {step4 ? "Handed Over" : "Final Stage"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Items & Activity Timeline Grid */}
              <div className="result-body-grid">
                {/* Ordered Items */}
                <div className="result-items-card">
                  <h5>Order Contents</h5>
                  <div className="result-items-list">
                    {trackedOrder.items && trackedOrder.items.length > 0 ? (
                      trackedOrder.items.map((item, idx) => (
                        <div key={idx} className="result-item-row">
                          <span className="item-qty-pill">{item.quantity}x</span>
                          <span className="item-name">
                            {item.product_name || `Product #${item.product_id}`}
                          </span>
                          <span className="item-price">
                            {formatCurrency(Number(item.subtotal))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">No items found</p>
                    )}
                  </div>
                  <div className="result-items-total">
                    <span>Total Amount Due:</span>
                    <strong>{formatCurrency(trackedOrder.amount_due)}</strong>
                  </div>
                </div>

                {/* Audit Event Timeline */}
                <div className="result-events-card">
                  <h5>Status Audit Log</h5>
                  <div className="events-timeline">
                    {trackedOrder.events && trackedOrder.events.length > 0 ? (
                      trackedOrder.events.map((ev, idx) => (
                        <div key={idx} className="timeline-item">
                          <div className="timeline-dot" />
                          <div className="timeline-content">
                            <div className="timeline-top">
                              <span className="timeline-status-tag">{ev.status}</span>
                              <span className="timeline-time">
                                {ev.timestamp
                                  ? new Date(ev.timestamp).toLocaleString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                            <p className="timeline-note">{ev.note}</p>
                            {ev.updated_by && (
                              <span className="timeline-by">Logged by: {ev.updated_by}</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">No events logged yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL 1: STAFF STATUS UPDATE MODAL                */}
      {/* ================================================= */}
      {statusModalDelivery && (
        <div className="modal-overlay" onClick={() => setStatusModalDelivery(null)}>
          <div
            className="modal-card status-update-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Update Delivery Status</h3>
                <p className="modal-subtitle">
                  Package #{statusModalDelivery.tracking_number} • Current:{" "}
                  <strong>{statusModalDelivery.delivery_status}</strong>
                </p>
              </div>
              <button
                className="btn-modal-close"
                onClick={() => setStatusModalDelivery(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleStatusUpdateSubmit} className="modal-body-form">
              <div className="form-field-group">
                <label>Select Next Valid Status:</label>
                <div className="next-status-options-grid">
                  {(ALLOWED_TRANSITIONS[statusModalDelivery.delivery_status] || []).map(
                    (opt) => {
                      const IconComp = opt.icon;
                      return (
                        <button
                          key={opt.status}
                          type="button"
                          className={`next-status-card ${
                            targetStatus === opt.status ? "selected" : ""
                          } ${opt.isDanger ? "danger-option" : ""}`}
                          onClick={() => setTargetStatus(opt.status)}
                        >
                          <IconComp size={18} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="staff-name-input">Staff / Courier Name:</label>
                <input
                  id="staff-name-input"
                  type="text"
                  value={statusStaffName}
                  onChange={(e) => setStatusStaffName(e.target.value)}
                  placeholder="e.g. Vikram or Lucky"
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="status-note-input">Status Note / Milestone Details:</label>
                <textarea
                  id="status-note-input"
                  rows="3"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Package handed to customer at doorstep. Sealed and verified."
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStatusModalDelivery(null)}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUpdatingStatus || !targetStatus}
                >
                  {isUpdatingStatus ? "Updating..." : "Commit Status Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL 2: PAY ON DELIVERY COLLECTION MODAL         */}
      {/* ================================================= */}
      {paymentModalDelivery && (
        <div className="modal-overlay" onClick={() => setPaymentModalDelivery(null)}>
          <div
            className="modal-card pod-collection-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Record Pay on Delivery</h3>
                <p className="modal-subtitle">
                  Order #{paymentModalDelivery.sale_id} • {paymentModalDelivery.customer_name}
                </p>
              </div>
              <button
                className="btn-modal-close"
                onClick={() => setPaymentModalDelivery(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaymentCollectionSubmit} className="modal-body-form">
              {/* Outstanding Balance Callout */}
              <div className="pod-balance-callout">
                <span>Total Amount Due:</span>
                <span className="balance-amount">
                  {formatCurrency(paymentModalDelivery.amount_due)}
                </span>
              </div>

              {/* Payment Method Selector */}
              <div className="form-field-group">
                <label>Payment Collection Method:</label>
                <div className="pod-method-toggle-grid">
                  <button
                    type="button"
                    className={`pod-method-card ${podMethod === "CASH" ? "active" : ""}`}
                    onClick={() => setPodMethod("CASH")}
                  >
                    <Banknote size={20} />
                    <strong>Cash on Delivery</strong>
                    <span>Cash collected at doorstep</span>
                  </button>

                  <button
                    type="button"
                    className={`pod-method-card ${podMethod === "UPI" ? "active" : ""}`}
                    onClick={() => setPodMethod("UPI")}
                  >
                    <QrCode size={20} />
                    <strong>UPI on Delivery</strong>
                    <span>Customer scans store QR</span>
                  </button>
                </div>
              </div>

              {/* UPI QR Code Generation & Verification */}
              {podMethod === "UPI" && (
                <div className="upi-qr-display-panel">
                  <div className="qr-container">
                    {/* Real NPCI UPI payload encoded in SVG */}
                    <QRCodeSVG
                      value={`upi://pay?pa=shopflow@upi&pn=ShopFlow+Store&am=${Number(
                        paymentModalDelivery.amount_due
                      ).toFixed(2)}&cu=INR&tn=DEL-${paymentModalDelivery.delivery_id}`}
                      size={150}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <div className="upi-instructions">
                    <h6>Scan with GPay / PhonePe / Paytm</h6>
                    <p>
                      Merchant: <strong>ShopFlow Store (shopflow@upi)</strong>
                    </p>
                    <p>
                      Amount: <strong>{formatCurrency(paymentModalDelivery.amount_due)}</strong>
                    </p>
                    <div className="upi-warning-note">
                      <AlertTriangle size={13} className="inline-icon" />
                      Do not mark paid until you verify the transaction on the merchant terminal or bank SMS.
                    </div>
                  </div>
                </div>
              )}

              {/* Inputs */}
              <div className="form-row-two-col">
                <div className="form-field-group">
                  <label htmlFor="pod-amount-input">Amount Collected (₹):</label>
                  <input
                    id="pod-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={podAmount}
                    onChange={(e) => setPodAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="pod-staff-input">Collected By (Staff/Courier):</label>
                  <input
                    id="pod-staff-input"
                    type="text"
                    value={podStaffName}
                    onChange={(e) => setPodStaffName(e.target.value)}
                    placeholder="e.g. Vikram or Lucky"
                    required
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="pod-ref-input">
                  {podMethod === "UPI" ? "UPI UTR / Reference ID:" : "Cash Receipt Reference (Optional):"}
                </label>
                <input
                  id="pod-ref-input"
                  type="text"
                  value={podReference}
                  onChange={(e) => setPodReference(e.target.value)}
                  placeholder={
                    podMethod === "UPI"
                      ? "12-digit UPI UTR number from customer app"
                      : "e.g. CASH-SLIP-102"
                  }
                  required={podMethod === "UPI"}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="pod-notes-input">Collection Notes:</label>
                <input
                  id="pod-notes-input"
                  type="text"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  placeholder="e.g. Handed exact cash / Verified on PhonePe"
                />
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPaymentModalDelivery(null)}
                  disabled={isCollectingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCollectingPayment}
                >
                  {isCollectingPayment ? "Recording Payment..." : "Confirm Payment Collected"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL 3: VERIFIED PAYMENT RECEIPT CONFIRMATION     */}
      {/* ================================================= */}
      {verifiedPaymentReceipt && (
        <div className="modal-overlay" onClick={() => setVerifiedPaymentReceipt(null)}>
          <div
            className="modal-card receipt-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="receipt-modal-actions no-print">
              <span className="receipt-badge">
                <CheckCircle2 size={15} /> Payment Collection Verified
              </span>
              <button
                className="btn-modal-close"
                onClick={() => setVerifiedPaymentReceipt(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="printable-receipt">
              <div className="receipt-paper-header">
                <h2>🛍️ SHOPFLOW AI</h2>
                <p className="receipt-store-sub">Pay on Delivery Settlement Receipt</p>
                <p className="receipt-meta">
                  Tracking #: {verifiedPaymentReceipt.delivery.tracking_number}
                </p>
                <p className="receipt-meta">
                  Date: {new Date(verifiedPaymentReceipt.timestamp).toLocaleString()}
                </p>
                <p className="receipt-meta">
                  Collected By: {verifiedPaymentReceipt.collectedBy}
                </p>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-totals-section">
                <div className="receipt-total-line">
                  <span>Customer:</span>
                  <strong>{verifiedPaymentReceipt.delivery.customer_name}</strong>
                </div>
                <div className="receipt-total-line">
                  <span>Payment Method:</span>
                  <span>{verifiedPaymentReceipt.method}</span>
                </div>
                {verifiedPaymentReceipt.reference && (
                  <div className="receipt-total-line">
                    <span>Reference / UTR:</span>
                    <code>{verifiedPaymentReceipt.reference}</code>
                  </div>
                )}
                <div className="receipt-total-line">
                  <span>Amount Settled:</span>
                  <strong>{formatCurrency(verifiedPaymentReceipt.amount)}</strong>
                </div>
                <div className="receipt-total-line">
                  <span>Status:</span>
                  <span className="badge badge-success">SETTLED & RECORDED</span>
                </div>
              </div>

              <div className="receipt-footer">
                <p>Payment recorded and confirmed in store ledger.</p>
                <p className="receipt-footer-sub">ShopFlow Enterprise POS</p>
              </div>
            </div>

            <div className="receipt-modal-buttons no-print">
              <button
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>Print Settlement Slip</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setVerifiedPaymentReceipt(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* DRAWER / MODAL 4: STAFF DELIVERY DETAILS & TIMELINE*/}
      {/* ================================================= */}
      {selectedDelivery && (
        <div className="modal-overlay" onClick={() => setSelectedDelivery(null)}>
          <div
            className="modal-card delivery-details-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <span className="tracking-code-badge large">
                  {selectedDelivery.tracking_number}
                </span>
                <h3>Delivery Order #{selectedDelivery.sale_id}</h3>
              </div>
              <button
                className="btn-modal-close"
                onClick={() => setSelectedDelivery(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Customer & Address Card */}
              <div className="drawer-info-card">
                <h5>Customer Information</h5>
                <p>
                  <strong>Name:</strong> {selectedDelivery.customer_name}
                </p>
                <p>
                  <strong>Phone:</strong> {selectedDelivery.customer_phone}
                </p>
                <p>
                  <strong>Address:</strong> {selectedDelivery.delivery_address}
                </p>
                {selectedDelivery.delivery_notes && (
                  <p>
                    <strong>Delivery Notes:</strong> {selectedDelivery.delivery_notes}
                  </p>
                )}
              </div>

              {/* Status & Payment Summary */}
              <div className="drawer-info-card">
                <h5>Delivery & Settlement Status</h5>
                <div className="status-meta-row">
                  <div>
                    <span className="meta-label">Delivery Stage:</span>
                    <div>{getDeliveryStatusBadge(selectedDelivery.delivery_status)}</div>
                  </div>
                  <div>
                    <span className="meta-label">Payment Status:</span>
                    <div>{getPaymentStatusBadge(selectedDelivery)}</div>
                  </div>
                  <div>
                    <span className="meta-label">Total Amount:</span>
                    <strong className="text-primary font-lg">
                      {formatCurrency(selectedDelivery.amount_due)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Ordered Items */}
              <div className="drawer-info-card">
                <h5>Package Items ({selectedDelivery.items?.length || 0} SKUs)</h5>
                <div className="drawer-items-list">
                  {selectedDelivery.items?.map((item, i) => (
                    <div key={i} className="drawer-item-row">
                      <span>{item.quantity}x</span>
                      <span className="item-name">{item.product_name || `Product #${item.product_id}`}</span>
                      <span>{formatCurrency(Number(item.subtotal))}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Log */}
              <div className="drawer-info-card">
                <h5>Audit Event Log</h5>
                <div className="events-timeline">
                  {selectedDelivery.events?.map((ev, i) => (
                    <div key={i} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-top">
                          <strong>{ev.status}</strong>
                          <span className="timeline-time">
                            {ev.timestamp
                              ? new Date(ev.timestamp).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        <p>{ev.note}</p>
                        {ev.updated_by && <span className="timeline-by">By: {ev.updated_by}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button
                className="btn btn-secondary"
                onClick={() => copyTrackingLink(selectedDelivery.tracking_number)}
              >
                <Copy size={15} />
                <span>Copy Tracking Link</span>
              </button>

              {selectedDelivery.delivery_status === "DELIVERED" &&
                selectedDelivery.payment_status === "UNPAID" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setPaymentModalDelivery(selectedDelivery);
                      setPodAmount(String(selectedDelivery.amount_due));
                      setPodMethod(selectedDelivery.payment_method || "CASH");
                    }}
                  >
                    <Banknote size={15} />
                    <span>Collect Pay on Delivery</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Delivery;
