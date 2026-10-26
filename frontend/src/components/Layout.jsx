import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "./Layout.css";

function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setMobileOpen((prev) => !prev);
  };

  const closeMobileSidebar = () => {
    setMobileOpen(false);
  };

  return (
    <div className="layout">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <Sidebar 
        mobileOpen={mobileOpen} 
        onCloseMobile={closeMobileSidebar} 
      />

      <div className="main-content">
        <Topbar onToggleMobileSidebar={toggleMobileSidebar} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;