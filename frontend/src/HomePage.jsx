import React, { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import * as signalR from "@microsoft/signalr";
import LocationPicker from './LocationPicker';

const HomePage = ({ onLogout }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse'); // browse, history, tracking
  const [myOrders, setMyOrders] = useState([]);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orderNotification, setOrderNotification] = useState(null);
  const trackingOrderRef = useRef(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const signalrConnection = useRef(null);

  useEffect(() => {
    setVisibleCount(6);
  }, [selectedCategory, nearbyOnly, userLocation]);

  const [profileData, setProfileData] = useState({
    name: 'Customer',
    email: 'customer@gmail.com',
    phone: '',
    walletBalance: 0.00,
    addresses: []
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({
    addressLine: '',
    city: '',
    state: '',
    pincode: '',
    latitude: 11.1202,
    longitude: 76.1200,
    isDefault: false
  });
  const [editingAddressId, setEditingAddressId] = useState(null);

  const [showMap, setShowMap] = useState(false);
  const [searchLocationText, setSearchLocationText] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const handleLocateMe = () => {
    setShowMap(!showMap);
    if (!showMap && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setNearbyOnly(true);
      });
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchLocationText.length > 2) {
        setIsSearchingLocation(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchLocationText)}&limit=5&accept-language=en`);
          const data = await response.json();
          setLocationSuggestions(data || []);
        } catch (err) {
          console.error("Failed to fetch suggestions", err);
        } finally {
          setIsSearchingLocation(false);
        }
      } else {
        setLocationSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchLocationText]);

  const selectLocation = (lat, lon, displayName) => {
    setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lon) });
    setNearbyOnly(true);
    setShowMap(false);
    setSearchLocationText('');
    setLocationSuggestions([]);
  };

  useEffect(() => {
    trackingOrderRef.current = trackingOrder;
  }, [trackingOrder]);

  useEffect(() => {
    fetchRestaurants();
    fetchMyOrders();
    fetchProfile();
    setupSignalR();
    return () => {
      if (signalrConnection.current) signalrConnection.current.stop();
    };
  }, []);

  const setupSignalR = async () => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5070/orderHub")
      .withAutomaticReconnect()
      .build();

    connection.on("OrderStatusUpdated", (data) => {
      // Update tracking state if this is the order we are watching
      setTrackingOrder(prev => {
        if (prev && prev.id === data.orderId) {
          return { ...prev, status: data.newStatus };
        }
        return prev;
      });
      // Refresh history list and profile (wallet balance)
      fetchMyOrders(false);
      fetchProfile();
      
      // Show notification
      setOrderNotification({
        orderId: data.orderId,
        restaurantName: data.restaurantName || "Restaurant",
        status: data.newStatus
      });

      // Auto-hide after 10 seconds
      setTimeout(() => setOrderNotification(null), 10000);
    });

    connection.on("RestaurantProfileUpdated", () => {
      fetchRestaurants();
    });

    try {
      await connection.start();
      console.log("SignalR Connected (User)");
      signalrConnection.current = connection;
    } catch (err) {
      console.error("SignalR Connection Error:", err);
    }
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5070/api/user/restaurants?t=${new Date().getTime()}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusReverseMap = { 0: 'Placed', 1: 'Accepted', 2: 'Preparing', 3: 'Ready', 4: 'Picked', 5: 'Delivered', 6: 'Cancelled' };

  const fetchMyOrders = async (autoSwitch = true) => {
    try {
      const response = await fetch('http://localhost:5070/api/customer/orders/my-orders', { credentials: 'include' });
      if (response.ok) {
        let data = await response.json();
        data = data.map(o => ({ ...o, status: typeof o.status === 'number' ? statusReverseMap[o.status] : o.status }));
        setMyOrders(data);
        
        // If we aren't currently tracking an order, restore it (but don't necessarily switch tab)
        if (!trackingOrderRef.current) {
          const activeOrder = data.find(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
          if (activeOrder) {
            fetchOrderDetails(activeOrder.id, autoSwitch);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenu = async (restaurant) => {
    setSelectedRestaurant(restaurant);
    setMenu([]);
    setCart([]);
    try {
      const response = await fetch(`http://localhost:5070/api/user/restaurants/${restaurant.id}/menu`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMenu(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/user/profile', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
        if (data.addresses && data.addresses.length > 0 && !selectedDeliveryAddress) {
          setSelectedDeliveryAddress(data.addresses[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileData.name, phone: profileData.phone }),
        credentials: 'include'
      });
      if (response.ok) {
        setIsEditingProfile(false);
        fetchProfile();
      }
    } catch (err) {
      alert("Error saving profile: " + err.message);
    }
  };

  const handleLocationPick = async (lat, lng) => {
    setNewAddress(prev => ({ ...prev, latitude: lat, longitude: lng }));
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.suburb || addr.neighbourhood || '';
          const city = addr.city || addr.town || addr.village || addr.county || '';
          const state = addr.state || '';
          const pincode = addr.postcode || '';

          setNewAddress(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            addressLine: road ? road : prev.addressLine,
            city: city ? city : prev.city,
            state: state ? state : prev.state,
            pincode: pincode ? pincode : prev.pincode
          }));
        }
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  const startEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setNewAddress({
      addressLine: addr.addressLine || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      latitude: addr.latitude || 11.1202,
      longitude: addr.longitude || 76.1200,
      isDefault: addr.isDefault || false
    });
    setShowAddAddressModal(true);
  };

  const handleSaveAddress = async () => {
    if (!newAddress.addressLine || !newAddress.city) {
      alert("Please enter address line and city");
      return;
    }
    const url = editingAddressId 
      ? `http://localhost:5070/api/user/addresses/${editingAddressId}`
      : 'http://localhost:5070/api/user/addresses';
    const method = editingAddressId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAddress),
        credentials: 'include'
      });
      if (response.ok) {
        setShowAddAddressModal(false);
        setEditingAddressId(null);
        setNewAddress({ addressLine: '', city: '', state: '', pincode: '', latitude: 11.1202, longitude: 76.1200, isDefault: false });
        fetchProfile();
      } else {
        const err = await response.json();
        alert(err.message || "Failed to save address");
      }
    } catch (err) {
      alert("Error saving address: " + err.message);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Delete this address?")) return;
    try {
      const response = await fetch(`http://localhost:5070/api/user/addresses/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        fetchProfile();
      }
    } catch (err) {
      alert("Error deleting address: " + err.message);
    }
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order? Your refund will be credited to your DineDrop wallet.")) return;
    try {
      const response = await fetch(`http://localhost:5070/api/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        alert("Order cancelled successfully. Refund has been added to your wallet.");
        fetchMyOrders();
        fetchOrderDetails(orderId, false);
        fetchProfile();
      } else {
        const error = await response.json();
        alert(error.message || "Failed to cancel order");
      }
    } catch (err) {
      alert("Error cancelling order: " + err.message);
    }
  };

  const handleAddFunds = async (amount) => {
    try {
      const response = await fetch('http://localhost:5070/api/user/wallet/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchProfile();
      } else {
        const error = await response.json();
        alert(error.message || "Failed to add funds");
      }
    } catch (err) {
      alert("Error adding funds: " + err.message);
    }
  };

  const fetchOrderDetails = async (orderId, switchToTab = true) => {
    try {
      const response = await fetch(`http://localhost:5070/api/customer/orders/${orderId}`, { credentials: 'include' });
      if (response.ok) {
        let data = await response.json();
        data.status = typeof data.status === 'number' ? statusReverseMap[data.status] : data.status;
        setTrackingOrder(data);
        if (switchToTab) {
          setActiveTab('history');
        }
        
        // Join SignalR group for this order
        if (signalrConnection.current) {
          await signalrConnection.current.invoke("JoinOrderGroup", orderId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = (item, dishContext = null) => {
    // If adding from global search (dishContext provided)
    if (dishContext) {
      if (selectedRestaurant && selectedRestaurant.id !== dishContext.id) {
        if (!window.confirm(`Your tray has items from ${selectedRestaurant.name}. Clear tray and start new order from ${dishContext.name}?`)) {
          return;
        }
        setCart([]);
      }
      setSelectedRestaurant(dishContext);
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!selectedDeliveryAddress) {
      alert("Please select or add a delivery address first.");
      return;
    }
    const addressObj = profileData?.addresses?.find(a => a.id === selectedDeliveryAddress);
    if (addressObj && selectedRestaurant) {
      const dist = getDistanceFromLatLonInKm(selectedRestaurant.latitude, selectedRestaurant.longitude, addressObj.latitude, addressObj.longitude);
      if (dist > 30) {
        alert(`Delivery address (${addressObj.addressLine}) is ${dist.toFixed(1)} km away from ${selectedRestaurant.name}. We only deliver within a 30 km radius.`);
        return;
      }
    }
    setIsPlacingOrder(true);
    try {
      const orderDto = {
        restaurantId: selectedRestaurant.id,
        addressId: selectedDeliveryAddress,
        items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity }))
      };

      const response = await fetch('http://localhost:5070/api/customer/orders/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDto),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setCart([]);
        setSelectedRestaurant(null);
        fetchMyOrders(false);
        fetchOrderDetails(data.orderId);
        fetchProfile();
      } else {
        const err = await response.json();
        alert(err.message || "Failed to place order.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Placed': return '#f39c12';
      case 'Accepted': return '#3498db';
      case 'Preparing': return '#9b59b6';
      case 'Ready': return '#2ecc71';
      case 'Picked': return '#16a085';
      case 'Delivered': return '#7f8c8d';
      default: return '#fff';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'Outfit, sans-serif', display: 'flex' }}>
      {/* Notification Overlay */}
      {orderNotification && (
        <div 
          onClick={() => {
            fetchOrderDetails(orderNotification.orderId, true);
            setOrderNotification(null);
          }}
          className="glass card" 
          style={{ 
            position: 'fixed', top: '24px', right: '24px', zIndex: 10000, 
            padding: '20px 32px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px', 
            border: '1px solid rgba(0, 243, 255, 0.3)', cursor: 'pointer',
            animation: 'slideInRight 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(30px)'
          }}
        >
          <div className="pulse" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 243, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #00f3ff' }}>
            <span style={{ fontSize: '1.2rem' }}>📦</span>
          </div>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '4px' }}>Order Update!</h4>
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Your order from <strong style={{ color: '#fff' }}>{orderNotification.restaurantName}</strong> is now <strong style={{ color: '#00f3ff' }}>{orderNotification.status}</strong>.</p>
            <p style={{ color: '#00f3ff', fontSize: '0.75rem', fontWeight: '700', marginTop: '4px' }}>CLICK TO TRACK →</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setOrderNotification(null); }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '20px' }}>✕</button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); }
        .neon-btn { background: #00f3ff; color: #000; box-shadow: 0 0 20px rgba(0, 243, 255, 0.3); border: none; cursor: pointer; transition: all 0.3s; }
        .neon-btn:hover { transform: translateY(-2px); box-shadow: 0 0 30px rgba(0, 243, 255, 0.5); }
        .card:hover { transform: translateY(-5px); border-color: rgba(0, 243, 255, 0.3); }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        .pulse { animation: pulse 2s infinite ease-in-out; }
      `}</style>

      {/* Sidebar Navigation */}
      <aside style={{ width: '280px', height: '100vh', borderRight: '1px solid rgba(255,255,255,0.05)', position: 'fixed', padding: '40px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '60px', padding: '0 20px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#00f3ff' }}>Dine</span>Drop
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {[
            { id: 'browse', icon: '🍽️', label: 'Browse' },
            { id: 'history', icon: '📜', label: 'History' },
            { id: 'profile', icon: '👤', label: 'Profile' }
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setTrackingOrder(null); if (item.id === 'profile') fetchProfile(); }} style={{
              display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 20px', borderRadius: '16px', border: 'none',
              background: activeTab === item.id ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
              color: activeTab === item.id ? '#00f3ff' : '#888',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
            }}>
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>

        <button onClick={onLogout} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,0,0,0.05)', color: '#ff4d4d', border: '1px solid rgba(255,0,0,0.1)', fontWeight: '700', cursor: 'pointer' }}>Logout</button>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: '280px', flex: 1, padding: '60px 80px' }}>
        
        {activeTab === 'browse' && (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {!selectedRestaurant ? (
              <>
                {/* Hero Banner: Top Deals */}
                <div style={{ background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.2), rgba(0,0,0,0))', borderRadius: '32px', padding: '40px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(0, 243, 255, 0.1)' }}>
                  <div>
                    <span style={{ padding: '6px 12px', background: '#ff4d4d', color: '#fff', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '1px', display: 'inline-block', marginBottom: '16px' }}>LIMITED TIME OFFER</span>
                    <h2 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '16px', lineHeight: '1.1' }}>50% OFF<br/>First Order</h2>
                    <p style={{ color: '#aaa', fontSize: '1.1rem', marginBottom: '24px', maxWidth: '400px' }}>Dive into premium dining with our exclusive introductory offer. Use code DINE50 at checkout.</p>
                    <button className="neon-btn" style={{ padding: '16px 32px', borderRadius: '16px', fontWeight: '800', fontSize: '1rem', letterSpacing: '1px' }}>CLAIM DEAL</button>
                  </div>
                  <div style={{ fontSize: '10rem', opacity: 0.8, transform: 'rotate(15deg)' }}>🍔</div>
                </div>

                {/* Categories */}
                <div style={{ marginBottom: '48px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Categories</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {[
                      { id: 'pizza', name: 'Pizza', icon: '🍕' },
                      { id: 'burger', name: 'Burger', icon: '🍔' },
                      { id: 'sushi', name: 'Sushi', icon: '🍣' },
                      { id: 'healthy', name: 'Healthy', icon: '🥗' },
                      { id: 'dessert', name: 'Dessert', icon: '🍩' },
                      { id: 'coffee', name: 'Coffee', icon: '☕' }
                    ].map(cat => (
                      <div key={cat.id} onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)} className="glass" style={{ minWidth: '120px', padding: '24px 16px', borderRadius: '24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s', background: selectedCategory === cat.id ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)', borderColor: selectedCategory === cat.id ? 'rgba(0, 243, 255, 0.5)' : 'rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{cat.icon}</div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: selectedCategory === cat.id ? '#00f3ff' : '#fff' }}>{cat.name}</h4>
                      </div>
                    ))}
                  </div>
                </div>


                <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px' }}>
                      {selectedCategory ? 'Category Results' : 'All Restaurants'}
                    </h2>
                    <p style={{ color: '#888' }}>Find the best meals from your favorite local spots.</p>
                  </div>
                  <button onClick={handleLocateMe} style={{ padding: '12px 24px', borderRadius: '16px', background: nearbyOnly ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255,255,255,0.05)', color: nearbyOnly ? '#00f3ff' : '#fff', border: `1px solid ${nearbyOnly ? '#00f3ff' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📍 {nearbyOnly ? 'Location Set (30km)' : 'Set Location'}
                  </button>
                </header>

                {showMap && (
                  <div className="glass" style={{ marginBottom: '32px', animation: 'fadeIn 0.3s ease-out', padding: '24px', borderRadius: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Set Delivery Location</h3>
                      {userLocation && (
                        <button onClick={() => { setNearbyOnly(false); setUserLocation(null); setShowMap(false); }} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>CLEAR LOCATION</button>
                      )}
                    </div>
                    
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                          type="text" 
                          value={searchLocationText}
                          onChange={(e) => setSearchLocationText(e.target.value)}
                          placeholder="Search for a city or address..." 
                          style={{ flex: 1, padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} 
                        />
                      </div>
                      
                      {/* Suggestions Dropdown */}
                      {locationSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '5px', background: '#111', border: '1px solid rgba(0, 243, 255, 0.2)', borderRadius: '12px', zIndex: 1000, overflow: 'hidden' }}>
                          {locationSuggestions.map((suggestion, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => selectLocation(suggestion.lat, suggestion.lon, suggestion.display_name)}
                              style={{ padding: '12px 16px', borderBottom: idx < locationSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 243, 255, 0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span>📍</span>
                              <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{suggestion.display_name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '10px' }}>Or click on the map to set your exact location</p>
                    <LocationPicker 
                      lat={userLocation?.lat} 
                      lng={userLocation?.lng} 
                      onLocationSelect={(lat, lng) => {
                        setUserLocation({ lat, lng });
                        setNearbyOnly(true);
                      }}
                    />
                  </div>
                )}

                {(() => {
                  const filteredList = restaurants
                    .filter(r => selectedCategory ? (r.description && r.description.toLowerCase().includes(selectedCategory)) : true)
                    .filter(r => {
                      if (!nearbyOnly || !userLocation) return true;
                      const dist = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, r.latitude, r.longitude);
                      return dist <= 30;
                    });

                  if (filteredList.length === 0) {
                    return (
                      <div className="glass" style={{ padding: '80px', borderRadius: '32px', textAlign: 'center' }}>
                        <span style={{ fontSize: '4rem' }}>🍽️</span>
                        <h3 style={{ marginTop: '24px', fontSize: '1.8rem', color: '#fff', fontWeight: '800' }}>No restaurant available</h3>
                        <p style={{ color: '#888', marginTop: '8px', fontSize: '1rem' }}>There are no restaurants delivering within 30km of your selected location or category.</p>
                      </div>
                    );
                  }

                  const displayedList = filteredList.slice(0, visibleCount);

                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' }}>
                        {displayedList.map(res => (
                          <div key={res.id} onClick={() => fetchMenu(res)} className="glass card" style={{ borderRadius: '24px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s' }}>
                            <div style={{ height: '200px', background: 'linear-gradient(45deg, #111, #222)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>
                              {res.name.charAt(0)}
                            </div>
                            <div style={{ padding: '24px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <h3 style={{ fontSize: '1.3rem', fontWeight: '800' }}>{res.name}</h3>
                                <span style={{ color: '#f1c40f', fontWeight: '700' }}>⭐ {res.rating.toFixed(1)}</span>
                              </div>
                              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '20px' }}>{res.description}</p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ padding: '4px 12px', borderRadius: '20px', background: res.isOpen ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.05)', color: res.isOpen ? '#2ecc71' : '#666', fontSize: '0.8rem', fontWeight: '700' }}>
                                  {res.isOpen ? 'OPEN NOW' : 'CLOSED'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {visibleCount < filteredList.length && (
                        <div style={{ textAlign: 'center', marginTop: '48px' }}>
                          <button 
                            onClick={() => setVisibleCount(prev => prev + 6)}
                            style={{ 
                              padding: '16px 36px', 
                              borderRadius: '20px', 
                              background: 'rgba(0, 243, 255, 0.1)', 
                              color: '#00f3ff', 
                              border: '1px solid rgba(0, 243, 255, 0.3)', 
                              cursor: 'pointer', 
                              fontWeight: '800', 
                              fontSize: '1rem',
                              letterSpacing: '1px',
                              boxShadow: '0 0 20px rgba(0, 243, 255, 0.15)',
                              transition: 'all 0.3s'
                            }}
                          >
                            LOAD MORE RESTAURANTS ↓
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <button onClick={() => setSelectedRestaurant(null)} style={{ background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', marginBottom: '32px', fontWeight: '600' }}>← BACK TO EXPLORE</button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '60px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Menu</h3>
                      <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{menu.length} items available</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {menu.map(item => (
                        <div key={item.id} className="glass" style={{ display: 'flex', gap: '24px', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ width: '120px', height: '120px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.imageUrl ? (
                              <img src={`http://localhost:5070${item.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '2.5rem' }}>🍔</span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h4 style={{ fontSize: '1.3rem', fontWeight: '800' }}>{item.name}</h4>
                              <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#00f3ff' }}>${item.price.toFixed(2)}</span>
                            </div>
                            <p style={{ color: '#888', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '16px' }}>{item.description}</p>
                            <button onClick={() => addToCart(item)} className="neon-btn" style={{ padding: '8px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '0.85rem' }}>+ ADD TO TRAY</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cart */}
                  <div className="glass" style={{ padding: '40px', borderRadius: '32px', height: 'fit-content', position: 'sticky', top: '60px' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '32px' }}>Your Tray</h3>
                    {cart.length === 0 ? (
                      <p style={{ color: '#666', textAlign: 'center', padding: '40px 0' }}>Hungry? Add something delicious.</p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                          {cart.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ fontWeight: '600' }}>{item.quantity}x {item.name}</p>
                                <p style={{ fontSize: '0.8rem', color: '#666' }}>${item.price.toFixed(2)} ea</p>
                              </div>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <span style={{ fontWeight: '800' }}>${(item.price * item.quantity).toFixed(2)}</span>
                                <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px', marginBottom: '32px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#888', marginBottom: '12px' }}>
                            <span>Subtotal</span>
                            <span>${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#888', marginBottom: '20px' }}>
                            <span>Delivery Fee</span>
                            <span>$5.00</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '800', marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                            <span>Total</span>
                            <span style={{ color: '#00f3ff' }}>${(cart.reduce((sum, i) => sum + (i.price * i.quantity), 0) + 5).toFixed(2)}</span>
                          </div>

                          <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '8px', fontWeight: '700' }}>DELIVERY ADDRESS</label>
                            {profileData.addresses && profileData.addresses.length > 0 ? (
                              <select 
                                value={selectedDeliveryAddress || ''} 
                                onChange={e => setSelectedDeliveryAddress(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                              >
                                {profileData.addresses.map(addr => (
                                  <option key={addr.id} value={addr.id} style={{ background: '#111', color: '#fff' }}>
                                    {addr.addressLine}, {addr.city}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button 
                                onClick={() => { setShowAddAddressModal(true); setActiveTab('profile'); }}
                                className="neon-btn"
                                style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700' }}
                              >
                                + ADD DELIVERY ADDRESS
                              </button>
                            )}
                          </div>
                        </div>
                        <button onClick={handlePlaceOrder} disabled={isPlacingOrder || !selectedDeliveryAddress} className="neon-btn" style={{ width: '100%', padding: '20px', borderRadius: '16px', fontWeight: '800', fontSize: '1rem', letterSpacing: '1px' }}>
                          {isPlacingOrder ? 'TRANSMITTING...' : 'PLACE ORDER'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {!trackingOrder ? (
              <>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '40px' }}>Order History</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {myOrders.length === 0 ? (
                    <div className="glass" style={{ padding: '80px', borderRadius: '32px', textAlign: 'center' }}>
                      <span style={{ fontSize: '4rem' }}>📜</span>
                      <h3 style={{ marginTop: '24px', color: '#666', fontWeight: '700' }}>No orders found</h3>
                      <p style={{ color: '#888', marginTop: '8px' }}>Looks like you haven't placed any orders yet.</p>
                    </div>
                  ) : (
                    myOrders.map(order => (
                      <div key={order.id} className="glass" style={{ padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{order.restaurantName}</h4>
                          <p style={{ color: '#666', fontSize: '0.85rem' }}>{new Date(order.createdAt).toLocaleDateString()} • {order.itemCount} items</p>
                        </div>
                        <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: '800' }}>${order.totalAmount.toFixed(2)}</p>
                            <span style={{ color: getStatusColor(order.status), fontSize: '0.8rem', fontWeight: '800', letterSpacing: '1px' }}>{order.status.toUpperCase()}</span>
                          </div>
                          <button onClick={() => fetchOrderDetails(order.id)} style={{ padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: '600' }}>Details</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div style={{ maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
                <button onClick={() => setTrackingOrder(null)} style={{ background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', marginBottom: '32px', fontWeight: '600' }}>← BACK TO HISTORY</button>
                <header style={{ textAlign: 'center', marginBottom: '60px' }}>
                  <div className="pulse" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 243, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid #00f3ff' }}>
                    <span style={{ fontSize: '2rem' }}>🛰️</span>
                  </div>
                  <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Tracking Order <span style={{ color: '#00f3ff' }}>#{trackingOrder.id.substring(0, 8)}</span></h2>
                  <p style={{ color: '#888' }}>Live from {trackingOrder.restaurantName}</p>
                </header>

                <div className="glass" style={{ padding: '60px', borderRadius: '32px', position: 'relative' }}>
                  {trackingOrder.status === 'Cancelled' ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255, 77, 77, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid #ff4d4d' }}>
                        <span style={{ fontSize: '2rem' }}>❌</span>
                      </div>
                      <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ff4d4d', marginBottom: '8px' }}>Order Cancelled</h3>
                      <p style={{ color: '#aaa' }}>This order was cancelled and will not be delivered.</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        {['Placed', 'Accepted', 'Preparing', 'Ready', 'Delivered'].map((step, i) => {
                          const steps = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Delivered'];
                          const currentIndex = steps.indexOf(trackingOrder.status);
                          const stepIndex = steps.indexOf(step);
                          const isCompleted = stepIndex <= currentIndex;
                          const isCurrent = stepIndex === currentIndex;

                          return (
                            <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', flex: 1 }}>
                              <div style={{ 
                                width: '40px', height: '40px', borderRadius: '50%', 
                                background: isCompleted ? '#00f3ff' : 'rgba(255,255,255,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isCompleted ? '#000' : '#444', fontWeight: '800',
                                boxShadow: isCurrent ? '0 0 20px rgba(0, 243, 255, 0.5)' : 'none'
                              }}>
                                {isCompleted ? '✓' : i + 1}
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isCompleted ? '#00f3ff' : '#444', letterSpacing: '0.5px' }}>{step.toUpperCase()}</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Progress Line */}
                      <div style={{ position: 'absolute', top: '80px', left: '100px', right: '100px', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 1 }}></div>
                    </>
                  )}
                </div>

                <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="glass" style={{ padding: '30px', borderRadius: '24px' }}>
                    <h4 style={{ marginBottom: '20px', color: '#666', fontWeight: '700' }}>ORDER SUMMARY</h4>
                    {trackingOrder.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span>{item.quantity}x {item.dishName}</span>
                        <span style={{ fontWeight: '700' }}>${(item.quantity * item.unitPrice).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '20px', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '10px' }}>
                      <span>Subtotal</span>
                      <span>${(trackingOrder.totalAmount - (trackingOrder.deliveryFee || 5)).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '20px' }}>
                      <span>Delivery Fee</span>
                      <span>${(trackingOrder.deliveryFee || 5).toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '800', marginBottom: trackingOrder.status === 'Placed' ? '20px' : '0' }}>
                      <span>Total</span>
                      <span style={{ color: '#00f3ff' }}>${trackingOrder.totalAmount.toFixed(2)}</span>
                    </div>
                    {trackingOrder.status === 'Placed' && (
                      <button 
                        onClick={() => cancelOrder(trackingOrder.id)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,77,77,0.1)', border: '1px solid #ff4d4d', color: '#ff4d4d', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        CANCEL ORDER
                      </button>
                    )}
                  </div>
                  <div className="glass" style={{ padding: '30px', borderRadius: '24px' }}>
                    <h4 style={{ marginBottom: '20px', color: '#666', fontWeight: '700' }}>DELIVERY TO</h4>
                    <p style={{ fontWeight: '600' }}>{trackingOrder.customerName || 'Customer'}</p>
                    <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>Your pinned address in the system.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '40px' }}>Your Profile</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              {/* Personal Info */}
              <div className="glass" style={{ padding: '30px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: '800' }}>Personal Info</h3>
                  {isEditingProfile ? (
                    <button onClick={handleSaveProfile} style={{ background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', fontWeight: '700' }}>SAVE</button>
                  ) : (
                    <button onClick={() => setIsEditingProfile(true)} style={{ background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', fontWeight: '700' }}>EDIT</button>
                  )}
                </div>
                
                {isEditingProfile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px', display: 'block' }}>Name</label>
                      <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px', display: 'block' }}>Email (Read-only)</label>
                      <input type="email" disabled value={profileData.email} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#888' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px', display: 'block' }}>Phone</label>
                      <input type="text" value={profileData.phone} placeholder="e.g. +1 234 567 8900" onChange={e => setProfileData({...profileData, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: '#ccc' }}>
                    <p><strong style={{ color: '#fff' }}>Name:</strong> {profileData.name}</p>
                    <p><strong style={{ color: '#fff' }}>Email:</strong> {profileData.email}</p>
                    <p><strong style={{ color: '#fff' }}>Phone:</strong> {profileData.phone || 'Not set'}</p>
                  </div>
                )}
              </div>

              {/* Wallet */}
              <div className="glass" style={{ padding: '30px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(0,0,0,0))', border: '1px solid rgba(46, 204, 113, 0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#2ecc71' }}>DineDrop Wallet</h3>
                    <button onClick={() => handleAddFunds(50)} style={{ padding: '6px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: '1px solid #2ecc71', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>+ ADD $50</button>
                  </div>
                  <p style={{ color: '#888', marginBottom: '10px' }}>Available Balance</p>
                  <h1 style={{ fontSize: '3.5rem', fontWeight: '900', color: '#fff' }}>${(profileData.walletBalance || 0).toFixed(2)}</h1>
                </div>
                <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '20px' }}>Refunds from cancelled orders are automatically credited here.</p>
              </div>
            </div>

            {/* Addresses */}
            <div className="glass" style={{ padding: '30px', borderRadius: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '800' }}>Delivery Addresses</h3>
                <button onClick={() => { setEditingAddressId(null); setNewAddress({ addressLine: '', city: '', state: '', pincode: '', latitude: 11.1202, longitude: 76.1200, isDefault: false }); setShowAddAddressModal(true); }} className="neon-btn" style={{ padding: '8px 16px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem' }}>+ ADD NEW</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {profileData.addresses && profileData.addresses.length === 0 ? (
                  <p style={{ color: '#666', textAlign: 'center', padding: '20px 0' }}>No saved addresses. Add one to speed up checkout.</p>
                ) : (
                  profileData.addresses.map(addr => (
                    <div key={addr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '1.5rem' }}>📍</span>
                        <div>
                          <p style={{ fontWeight: '600' }}>{addr.addressLine}</p>
                          <p style={{ fontSize: '0.85rem', color: '#888' }}>{addr.city}, {addr.state} {addr.pincode}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <button onClick={() => startEditAddress(addr)} style={{ background: 'none', border: 'none', color: '#00f3ff', cursor: 'pointer', fontWeight: '700' }}>Edit</button>
                        <button onClick={() => handleDeleteAddress(addr.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontWeight: '700' }}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add/Edit Address Modal */}
            {showAddAddressModal && (
              <div onClick={() => setShowAddAddressModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={e => e.stopPropagation()} className="glass card" style={{ width: '500px', maxWidth: '90%', padding: '40px', borderRadius: '32px', background: '#0a0a0a', border: '1px solid rgba(0, 243, 255, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{editingAddressId ? 'Edit Delivery Address' : 'Add Delivery Address'}</h3>
                    <button onClick={() => setShowAddAddressModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Address Line / Street</label>
                      <input type="text" placeholder="123 Main Street, Apt 4B" value={newAddress.addressLine} onChange={e => setNewAddress({...newAddress, addressLine: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>City</label>
                        <input type="text" placeholder="Springfield" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>State</label>
                        <input type="text" placeholder="IL" value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>ZIP / Pincode</label>
                      <input type="text" placeholder="62701" value={newAddress.pincode} onChange={e => setNewAddress({...newAddress, pincode: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Pin Location on Map (Auto-fills Address)</label>
                      <LocationPicker 
                        lat={newAddress.latitude} 
                        lng={newAddress.longitude} 
                        onLocationSelect={handleLocationPick} 
                      />
                    </div>
                  </div>

                  <button onClick={handleSaveAddress} className="neon-btn" style={{ width: '100%', padding: '18px', borderRadius: '16px', fontWeight: '800', fontSize: '1rem', letterSpacing: '1px' }}>
                    {editingAddressId ? 'UPDATE ADDRESS' : 'SAVE ADDRESS'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default HomePage;
