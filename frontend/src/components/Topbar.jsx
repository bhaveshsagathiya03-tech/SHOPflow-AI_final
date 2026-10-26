import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  ShoppingCart,
  Clock,
  Sparkles,
} from "lucide-react";
import "./Topbar.css";

function Topbar({ onToggleMobileSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  const getPageInfo = () => {
    switch (location.pathname) {
      case "/":
        return {
          title: "Store Dashboard & AI Intelligence",
          subtitle: "Real-time metrics, demand forecasting & inventory health",
        };
      case "/inventory":
        return {
          title: "Inventory Catalog",
          subtitle: "Manage products, barcodes, stock levels & profit margins",
        };
      case "/pos":
        return {
          title: "Point of Sale (POS) Terminal",
          subtitle: "Fast barcode scanning, cart register & receipt billing",
        };
      case "/sales-history":
        return {
          title: "Sales History & Records",
          subtitle: "Audit completed orders, payment methods & view digital receipts",
        };
      default:
        return {
          title: "ShopFlow AI",
          subtitle: "Retail POS & Management System",
        };
    }
  };

  const { title, subtitle } = getPageInfo();
  const isPOS = location.pathname === "/pos";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-hamburger-btn"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="topbar-headings">
          <h1 className="topbar-title">{title}</h1>
          <p className="topbar-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        {/* Live Clock for Cashier Terminal */}
        <div className="topbar-clock">
          <Clock size={15} className="clock-icon" />
          <span>{currentTime}</span>
        </div>

        {/* System Health Badge */}
        <div className="system-status-pill">
          <span className="status-dot"></span>
          <span className="status-text">Store Online</span>
        </div>

        {/* Quick New Sale Action */}
        {!isPOS && (
          <button
            className="btn-quick-sale"
            onClick={() => navigate("/pos")}
            title="Open POS Terminal"
          >
            <ShoppingCart size={16} />
            <span>New Sale</span>
          </button>
        )}

        {/* Profile Pill */}
        <div className="topbar-profile">
          <div className="topbar-avatar">L</div>
          <div className="topbar-user-meta">
            <span className="user-name">Lucky</span>
            <span className="user-badge">
              <Sparkles size={10} /> Manager
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;