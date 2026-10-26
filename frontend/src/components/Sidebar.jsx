import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Receipt,
  Sparkles,
  X,
  Store,
  ShieldCheck,
  Truck,
  ScanBarcode,
  BarChart3,
} from "lucide-react";
import "./Sidebar.css";

function Sidebar({ mobileOpen, onCloseMobile }) {
  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-container">
          <div className="brand-icon">
            <Store size={22} className="brand-icon-svg" />
          </div>
          <div className="brand-text">
            <div className="brand-title">
              ShopFlow <span className="brand-ai-badge">AI</span>
            </div>
            <div className="brand-subtitle">Smart POS & Inventory</div>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button 
          className="mobile-close-btn" 
          onClick={onCloseMobile} 
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="sidebar-section-label">MAIN WORKFLOW</div>
      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <LayoutDashboard size={19} className="nav-icon" />
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink
          to="/inventory"
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <Boxes size={19} className="nav-icon" />
          <span className="nav-label">Inventory</span>
        </NavLink>

        <NavLink
          to="/pos"
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <ShoppingCart size={19} className="nav-icon" />
          <span className="nav-label">POS Terminal</span>
          <span className="nav-pill-badge">Live</span>
        </NavLink>

        <NavLink
          to="/sales-history"
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <Receipt size={19} className="nav-icon" />
          <span className="nav-label">Sales History</span>
        </NavLink>
      </nav>

      {/* Delivery & Operations Section */}
      <div className="sidebar-section-label">DELIVERY & OPS</div>
      <nav className="sidebar-nav">
        <NavLink
          to="/delivery"
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <Truck size={19} className="nav-icon" />
          <span className="nav-label">Delivery</span>
        </NavLink>

        <NavLink
          to="/scanner"
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <ScanBarcode size={19} className="nav-icon" />
          <span className="nav-label">Barcode Scanner</span>
        </NavLink>

        <NavLink
          to="/reports"
          onClick={handleNavClick}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <BarChart3 size={19} className="nav-icon" />
          <span className="nav-label">Reports</span>
        </NavLink>
      </nav>

      {/* Sidebar Footer / Terminal Info */}
      <div className="sidebar-footer">
        <div className="ai-status-card">
          <div className="ai-status-header">
            <Sparkles size={16} className="ai-sparkle-icon" />
            <span className="ai-status-title">ML Predictive Engine</span>
          </div>
          <p className="ai-status-desc">Sales Demand Forecaster v1.0 (74% Acc)</p>
        </div>

        <div className="user-terminal-info">
          <div className="terminal-avatar">
            <ShieldCheck size={18} />
          </div>
          <div className="terminal-details">
            <div className="terminal-name">Lucky</div>
            <div className="terminal-role">Store Manager • Active</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;