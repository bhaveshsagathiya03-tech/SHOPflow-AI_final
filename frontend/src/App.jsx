import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import POS from "./pages/POS";
import SalesHistory from "./pages/SalesHistory";
import Delivery from "./pages/Delivery";
import Scanner from "./pages/Scanner";
import Reports from "./pages/Reports";

import Layout from "./components/Layout";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/sales-history" element={<SalesHistory />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/track/:trackingNumber" element={<Delivery />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;