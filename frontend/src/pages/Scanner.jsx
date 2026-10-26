import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import api from "../api/api";
import { toast } from "react-toastify";
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Search,
  Truck,
  Package,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  Banknote,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import "../styles/Scanner.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Web Audio API beep synthesizer for instant feedback without external sound files
const playScanBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // 1200 Hz beep
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (err) {
    // Ignore audio context autoplay restrictions
  }
};

function Scanner() {
  const navigate = useNavigate();

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scan Results
  const [scanResult, setScanResult] = useState(null); // { type: 'DELIVERY'|'PRODUCT'|'UNKNOWN', data: ... }
  const [isLoadingLookup, setIsLoadingLookup] = useState(false);
  const [recentScans, setRecentScans] = useState([]);

  const html5QrCodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const lastScanCodeRef = useRef("");

  // Check available cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("rear") ||
              d.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError("No video cameras detected on this device.");
        }
      })
      .catch((err) => {
        console.error("Camera detection error:", err);
        setCameraError(
          "Camera access permission required. Please allow camera access in your browser or use manual entry below."
        );
      });

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async (cameraIdToUse) => {
    const camId = cameraIdToUse || selectedCameraId;
    if (!camId) {
      toast.warning("No camera selected.");
      return;
    }

    try {
      setCameraError(null);
      setIsLoadingLookup(false);

      if (html5QrCodeRef.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode("reader-viewfinder", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 200 },
        aspectRatio: 1.333334,
      };

      await html5QrCode.start(
        camId,
        config,
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Frame parsed without barcode match — normal no-op
        }
      );

      setIsScanning(true);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err) {
      console.error("Failed to start camera scanner:", err);
      setIsScanning(false);
      setCameraError(
        "Could not start camera stream. Ensure camera permissions are granted and no other application is using the camera."
      );
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error("Error stopping camera:", err);
      } finally {
        html5QrCodeRef.current = null;
        setIsScanning(false);
        setTorchOn(false);
      }
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.error("Torch error:", err);
      toast.info("Torch / Flashlight not supported on this camera.");
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    setSelectedCameraId(nextCamera.id);
    if (isScanning) {
      await stopCamera();
      await startCamera(nextCamera.id);
    }
  };

  // Dispatch barcode detection with duplicate debounce
  const handleCodeDetected = (rawCode) => {
    const code = (rawCode || "").trim();
    if (!code) return;

    // Prevent immediate repeated scans within 2.5 seconds of the same code
    const now = Date.now();
    if (
      code === lastScanCodeRef.current &&
      now - lastScanTimeRef.current < 2500
    ) {
      return;
    }

    lastScanTimeRef.current = now;
    lastScanCodeRef.current = code;

    if (soundEnabled) {
      playScanBeep();
    }

    processScannedIdentifier(code);
  };

  // Lookup the decoded string: checks delivery vs product
  const processScannedIdentifier = async (code) => {
    setIsLoadingLookup(true);

    // Track in recent scans
    setRecentScans((prev) => [
      { code, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 7),
    ]);

    try {
      // 1. Is it a Delivery tracking code (SF-DEL-... or numeric delivery ID or DEL-...)?
      const isDeliveryPattern =
        code.startsWith("SF-DEL-") ||
        code.startsWith("DEL-") ||
        code.includes("DEL") ||
        (!code.startsWith("890") && !isNaN(Number(code)) && Number(code) > 1000);

      if (isDeliveryPattern) {
        try {
          const res = await api.get(`/deliveries/track/${code}`);
          setScanResult({
            type: "DELIVERY",
            code,
            data: res.data,
          });
          toast.success(`Scanned Delivery #${res.data.tracking_number}`);
          setIsLoadingLookup(false);
          return;
        } catch (err) {
          // If delivery track failed, continue to product lookup
        }
      }

      // 2. Try looking up as a Product Barcode
      try {
        const prodRes = await api.get(`/products/barcode/${code}`);
        setScanResult({
          type: "PRODUCT",
          code,
          data: prodRes.data,
        });
        toast.success(`Scanned Product: ${prodRes.data.product_name}`);
        setIsLoadingLookup(false);
        return;
      } catch (err) {
        // If not found as barcode, try tracking as a fallback
        try {
          const delRes = await api.get(`/deliveries/track/${code}`);
          setScanResult({
            type: "DELIVERY",
            code,
            data: delRes.data,
          });
          toast.success(`Scanned Delivery #${delRes.data.tracking_number}`);
          setIsLoadingLookup(false);
          return;
        } catch (delErr) {
          // Neither found
          setScanResult({
            type: "UNKNOWN",
            code,
            data: null,
          });
          toast.warning(`No product or delivery matched '${code}'`);
        }
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setScanResult({
        type: "UNKNOWN",
        code,
        data: null,
      });
    } finally {
      setIsLoadingLookup(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.warning("Please enter a code to lookup");
      return;
    }
    processScannedIdentifier(manualCode.trim());
  };

  // Quick action: Progress status on delivery directly from scanner
  const handleQuickStatusStep = async (deliveryId, nextStatus) => {
    try {
      const res = await api.put(`/deliveries/${deliveryId}/status`, {
        status: nextStatus,
        staff_name: "Scanner Operator",
        note: `Status updated to ${nextStatus} via Camera Scanner verification.`,
      });
      toast.success(`Delivery updated to ${res.data.delivery_status}`);
      setScanResult((prev) => ({
        ...prev,
        data: res.data,
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Status transition failed");
    }
  };

  return (
    <div className="scanner-page page">
      {/* Header */}
      <div className="scanner-page-header">
        <div>
          <h2>Staff Camera Barcode & QR Scanner</h2>
          <p className="scanner-subtitle">
            Use your device camera to scan delivery package labels or product barcodes with instant verification
          </p>
        </div>

        <div className="scanner-header-actions">
          <button
            className={`btn-sound-toggle ${soundEnabled ? "active" : ""}`}
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute scan beep" : "Enable scan beep"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>{soundEnabled ? "Beep On" : "Muted"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Viewfinder, Right Results */}
      <div className="scanner-main-layout">
        {/* Left: Viewfinder Card */}
        <div className="scanner-card viewfinder-card">
          <div className="viewfinder-top-bar">
            <div className="camera-indicator">
              <span className={`cam-status-dot ${isScanning ? "live" : ""}`} />
              <span>{isScanning ? "Camera Live" : "Camera Idle"}</span>
            </div>

            <div className="camera-controls-group">
              {cameras.length > 1 && (
                <button
                  type="button"
                  className="btn-cam-control"
                  onClick={switchCamera}
                  title="Switch Front / Back Camera"
                >
                  <SwitchCamera size={16} />
                </button>
              )}

              {hasTorch && (
                <button
                  type="button"
                  className={`btn-cam-control ${torchOn ? "active" : ""}`}
                  onClick={toggleTorch}
                  title="Toggle Flashlight / Torch"
                >
                  {torchOn ? <FlashlightOff size={16} /> : <Flashlight size={16} />}
                </button>
              )}
            </div>
          </div>

          {/* Video Viewfinder Container */}
          <div className="viewfinder-frame">
            <div id="reader-viewfinder" className="reader-viewfinder-canvas" />

            {!isScanning && (
              <div className="viewfinder-idle-overlay">
                <Camera size={48} className="idle-camera-icon" />
                <h4>Camera is Stopped</h4>
                <p>Click "Start Camera Scanner" to begin scanning barcodes & QR codes</p>
                <button
                  type="button"
                  className="btn btn-primary btn-start-cam"
                  onClick={() => startCamera()}
                >
                  <Camera size={16} />
                  <span>Start Camera Scanner</span>
                </button>
              </div>
            )}

            {isScanning && (
              <div className="scanning-target-reticle">
                <div className="reticle-corner top-left" />
                <div className="reticle-corner top-right" />
                <div className="reticle-corner bottom-left" />
                <div className="reticle-corner bottom-right" />
                <div className="reticle-laser" />
              </div>
            )}
          </div>

          {/* Camera Action Buttons & Camera Selector */}
          <div className="viewfinder-bottom-controls">
            {isScanning ? (
              <button
                type="button"
                className="btn btn-danger btn-stop-cam"
                onClick={stopCamera}
              >
                <CameraOff size={16} />
                <span>Stop Camera</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startCamera()}
              >
                <Camera size={16} />
                <span>Start Camera Scanner</span>
              </button>
            )}

            {cameras.length > 1 && (
              <select
                className="camera-dropdown"
                value={selectedCameraId}
                onChange={(e) => {
                  setSelectedCameraId(e.target.value);
                  if (isScanning) {
                    stopCamera().then(() => startCamera(e.target.value));
                  }
                }}
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${c.id.substring(0, 6)}...`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {cameraError && (
            <div className="camera-error-banner">
              <AlertTriangle size={16} />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Manual Entry Fallback */}
          <div className="manual-entry-section">
            <label htmlFor="manual-code-input">
              <Barcode size={15} /> Manual SKU or Tracking Number Fallback:
            </label>
            <form onSubmit={handleManualSearch} className="manual-entry-form">
              <input
                id="manual-code-input"
                type="text"
                placeholder="Type barcode (e.g. 89010001) or tracking (SF-DEL-1015)..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary">
                <Search size={15} />
                <span>Search</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right: Scan Results & Action Card */}
        <div className="scanner-card results-card">
          <div className="results-card-header">
            <h4>Scan Identification & Verification</h4>
            {isLoadingLookup && (
              <span className="badge badge-purple">Verifying database...</span>
            )}
          </div>

          {/* Result Content */}
          <div className="scan-result-body">
            {!scanResult && !isLoadingLookup && (
              <div className="empty-scan-state">
                <Barcode size={44} className="empty-barcode-svg" />
                <h5>Ready for Input</h5>
                <p>
                  Align a product barcode or delivery label within the camera viewfinder or enter the identifier manually.
                </p>
                <div className="supported-formats-pill">
                  Supported: Delivery QR • Tracking Barcode • EAN-13 • UPC • Code 128
                </div>
              </div>
            )}

            {/* MATCH: DELIVERY ORDER */}
            {scanResult && scanResult.type === "DELIVERY" && (
              <div className="result-entity-card delivery-entity">
                <div className="entity-header">
                  <div className="entity-title-group">
                    <span className="badge badge-purple">
                      <Truck size={13} /> DELIVERY ORDER
                    </span>
                    <h3>#{scanResult.data.tracking_number}</h3>
                    <span className="order-id-meta">
                      Linked to Sale Order #{scanResult.data.sale_id}
                    </span>
                  </div>
                  <div className="entity-status-badge">
                    <span className="badge badge-info">
                      {scanResult.data.delivery_status}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="entity-details-box">
                  <div className="detail-line">
                    <span className="detail-label">Customer:</span>
                    <strong>{scanResult.data.customer_name}</strong>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Phone:</span>
                    <span>{scanResult.data.customer_phone}</span>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Address:</span>
                    <span className="address-text">{scanResult.data.delivery_address}</span>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Amount Due:</span>
                    <strong className="text-primary font-lg">
                      {formatCurrency(scanResult.data.amount_due)}
                    </strong>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Pay on Delivery:</span>
                    <span
                      className={`badge ${
                        scanResult.data.payment_status === "PAID"
                          ? "badge-success"
                          : "badge-warning"
                      }`}
                    >
                      {scanResult.data.payment_status === "PAID"
                        ? `Paid (${scanResult.data.payment_method})`
                        : `UNPAID (${scanResult.data.payment_method})`}
                    </span>
                  </div>
                </div>

                {/* Items in Package */}
                <div className="entity-items-preview">
                  <h6>Package Contents ({scanResult.data.items?.length || 0} items):</h6>
                  <div className="items-list-compact">
                    {scanResult.data.items?.map((it, idx) => (
                      <div key={idx} className="item-compact-row">
                        <span>{it.quantity}x {it.product_name}</span>
                        <span>{formatCurrency(Number(it.subtotal))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff Quick Actions on Scanned Delivery */}
                <div className="entity-actions-panel">
                  {scanResult.data.delivery_status === "PENDING" && (
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        handleQuickStatusStep(scanResult.data.delivery_id, "PREPARING")
                      }
                    >
                      <Package size={15} />
                      <span>Mark Packed & Ready</span>
                    </button>
                  )}

                  {scanResult.data.delivery_status === "PREPARING" && (
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        handleQuickStatusStep(
                          scanResult.data.delivery_id,
                          "OUT_FOR_DELIVERY"
                        )
                      }
                    >
                      <Truck size={15} />
                      <span>Dispatch (Out for Delivery)</span>
                    </button>
                  )}

                  {scanResult.data.delivery_status === "OUT_FOR_DELIVERY" && (
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        handleQuickStatusStep(scanResult.data.delivery_id, "DELIVERED")
                      }
                    >
                      <CheckCircle2 size={15} />
                      <span>Confirm Delivered</span>
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      navigate(`/delivery?tab=staff&search=${scanResult.data.tracking_number}`)
                    }
                  >
                    <span>Open in Delivery Management</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* MATCH: PRODUCT BARCODE */}
            {scanResult && scanResult.type === "PRODUCT" && (
              <div className="result-entity-card product-entity">
                <div className="entity-header">
                  <div className="entity-title-group">
                    <span className="badge badge-info">
                      <Barcode size={13} /> INVENTORY PRODUCT
                    </span>
                    <h3>{scanResult.data.product_name}</h3>
                    <span className="order-id-meta">
                      Barcode: <code>{scanResult.data.barcode}</code>
                    </span>
                  </div>
                  <div className="entity-price-large">
                    {formatCurrency(Number(scanResult.data.selling_price))}
                  </div>
                </div>

                <div className="entity-details-box">
                  <div className="detail-line">
                    <span className="detail-label">Category:</span>
                    <span>{scanResult.data.category}</span>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Current Stock:</span>
                    <strong
                      className={
                        scanResult.data.stock <= scanResult.data.min_stock
                          ? "text-warning"
                          : "text-success"
                      }
                    >
                      {scanResult.data.stock} units available
                    </strong>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Cost Price:</span>
                    <span>{formatCurrency(Number(scanResult.data.buying_price))}</span>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Reorder Alert:</span>
                    <span>At {scanResult.data.min_stock} units</span>
                  </div>
                </div>

                <div className="entity-actions-panel">
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/pos`)}
                  >
                    <ShoppingCart size={15} />
                    <span>Open in POS Terminal</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      navigate(`/inventory?search=${scanResult.data.barcode}`)
                    }
                  >
                    <span>View in Catalog</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* UNKNOWN CODE */}
            {scanResult && scanResult.type === "UNKNOWN" && (
              <div className="result-entity-card unknown-entity">
                <div className="unknown-icon-wrapper">
                  <AlertTriangle size={36} className="text-warning" />
                </div>
                <h4>Unrecognized Code: "{scanResult.code}"</h4>
                <p>
                  This identifier does not match any registered product barcode or delivery tracking record in the system.
                </p>
                <div className="unknown-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setScanResult(null)}
                  >
                    Clear & Scan Again
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate("/inventory")}
                  >
                    Register as New Product
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Scans Session Strip */}
          {recentScans.length > 0 && (
            <div className="recent-scans-strip">
              <span className="recent-scans-label">Recent Scans:</span>
              <div className="recent-scans-pills">
                {recentScans.map((sc, i) => (
                  <button
                    key={i}
                    type="button"
                    className="recent-scan-pill"
                    onClick={() => processScannedIdentifier(sc.code)}
                  >
                    <code>{sc.code}</code>
                    <span className="time-sub">{sc.timestamp}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Scanner;
