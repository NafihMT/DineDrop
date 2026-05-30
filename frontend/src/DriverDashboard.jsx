import React, { useState, useEffect, useRef, useCallback } from 'react';
import './DriverDashboard.css';
import * as signalR from "@microsoft/signalr";

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const statusReverseMap = { 0: 'Placed', 1: 'Accepted', 2: 'Preparing', 3: 'Ready', 4: 'Picked', 5: 'Delivered', 6: 'Cancelled' };
const getStatusName = (status) => {
  if (typeof status === 'number') {
    return statusReverseMap[status] || 'Unknown';
  }
  return status;
};

const DriverDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('driver_active_tab') || 'available';
  });

  useEffect(() => {
    localStorage.setItem('driver_active_tab', activeTab);
  }, [activeTab]);
  const [restaurantGroups, setRestaurantGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expandedRestaurant, setExpandedRestaurant] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [driverPos, setDriverPos] = useState(null);       // { lat, lng }
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | loading | ok | error_permission | error_unavailable | error_timeout | denied
  const [locationError, setLocationError] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const signalrConnection = useRef(null);
  const watchIdRef = useRef(null);

  // New Driver state for active deliveries and notifications
  const [activeOrders, setActiveOrders] = useState([]);
  const [deliveringOrderId, setDeliveringOrderId] = useState(null);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const isOnlineRef = useRef(isOnline);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(2);
  const simInterval = useRef(null);

  // Toast notification system (replaces alert())
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // OTP Modal (replaces prompt())
  const [otpModal, setOtpModal] = useState({ open: false, orderId: null });
  const [otpValue, setOtpValue] = useState('');

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    fetchAvailableOrders();
    fetchActiveOrders();
    fetchAvailability();
    setupSignalR();
    startTrackingLocation();
    return () => {
      if (signalrConnection.current) signalrConnection.current.stop();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'active') {
      fetchActiveOrders();
    } else if (activeTab === 'earnings') {
      fetchDriverStats();
    }
  }, [activeTab]);

  const fetchAvailability = async () => {
    try {
      const res = await fetch('http://localhost:5070/api/driver/availability', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.isAvailable);
      }
    } catch (err) {
      console.error("Failed to fetch availability status:", err);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const res = await fetch('http://localhost:5070/api/driver/toggle-availability', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.isAvailable);
      }
    } catch (err) {
      console.error("Failed to toggle availability status:", err);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const res = await fetch('http://localhost:5070/api/driver/active-orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setActiveOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch active orders:", err);
    }
  };

  const fetchDriverStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/driver/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch driver stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const openOtpModal = (orderId) => {
    setOtpValue('');
    setOtpModal({ open: true, orderId });
  };

  const handleCompleteDelivery = async (orderId, otp) => {
    if (!otp || !otp.trim()) {
      addToast('Please enter the 4-digit OTP code.', 'error');
      return;
    }

    setDeliveringOrderId(orderId);
    setOtpModal({ open: false, orderId: null });
    try {
      const res = await fetch(`http://localhost:5070/api/driver/deliver-order/${orderId}?otp=${encodeURIComponent(otp.trim())}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (res.ok) {
        addToast('Delivery completed successfully!', 'success');
        fetchActiveOrders();
        fetchAvailableOrders(false);
      } else {
        const errData = await res.json();
        addToast(errData.message || 'Failed to complete delivery.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error completing delivery: ' + err.message, 'error');
    } finally {
      setDeliveringOrderId(null);
    }
  };

  const handleGenerateOtp = async (orderId) => {
    setDeliveringOrderId(orderId);
    try {
      const res = await fetch(`http://localhost:5070/api/driver/generate-otp/${orderId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addToast('OTP generated and sent to customer!', 'success');
        fetchActiveOrders();
      } else {
        const errData = await res.json();
        addToast(errData.message || 'Failed to generate OTP.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error generating OTP: ' + err.message, 'error');
    } finally {
      setDeliveringOrderId(null);
    }
  };

  const handlePickupOrder = async (orderId) => {
    setDeliveringOrderId(orderId);
    try {
      const res = await fetch(`http://localhost:5070/api/driver/pickup-order/${orderId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addToast('Order picked up! Head to the customer now.', 'success');
        fetchActiveOrders();
      } else {
        const text = await res.text();
        addToast(text || 'Failed to pick up order.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error picking up order: ' + err.message, 'error');
    } finally {
      setDeliveringOrderId(null);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    if (!isOnline) {
      addToast('Go Active first to accept orders.', 'error');
      return;
    }
    setAcceptingOrderId(orderId);
    try {
      const res = await fetch(`http://localhost:5070/api/driver/accept-order/${orderId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        addToast('Order accepted! Switching to active deliveries.', 'success');
        fetchAvailableOrders();
        fetchActiveOrders();
        setActiveTab('active');
      } else {
        const text = await res.text();
        addToast(text || 'Order may have been taken by another driver.', 'error');
      }
    } catch (err) {
      console.error('Failed to accept order:', err);
      addToast('Error accepting order: ' + err.message, 'error');
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const toggleSimulationMode = (enable) => {
    if (enable) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsSimulating(true);
      setLocationStatus('ok');
      if (!driverPos) {
        setDriverPos({ lat: 11.1202, lng: 76.1200 });
      }
    } else {
      if (simInterval.current) {
        clearInterval(simInterval.current);
        simInterval.current = null;
      }
      setIsSimulating(false);
      startTrackingLocation();
    }
  };

  const simulateDriving = async (startLat, startLng, endLat, endLng, completionMessage = "Transit Completed: You have arrived at the destination.") => {
    if (simInterval.current) {
      clearInterval(simInterval.current);
    }

    setDriverPos({ lat: startLat, lng: startLng });
    sendLocationToServer(startLat, startLng);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("OSRM routing request failed");
      const data = await res.json();
      
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates; // array of [lng, lat]
        if (coordinates && coordinates.length > 0) {
          let step = 0;
          simInterval.current = setInterval(() => {
            step++;
            if (step >= coordinates.length) {
              setDriverPos({ lat: endLat, lng: endLng });
              sendLocationToServer(endLat, endLng);
              clearInterval(simInterval.current);
              simInterval.current = null;
              alert(completionMessage);
            } else {
              const [lng, lat] = coordinates[step];
              setDriverPos({ lat, lng });
              sendLocationToServer(lat, lng);
            }
          }, simSpeed * 1000);
          return;
        }
      }
    } catch (err) {
      console.error("OSRM routing failed:", err);
      addToast('OSRM routing unavailable. Cannot simulate.', 'error');
    }
  };

  const startRouteSimulation = (order) => {
    if (!order) return;
    const startLat = order.restaurantLatitude || 11.1202;
    const startLng = order.restaurantLongitude || 76.1200;
    const endLat = order.customerLatitude || 11.1250;
    const endLng = order.customerLongitude || 76.1280;
    simulateDriving(startLat, startLng, endLat, endLng, "Transit Simulation Completed: The vehicle has arrived at the customer's delivery destination.");
  };

  const startTrackingLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      setLocationError('Geolocation not supported by this browser.');
      return;
    }
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setLocationStatus('loading');
    setLocationError('');

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setDriverPos(newPos);
        setLocationStatus('ok');

        // Only stream live updates to Redis if the driver is online/active
        if (isOnlineRef.current) {
          sendLocationToServer(newPos.lat, newPos.lng);
        }
      },
      err => {
        console.error("Location tracking error:", err);
        if (err.code === 1) {
          setLocationStatus('error_permission');
          setLocationError('Permission denied. Please allow location access in your browser settings.');
        } else if (err.code === 2) {
          setLocationStatus('error_unavailable');
          setLocationError('Position unavailable. Ensure device location services are enabled.');
        } else if (err.code === 3) {
          setLocationStatus('error_timeout');
          setLocationError('Location request timed out. Please try again.');
        } else {
          setLocationStatus('denied');
          setLocationError(err.message || 'Unknown location error.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    watchIdRef.current = watchId;
  };

  const sendLocationToServer = async (lat, lng) => {
    try {
      await fetch('http://localhost:5070/api/driver/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
        credentials: 'include'
      });
    } catch (err) {
      console.error("Failed to stream coordinates to Redis:", err);
    }
  };

  const setupSignalR = async () => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5070/orderHub")
      .withAutomaticReconnect()
      .build();

    connection.on("OrderStatusUpdated", () => {
      fetchAvailableOrders(false);
      fetchActiveOrders();
      fetchDriverStats();
    });

    connection.on("OrderReady", (data) => {
      if (isOnlineRef.current) {
        setNewOrderNotification({ ...data, status: 'Ready' });
        try {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
        } catch (e) {}
        fetchAvailableOrders(false);
      }
    });

    connection.on("OrderAcceptedByRestaurant", (data) => {
      if (isOnlineRef.current) {
        setNewOrderNotification({ ...data, status: 'Accepted' });
        try {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play();
        } catch (e) {}
        fetchAvailableOrders(false);
      }
    });

    try { 
      await connection.start(); 
      signalrConnection.current = connection; 
      console.log("SignalR Connected (Driver)");
    }
    catch (err) { console.error("SignalR:", err); }
  };

  const fetchAvailableOrders = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/driver/available-orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRestaurantGroups(data);
        setLastUpdated(new Date());
        if (data.length === 1) setExpandedRestaurant(data[0].restaurantId);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Attach distance and sort by proximity when we have location
  const groupsWithDistance = restaurantGroups.map(g => ({
    ...g,
    distance: driverPos ? haversine(driverPos.lat, driverPos.lng, g.latitude, g.longitude) : null
  })).sort((a, b) => {
    if (a.distance === null) return 0;
    return a.distance - b.distance;
  });

  const nearestId = groupsWithDistance.length > 0 ? groupsWithDistance[0].restaurantId : null;
  const totalOrders = restaurantGroups.reduce((s, g) => s + g.orders.length, 0);
  const totalFee = restaurantGroups.reduce((s, g) => s + g.orders.reduce((os, o) => os + o.deliveryFee, 0), 0);

  const getElapsed = (d) => {
    const diff = Math.floor((Date.now() - new Date(d)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  const locIcon = {
    idle: '📍',
    loading: '⏳',
    ok: '🟢',
    error_permission: '🔴',
    error_unavailable: '🔴',
    error_timeout: '🔴',
    denied: '🔴'
  };

  const isLocError = locationStatus.startsWith('error') || locationStatus === 'denied';

  return (
    <div className="dd-root">

      {/* ── Toast Notifications ─────────────────────── */}
      {toasts.length > 0 && (
        <div className="dd-toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`dd-toast ${t.type}`}>
              <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* ── OTP Modal ───────────────────────────────── */}
      {otpModal.open && (
        <div className="dd-modal-overlay" onClick={() => setOtpModal({ open: false, orderId: null })}>
          <div className="dd-modal" onClick={e => e.stopPropagation()}>
            <h3>Delivery Verification</h3>
            <p>Enter the 4-digit code shown on the customer's screen to confirm hand-off.</p>
            <input
              className="dd-otp-input"
              type="text" maxLength={4}
              placeholder="● ● ● ●"
              value={otpValue}
              onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && otpValue.length === 4) handleCompleteDelivery(otpModal.orderId, otpValue); }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="dd-btn dd-btn-green" style={{ flex: 1 }}
                disabled={otpValue.length !== 4}
                onClick={() => handleCompleteDelivery(otpModal.orderId, otpValue)}>
                Confirm Delivery
              </button>
              <button className="dd-btn dd-btn-ghost" style={{ flex: 0 , padding: '14px 20px'}}
                onClick={() => setOtpModal({ open: false, orderId: null })}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className="dd-sidebar">
        <div className="dd-brand">
          <h1><span>Dine</span>Drop</h1>
          <span className="dd-brand-sub">DRIVER PORTAL</span>
        </div>

        {/* Location Status */}
        <div className={`dd-loc-card ${locationStatus === 'ok' ? 'ok' : isLocError ? 'error' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <p className="dd-label" style={{ margin: 0 }}>YOUR LOCATION</p>
            <span onClick={() => toggleSimulationMode(!isSimulating)}
              style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--dd-amber)', cursor: 'pointer', opacity: 0.8 }}>
              {isSimulating ? 'Use GPS' : 'Simulate'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem' }}>{isSimulating ? '🎮' : locationStatus === 'ok' ? '●' : '○'}</span>
            <span style={{ fontSize: '0.75rem', color: locationStatus === 'ok' ? 'var(--dd-green)' : isLocError ? 'var(--dd-red)' : '#666', fontWeight: '600', wordBreak: 'break-word' }}>
              {locationStatus === 'ok' && driverPos ? `${driverPos.lat.toFixed(5)}, ${driverPos.lng.toFixed(5)}` : (locationError || 'Acquiring…')}
            </span>
          </div>
          {isSimulating && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
              {activeOrders.length > 0 ? (
                <>
                  <p className="dd-label" style={{ margin: 0, fontSize: '0.6rem' }}>ROUTE SIMULATOR</p>
                  <button className="dd-sim-btn primary" onClick={() => startRouteSimulation(activeOrders[0])}>
                    🚗 Restaurant → Customer
                  </button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="dd-sim-btn" onClick={() => { const o = activeOrders[0]; simulateDriving(driverPos?.lat||11.12, driverPos?.lng||76.12, o.restaurantLatitude, o.restaurantLongitude, "Arrived at restaurant."); }}>🏪 To Restaurant</button>
                    <button className="dd-sim-btn" onClick={() => { const o = activeOrders[0]; simulateDriving(driverPos?.lat||11.12, driverPos?.lng||76.12, o.customerLatitude, o.customerLongitude, "Arrived at customer."); }}>📍 To Customer</button>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="dd-sim-btn" style={{ fontSize: '0.6rem' }} onClick={() => { const o = activeOrders[0]; setDriverPos({ lat: o.restaurantLatitude, lng: o.restaurantLongitude }); sendLocationToServer(o.restaurantLatitude, o.restaurantLongitude); }}>⚡ Teleport Rest.</button>
                    <button className="dd-sim-btn" style={{ fontSize: '0.6rem' }} onClick={() => { const o = activeOrders[0]; setDriverPos({ lat: o.customerLatitude, lng: o.customerLongitude }); sendLocationToServer(o.customerLatitude, o.customerLongitude); }}>⚡ Teleport Cust.</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="dd-label" style={{ margin: 0, fontSize: '0.6rem' }}>MANUAL</p>
                  <button className="dd-sim-btn" onClick={() => { const lat = 11.1202+(Math.random()-0.5)*0.005; const lng = 76.12+(Math.random()-0.5)*0.005; setDriverPos({lat,lng}); sendLocationToServer(lat,lng); }}>🎲 Random move</button>
                </>
              )}
            </div>
          )}
          {isLocError && !isSimulating && (
            <button className="dd-sim-btn" style={{ marginTop: '8px', width: '100%' }} onClick={startTrackingLocation}>Retry</button>
          )}
        </div>

        {/* Duty Toggle */}
        <div className={`dd-duty-card ${isOnline ? 'online' : ''}`}>
          <div>
            <p className="dd-label" style={{ margin: '0 0 4px' }}>DUTY STATUS</p>
            <span className="dd-status-text" style={{ color: isOnline ? 'var(--dd-green)' : '#666' }}>
              <span className={`dd-status-dot ${isOnline ? 'on' : 'off'}`} />
              {isOnline ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
          <button className={`dd-toggle ${isOnline ? 'on' : 'off'}`} onClick={handleToggleStatus}>
            <div className="dd-toggle-knob" />
          </button>
        </div>

        <nav className="dd-nav">
          {[
            { id: 'available', label: 'Available Orders', badge: totalOrders },
            { id: 'active', label: 'Active Deliveries', badge: activeOrders.length },
            { id: 'earnings', label: 'Earnings', badge: null },
          ].map(item => (
            <button key={item.id} className={`dd-nav-btn ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <span className="dd-nav-icon">
                {item.id === 'available' ? '📦' : item.id === 'active' ? '🛵' : '💰'} {item.label}
              </span>
              {item.badge > 0 && <span className="dd-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <button className="dd-logout-btn" onClick={onLogout}>Sign Out</button>
      </aside>

      {/* ── Main ───────────────────────────────────────── */}
      <main className="dd-main">

        {activeTab === 'available' && (
          <div className="dd-tab-in">

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
              <div className="dd-page-header" style={{ marginBottom: 0 }}>
                <p className="dd-page-eyebrow" style={{ color: 'var(--dd-amber)' }}>LIVE FEED</p>
                <h2 className="dd-page-title">Available Orders</h2>
                <p className="dd-page-sub">
                  {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
                  {driverPos && <span style={{ marginLeft: '12px', color: 'var(--dd-green)' }}>• Nearest first</span>}
                </p>
              </div>
              <button className="dd-btn dd-btn-ghost" style={{ width: 'auto', padding: '10px 20px', fontSize: '0.82rem' }} onClick={() => fetchAvailableOrders()}>
                ↻ Refresh
              </button>
            </div>

            {/* Stats Bar */}
            <div className="dd-stats-row">
              {[
                { label: 'Ready to Pick', value: totalOrders, color: 'var(--dd-amber)' },
                { label: 'Restaurants', value: restaurantGroups.length, color: 'var(--dd-blue)' },
                { label: 'Est. Earnings', value: `₹${totalFee.toFixed(2)}`, color: 'var(--dd-green)' },
                driverPos ? { label: 'Nearest', value: groupsWithDistance[0] ? fmtDist(groupsWithDistance[0].distance) : '—', color: 'var(--dd-amber)' } : null,
              ].filter(Boolean).map(s => (
                <div key={s.label} className="dd-stat-card">
                  <p className="dd-stat-label">{s.label}</p>
                  <div className="dd-stat-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '100px 0', color: '#555' }}>
                <div className="dd-spinner" />
                <p style={{ fontWeight: '600' }}>Scanning for orders…</p>
              </div>
            ) : groupsWithDistance.length === 0 ? (
              <div className="dd-empty">
                <div className="dd-empty-icon">🛵</div>
                <h3>No Orders Ready</h3>
                <p>No restaurants have orders ready for pickup right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {groupsWithDistance.map((group, idx) => {
                  const isNearest = group.restaurantId === nearestId && driverPos;
                  const isExpanded = expandedRestaurant === group.restaurantId;

                  return (
                    <div key={group.restaurantId} className="dd-card"
                      style={{ border: isNearest ? '1px solid rgba(245,158,11,0.35)' : undefined }}>

                      {isNearest && (
                        <div className="dd-nearest-tag">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dd-amber)', display: 'inline-block' }} />
                          NEAREST TO YOU
                        </div>
                      )}

                      <div onClick={() => setExpandedRestaurant(isExpanded ? null : group.restaurantId)}
                        className="dd-card-header">

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          {/* Rank badge */}
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: idx === 0 && driverPos ? '#f39c12' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', color: idx === 0 && driverPos ? '#000' : '#555', flexShrink: 0 }}>
                            #{idx + 1}
                          </div>
                          <div className="dd-avatar" style={{ background: 'var(--dd-amber-dim)', color: 'var(--dd-amber)', border: '1px solid rgba(245,158,11,0.18)' }}>
                            {group.restaurantName.charAt(0)}
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '900', marginBottom: '3px' }}>{group.restaurantName}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <p style={{ color: '#555', fontSize: '0.82rem' }}>
                                {group.orders.length} order{group.orders.length !== 1 ? 's' : ''} ready
                              </p>
                              {group.distance !== null && (
                                <span className="dd-pill" style={{ background: group.distance < 2 ? 'var(--dd-green-dim)' : group.distance < 5 ? 'var(--dd-amber-dim)' : 'rgba(255,255,255,0.05)', color: group.distance < 2 ? 'var(--dd-green)' : group.distance < 5 ? 'var(--dd-amber)' : '#888' }}>
                                  📍 {fmtDist(group.distance)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span className="dd-pill" style={{ background: 'var(--dd-amber-dim)', color: 'var(--dd-amber)' }}>
                            {group.orders.length} READY
                          </span>
                          <span className={`dd-expand-icon ${isExpanded ? 'open' : ''}`}>▼</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="dd-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {group.orders.map(order => (
                            <div key={order.id}>
                              <div onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                style={{ padding: '16px 18px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(243,156,18,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(243,156,18,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(243,156,18,0.12)' }}>
                                    <span>📦</span>
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                      <p style={{ fontWeight: '800', fontSize: '0.92rem', margin: 0 }}>
                                        Order <span style={{ color: '#f39c12', fontFamily: 'monospace' }}>#{order.id.substring(0, 8)}</span>
                                      </p>
                                      <span style={{ 
                                        fontSize: '0.72rem', 
                                        fontWeight: '800', 
                                        color: getStatusName(order.status) === 'Ready' ? '#2ecc71' : getStatusName(order.status) === 'Preparing' ? '#9b59b6' : '#3498db', 
                                        background: getStatusName(order.status) === 'Ready' ? 'rgba(46,204,113,0.1)' : getStatusName(order.status) === 'Preparing' ? 'rgba(155,89,182,0.1)' : 'rgba(52,152,220,0.1)', 
                                        padding: '2px 8px', 
                                        borderRadius: '6px', 
                                        border: `1px solid ${getStatusName(order.status) === 'Ready' ? 'rgba(46,204,113,0.2)' : getStatusName(order.status) === 'Preparing' ? 'rgba(155,89,182,0.2)' : 'rgba(52,152,220,0.2)'}` 
                                      }}>
                                        {getStatusName(order.status)}
                                      </span>
                                    </div>
                                    <p style={{ color: '#555', fontSize: '0.78rem', margin: 0 }}>
                                      {order.customerName} • {order.items.length} item{order.items.length !== 1 ? 's' : ''} • {getElapsed(order.createdAt)}
                                    </p>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontWeight: '900', fontSize: '1rem', color: '#2ecc71' }}>₹{order.totalAmount.toFixed(2)}</p>
                                    <p style={{ color: '#555', fontSize: '0.74rem' }}>+${order.deliveryFee.toFixed(2)} fee</p>
                                  </div>
                                  <span style={{ color: '#333', transform: expandedOrder === order.id ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                                </div>
                              </div>

                              {expandedOrder === order.id && (
                                <div style={{ marginTop: '8px', padding: '18px', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.03)', animation: 'fadeIn 0.2s ease-out' }}>
                                  <p style={{ fontSize: '0.7rem', color: '#444', fontWeight: '800', letterSpacing: '1px', marginBottom: '12px' }}>ORDER ITEMS</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                    {order.items.map((item, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '9px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ width: '22px', height: '22px', background: 'rgba(243,156,18,0.12)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.7rem', color: '#f39c12' }}>{item.quantity}x</span>
                                          <span style={{ fontWeight: '600', color: '#ccc', fontSize: '0.88rem' }}>{item.dishName}</span>
                                        </div>
                                        <span style={{ color: '#777', fontWeight: '700', fontSize: '0.88rem' }}>₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                                    <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '9px', textAlign: 'center' }}>
                                      <p style={{ fontSize: '0.65rem', color: '#444', fontWeight: '700', marginBottom: '4px' }}>PLACED</p>
                                      <p style={{ fontWeight: '800', fontSize: '0.85rem' }}>{new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <div style={{ padding: '10px', background: 'rgba(46,204,113,0.06)', borderRadius: '9px', textAlign: 'center', border: '1px solid rgba(46,204,113,0.1)' }}>
                                      <p style={{ fontSize: '0.65rem', color: '#444', fontWeight: '700', marginBottom: '4px' }}>DELIVERY FEE</p>
                                      <p style={{ fontWeight: '900', color: '#2ecc71', fontSize: '1rem' }}>₹{order.deliveryFee.toFixed(2)}</p>
                                    </div>
                                    {group.distance !== null && (
                                      <div style={{ padding: '10px', background: 'rgba(243,156,18,0.06)', borderRadius: '9px', textAlign: 'center', border: '1px solid rgba(243,156,18,0.1)' }}>
                                        <p style={{ fontSize: '0.65rem', color: '#444', fontWeight: '700', marginBottom: '4px' }}>DISTANCE</p>
                                        <p style={{ fontWeight: '900', color: '#f39c12', fontSize: '1rem' }}>{fmtDist(group.distance)}</p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Accept Action Button */}
                                  <div style={{ marginTop: '16px' }}>
                                    <button
                                      disabled={acceptingOrderId !== null}
                                      onClick={() => handleAcceptOrder(order.id)}
                                      className={`dd-btn ${!isOnline ? 'dd-btn-disabled-look' : 'dd-btn-amber'}`}
                                      style={{ cursor: !isOnline ? 'not-allowed' : 'pointer' }}
                                    >
                                      {acceptingOrderId === order.id ? (
                                        <>⏳ Accepting…</>
                                      ) : !isOnline ? (
                                        <>🔒 Go Active to Accept</>
                                      ) : (
                                        <>⚡ Accept (+${order.deliveryFee.toFixed(2)})</>
                                      )}
                                    </button>
                                  </div>

                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Active Deliveries Tab ── */}
        {activeTab === 'active' && (
          <div className="dd-tab-in">
            <div className="dd-page-header">
              <p className="dd-page-eyebrow" style={{ color: 'var(--dd-green)' }}>ON THE ROAD</p>
              <h2 className="dd-page-title">Active Deliveries</h2>
              <p className="dd-page-sub">{activeOrders.length} active task{activeOrders.length !== 1 ? 's' : ''}</p>
            </div>

            {activeOrders.length === 0 ? (
              <div className="dd-empty">
                <div className="dd-empty-icon">📦</div>
                <h3>No Active Deliveries</h3>
                <p>Accept an order from the Available tab to start delivering.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {activeOrders.map(order => {
                  const orderStatus = getStatusName(order.status);
                  const isPicked = orderStatus === 'Picked';
                  return (
                    <div key={order.id} className={`dd-delivery-card ${isPicked ? 'picked' : 'assigned'}`}>
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                        <div>
                          <span className="dd-pill" style={{ background: isPicked ? 'var(--dd-green-dim)' : 'var(--dd-amber-dim)', color: isPicked ? 'var(--dd-green)' : 'var(--dd-amber)' }}>
                            {isPicked ? 'PICKED UP' : `ASSIGNED (${orderStatus.toUpperCase()})`}
                          </span>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginTop: '8px' }}>
                            Delivery <span style={{ color: 'var(--dd-amber)', fontFamily: 'monospace' }}>#{order.id.substring(0, 8)}</span>
                          </h3>
                        <p style={{ color: '#aaa', fontSize: '0.88rem', marginTop: '4px' }}>
                          Placed: {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--dd-green)' }}>₹{order.totalAmount.toFixed(2)}</p>
                          <p style={{ color: '#666', fontSize: '0.78rem', fontWeight: '700' }}>Earnings: +${order.deliveryFee.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Route / Addresses */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', background: 'rgba(0,0,0,0.15)', borderRadius: '18px', padding: '20px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '24px' }}>
                      {/* Pickup address */}
                      <div>
                        <p style={{ fontSize: '0.7rem', color: '#f39c12', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>🏪 PICKUP RESTAURANT</p>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>{order.restaurantName}</h4>
                        <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.4' }}>{order.restaurantAddress}</p>
                        {order.restaurantLatitude && order.restaurantLongitude && (
                          <p style={{ color: '#555', fontSize: '0.75rem', marginTop: '6px', fontFamily: 'monospace' }}>
                            Coord: {order.restaurantLatitude.toFixed(5)}, {order.restaurantLongitude.toFixed(5)}
                          </p>
                        )}
                      </div>

                      {/* Dropoff address */}
                      <div>
                        <p style={{ fontSize: '0.7rem', color: '#2ecc71', fontWeight: '800', letterSpacing: '1px', marginBottom: '6px' }}>📍 DROPOFF CUSTOMER</p>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>{order.customerName}</h4>
                        <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px', lineHeight: '1.4' }}>{order.customerAddress}</p>
                        {order.customerLatitude && order.customerLongitude && (
                          <p style={{ color: '#555', fontSize: '0.75rem', marginTop: '6px', fontFamily: 'monospace' }}>
                            Coord: {order.customerLatitude.toFixed(5)}, {order.customerLongitude.toFixed(5)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Items List */}
                    <div style={{ marginBottom: '24px' }}>
                      <p style={{ fontSize: '0.7rem', color: '#666', fontWeight: '800', letterSpacing: '1.2px', marginBottom: '12px' }}>ITEMS TO DELIVER</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {order.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: '700', color: '#fff' }}>
                              <span style={{ color: '#f39c12', marginRight: '6px' }}>{item.quantity}x</span> {item.dishName}
                            </span>
                            <span style={{ color: '#aaa' }}>₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Live Tracking Map */}
                    {order.restaurantLatitude && order.restaurantLongitude && order.customerLatitude && order.customerLongitude && (
                      <div style={{ marginBottom: '24px' }}>
                        <OrderTrackingMap 
                          driverLat={driverPos?.lat || 11.1202} 
                          driverLng={driverPos?.lng || 76.1200}
                          restLat={order.restaurantLatitude} 
                          restLng={order.restaurantLongitude}
                          custLat={order.customerLatitude} 
                          custLng={order.customerLongitude}
                          status={order.status}
                        />
                      </div>
                    )}
                    {orderStatus === 'Accepted' || orderStatus === 'Preparing' ? (
                      <button disabled className="dd-btn dd-btn-disabled-look">
                        ⏳ Waiting for Restaurant (Preparing)
                      </button>
                    ) : orderStatus === 'Ready' ? (
                      <button
                        disabled={deliveringOrderId === order.id}
                        onClick={() => handlePickupOrder(order.id)}
                        className="dd-btn dd-btn-amber"
                      >
                        {deliveringOrderId === order.id ? (
                          <>⏳ Processing Pickup…</>
                        ) : (
                          <>⚡ Pick Up Order</>
                        )}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                          disabled={deliveringOrderId === order.id}
                          onClick={() => handleGenerateOtp(order.id)}
                          className="dd-btn dd-btn-blue"
                        >
                          {deliveringOrderId === order.id ? (
                            <>⏳ Requesting OTP…</>
                          ) : (
                            <>🔑 Generate Delivery Verification OTP</>
                          )}
                        </button>

                        <button
                          disabled={deliveringOrderId === order.id}
                          onClick={() => openOtpModal(order.id)}
                          className="dd-btn dd-btn-green"
                        >
                          {deliveringOrderId === order.id ? (
                            <>⏳ Completing Delivery…</>
                          ) : (
                            <>✅ Confirm Delivered (Enter OTP)</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '36px' }}>
              <div>
                <h2 style={{ fontSize: '2.2rem', fontWeight: '900', margin: 0 }}>Earnings & Wallet</h2>
                <p style={{ color: '#555', fontSize: '0.95rem', marginTop: '6px' }}>
                  Track your payouts, balances, and completed deliveries.
                </p>
              </div>
              <button 
                onClick={fetchDriverStats}
                disabled={statsLoading}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#aaa',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  if (!statsLoading) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = '#aaa';
                }}
              >
                🔄 {statsLoading ? 'Refreshing...' : 'Refresh Stats'}
              </button>
            </div>

            {/* Stats Cards Grid */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '40px' }}>
              {/* Wallet Card */}
              <div className="glass" style={{ padding: '24px', borderRadius: '22px', flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>
                  💳
                </div>
                <p style={{ fontSize: '0.8rem', color: '#666', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Wallet Balance</p>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#2ecc71', margin: 0 }}>₹{stats?.walletBalance !== undefined ? stats.walletBalance.toFixed(2) : '0.00'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#444', display: 'block', marginTop: '6px' }}>Available for instant payout</span>
              </div>

              {/* Total Earnings Card */}
              <div className="glass" style={{ padding: '24px', borderRadius: '22px', flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(243,156,18,0.1)', border: '1px solid rgba(243,156,18,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>
                  💰
                </div>
                <p style={{ fontSize: '0.8rem', color: '#666', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Total Earnings</p>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#f39c12', margin: 0 }}>₹{stats?.totalEarnings !== undefined ? stats.totalEarnings.toFixed(2) : '0.00'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#444', display: 'block', marginTop: '6px' }}>Cumulative delivery income</span>
              </div>

              {/* Completed Deliveries Card */}
              <div className="glass" style={{ padding: '24px', borderRadius: '22px', flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>
                  🛵
                </div>
                <p style={{ fontSize: '0.8rem', color: '#666', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Deliveries Completed</p>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#3498db', margin: 0 }}>
                  {stats?.totalDeliveries !== undefined ? stats.totalDeliveries : 0}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#444', display: 'block', marginTop: '6px' }}>Total completed trips</span>
              </div>

              {/* Driver Rating Card */}
              <div className="glass" style={{ padding: '24px', borderRadius: '22px', flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>
                  ⭐
                </div>
                <p style={{ fontSize: '0.8rem', color: '#666', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0 0 6px 0' }}>Driver Rating</p>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', color: '#f1c40f', margin: 0 }}>
                  {stats?.rating !== undefined && stats.rating > 0 ? `${stats.rating.toFixed(1)} / 5.0` : 'New / 5.0'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#444', display: 'block', marginTop: '6px' }}>Your customer service rating</span>
              </div>
            </div>

            {/* Delivery History Section */}
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '20px' }}>Delivery History</h3>

              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(243,156,18,0.2)', borderTop: '3px solid #f39c12', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontWeight: '600' }}>Fetching history...</p>
                </div>
              ) : !stats || stats.deliveryHistory.length === 0 ? (
                <div className="glass" style={{ padding: '60px 40px', borderRadius: '24px', textAlign: 'center' }}>
                  <span style={{ fontSize: '3rem' }}>📭</span>
                  <h4 style={{ marginTop: '16px', fontSize: '1.2rem', fontWeight: '800', color: '#eee' }}>No Deliveries Yet</h4>
                  <p style={{ color: '#555', marginTop: '6px', fontSize: '0.9rem' }}>
                    Go online, accept orders, and your completed delivery details will show up here!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.deliveryHistory.map((item) => (
                    <div 
                      key={item.orderId}
                      className="glass card-hover"
                      style={{
                        padding: '18px 24px',
                        borderRadius: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                          ✅
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontWeight: '800', fontSize: '0.95rem', margin: 0 }}>
                              Order <span style={{ color: '#f39c12', fontFamily: 'monospace' }}>#{item.orderId.substring(0, 8)}</span>
                            </p>
                          </div>
                          <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                            From <strong style={{ color: '#eee' }}>{item.restaurantName}</strong> to <strong style={{ color: '#eee' }}>{item.customerName}</strong>
                          </p>
                          <span style={{ color: '#555', fontSize: '0.72rem', display: 'block', marginTop: '4px' }}>
                            Delivered at: {new Date(item.deliveredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          {item.driverRating ? (
                            <div style={{ marginTop: '8px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '10px', display: 'inline-block', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#f1c40f', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '1px' }}>
                                  {'★'.repeat(item.driverRating)}{'☆'.repeat(5 - item.driverRating)}
                                </span>
                                <span style={{ color: '#666', fontSize: '0.72rem' }}>Customer Review</span>
                              </div>
                              {item.driverFeedback && (
                                <p style={{ color: '#aaa', fontSize: '0.78rem', margin: '4px 0 0 0', fontStyle: 'italic', maxWidth: '400px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                                  "{item.driverFeedback}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#444', fontSize: '0.72rem', display: 'block', marginTop: '6px' }}>No customer feedback yet</span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ padding: '6px 12px', borderRadius: '12px', background: 'rgba(46,204,113,0.12)', color: '#2ecc71', fontWeight: '950', fontSize: '0.85rem' }}>
                          +₹{item.earnings.toFixed(2)}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#444', marginTop: '6px' }}>
                          Fee: ₹{item.earnings.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Real-Time Order Ready Notification Overlay ── */}
      {newOrderNotification && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '380px',
          background: '#0c0c0c',
          border: '1px solid rgba(243,156,18,0.4)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(243,156,18,0.15)',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '800', color: '#f39c12', letterSpacing: '1.5px' }}>
              ⚡ LIVE ORDER READY
            </span>
            <button 
              onClick={() => setNewOrderNotification(null)} 
              style={{ background: 'none', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#666'}
            >
              ×
            </button>
          </div>
          
          <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>
            Pickup from {newOrderNotification.restaurantName}
          </h3>
          
          <p style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '16px' }}>
            A new delivery request is ready for pickup! Accept now to secure the <span style={{ color: '#2ecc71', fontWeight: '800' }}>₹{newOrderNotification.deliveryFee ? newOrderNotification.deliveryFee.toFixed(2) : '5.00'}</span> fee.
          </p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => {
                handleAcceptOrder(newOrderNotification.orderId);
                setNewOrderNotification(null);
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #f39c12, #e67e22)',
                color: '#000',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.88rem',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              Accept Delivery
            </button>
            <button
              onClick={() => setNewOrderNotification(null)}
              style={{
                padding: '12px 18px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.03)',
                color: '#aaa',
                border: '1px solid rgba(255,255,255,0.05)',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── OTP Verification Modal ─────────────────── */}
      {otpModal.open && (
        <div className="dd-modal-overlay" onClick={() => setOtpModal({ open: false, orderId: null })}>
          <div className="dd-modal" onClick={e => e.stopPropagation()}>
            <h3>Verify Delivery OTP</h3>
            <p>Ask the customer for the 4-digit verification code to complete delivery.</p>
            <input
              type="text"
              maxLength={4}
              placeholder="••••"
              className="dd-otp-input"
              value={otpValue}
              onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleCompleteDelivery(otpModal.orderId, otpValue)}
                className="dd-btn dd-btn-amber"
              >
                Verify & Complete
              </button>
              <button 
                onClick={() => setOtpModal({ open: false, orderId: null })}
                className="dd-btn dd-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
