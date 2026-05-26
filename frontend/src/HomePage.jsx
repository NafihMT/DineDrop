import React, { useEffect, useState, useRef } from 'react';
import Cookies from 'js-cookie';
import * as signalR from "@microsoft/signalr";
import LocationPicker from './LocationPicker';
import OrderTrackingMap from './OrderTrackingMap';

const RescueDealCard = ({ deal, onBuy }) => {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const updateTime = () => {
      const expiresDate = new Date(deal.expiresAt);
      const now = new Date();
      const diffMs = expiresDate - now;
      if (diffMs <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, expired: true });
      } else {
        const minutes = Math.floor(diffMs / 1000 / 60);
        const seconds = Math.floor((diffMs / 1000) % 60);
        setTimeLeft({ minutes, seconds, expired: false });
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [deal.expiresAt]);

  if (timeLeft.expired) return null;

  const isCritical = timeLeft.minutes < 5;

  return (
    <div className="rescue-ticket" style={{ border: `1px solid ${isCritical ? 'rgba(255, 0, 85, 0.35)' : 'rgba(0, 243, 255, 0.2)'}`, background: isCritical ? 'linear-gradient(135deg, rgba(255,0,85,0.06), rgba(0,0,0,0))' : 'linear-gradient(135deg, rgba(0,243,255,0.03), rgba(0,0,0,0))' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: isCritical ? 'linear-gradient(90deg, #ff0055, #f39c12)' : 'linear-gradient(90deg, #00f3ff, #0070ff)' }}></div>
      
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <h4 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#fff' }}>{deal.restaurantName}</h4>
          <span className="pulse" style={{ fontSize: '0.78rem', fontWeight: '800', color: isCritical ? '#ff0055' : '#00f3ff', background: isCritical ? 'rgba(255,0,85,0.1)' : 'rgba(0,243,255,0.1)', padding: '4px 10px', borderRadius: '10px', border: `1px solid ${isCritical ? 'rgba(255,0,85,0.15)' : 'rgba(0,243,255,0.15)'}` }}>
            ⏳ {timeLeft.minutes}:{timeLeft.seconds.toString().padStart(2, '0')} min
          </span>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '0.68rem', color: '#666', fontWeight: '800', letterSpacing: '0.8px', marginBottom: '8px', textTransform: 'uppercase' }}>Prepared Dish Tray</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {deal.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#ccc' }}>
                <span style={{ fontWeight: '500' }}>{item.quantity}x {item.dishName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#666', textDecoration: 'line-through', marginRight: '8px' }}>${(deal.originalSubtotal || 0).toFixed(2)}</span>
          <span style={{ fontSize: '1.4rem', fontWeight: '950', color: isCritical ? '#ff0055' : '#00f3ff' }}>${(deal.rescuedPrice || 0).toFixed(2)}</span>
        </div>
        <button onClick={() => onBuy(deal.orderId)} className="neon-btn" style={{ background: isCritical ? 'linear-gradient(135deg, #ff0055, #ff4d4d)' : 'linear-gradient(135deg, #00f3ff, #0070ff)', boxShadow: isCritical ? '0 0 15px rgba(255, 0, 85, 0.3)' : '0 0 15px rgba(0, 243, 255, 0.2)', color: '#000', padding: '10px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '0.82rem' }}>
          RESCUE NOW
        </button>
      </div>
    </div>
  );
};

const HomePage = ({ onLogout }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('customer_active_tab') || 'browse';
  });

  useEffect(() => {
    localStorage.setItem('customer_active_tab', activeTab);
  }, [activeTab]); // browse, history, tracking
  const [myOrders, setMyOrders] = useState([]);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orderNotification, setOrderNotification] = useState(null);
  const trackingOrderRef = useRef(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [rescueDeals, setRescueDeals] = useState([]);
  const signalrConnection = useRef(null);

  useEffect(() => {
    setVisibleCount(6);
  }, [selectedCategory, nearbyOnly, userLocation]);

  const [profileData, setProfileData] = useState({
    name: 'Customer',
    email: 'customer@gmail.com',
    phone: '',
    profileImageUrl: null,
    dateOfBirth: '',
    gender: '',
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

  const [restRating, setRestRating] = useState(5);
  const [restFeedback, setRestFeedback] = useState('');
  const [driverRating, setDriverRating] = useState(5);
  const [driverFeedback, setDriverFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

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
    fetchRescueDeals();
    setupSignalR();

    const interval = setInterval(fetchRescueDeals, 30000);

    return () => {
      if (signalrConnection.current) signalrConnection.current.stop();
      clearInterval(interval);
    };
  }, []);

  const setupSignalR = async () => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5070/orderHub")
      .withAutomaticReconnect()
      .build();

    connection.on("OrderStatusUpdated", async (data) => {
      // If we are currently tracking this order, fetch full updated details to sync all fields (like deliveryOtp)
      if (trackingOrderRef.current && trackingOrderRef.current.id === data.orderId) {
        fetchOrderDetails(data.orderId, false);
      } else {
        setTrackingOrder(prev => {
          if (prev && prev.id === data.orderId) {
            return { ...prev, status: data.newStatus };
          }
          return prev;
        });
      }
      // Refresh history list and profile (wallet balance)
      fetchMyOrders(false);
      fetchProfile();

      // If driver just picked up the order, fetch the OTP to show in notification
      let otpCode = null;
      if (data.newStatus === 'Picked') {
        try {
          const res = await fetch(`http://localhost:5070/api/customer/orders/${data.orderId}`, { credentials: 'include' });
          if (res.ok) {
            const orderData = await res.json();
            otpCode = orderData.deliveryOtp || null;
          }
        } catch (e) {
          console.error('Failed to fetch OTP for notification:', e);
        }
      }

      // Show notification
      setOrderNotification({
        orderId: data.orderId,
        restaurantName: data.restaurantName || "Restaurant",
        status: data.newStatus,
        message: data.message || null,
        otpCode
      });

      // Auto-hide after 15 seconds (longer if OTP or message is shown)
      setTimeout(() => setOrderNotification(null), (otpCode || data.message) ? 20000 : 10000);
    });

    connection.on("RestaurantProfileUpdated", () => {
      fetchRestaurants();
    });

    connection.on("DriverLocationUpdated", (data) => {
      console.log("Live Driver Location Stream Received:", data);
      setTrackingOrder(prev => {
        if (prev && prev.id === data.orderId) {
          return {
            ...prev,
            driverLatitude: data.latitude,
            driverLongitude: data.longitude
          };
        }
        return prev;
      });
    });

    try {
      await connection.start();
      console.log("SignalR Connected (User)");
      signalrConnection.current = connection;
      if (trackingOrderRef.current && trackingOrderRef.current.id) {
        try {
          await connection.invoke("JoinOrderGroup", trackingOrderRef.current.id);
          console.log("Joined order group on connection start:", trackingOrderRef.current.id);
        } catch (joinErr) {
          console.error("Failed to join order group on connection start:", joinErr);
        }
      }
    } catch (err) {
      console.error("SignalR Connection Error:", err);
    }
  };

  const fetchRestaurants = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`http://localhost:5070/api/user/restaurants?t=${new Date().getTime()}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
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

  const fetchRescueDeals = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/customer/orders/rescue-deals', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRescueDeals(data);
      }
    } catch (err) {
      console.error("Failed to fetch rescue deals:", err);
    }
  };

  const buyRescueDeal = async (orderId) => {
    if (!selectedDeliveryAddress) {
      alert("Please select or add a delivery address in your Profile tab first.");
      setActiveTab('profile');
      return;
    }

    if (!window.confirm("🔥 Confirm Flash Food Rescue Claim? The deal subtotal will be deducted from your DineDrop Wallet.")) return;

    setIsPlacingOrder(true);
    try {
      const response = await fetch('http://localhost:5070/api/customer/orders/buy-rescue-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, addressId: selectedDeliveryAddress }),
        credentials: 'include'
      });

      const result = await response.json();
      if (response.ok) {
        alert("⚡ Flash Rescue Claimed! Order is pre-prepared and ready for driver pickup.");
        setCart([]);
        fetchProfile();
        fetchRescueDeals();
        fetchMyOrders(true);
        fetchOrderDetails(result.orderId, true);
      } else {
        alert(result.message || "Failed to claim Flash Rescue deal.");
      }
    } catch (err) {
      console.error(err);
      alert("Error claiming Flash Rescue deal: " + err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          profileImageUrl: profileData.profileImageUrl || null,
          dateOfBirth: profileData.dateOfBirth ? profileData.dateOfBirth : null,
          gender: profileData.gender || null
        }),
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

  const cancelOrder = async (orderId, status) => {
    let msg = "Are you sure you want to cancel this order? Your refund will be credited to your DineDrop wallet.";
    if (status === 'Preparing' || status === 'Ready') {
      msg = "⚠️ This order is already prepared/preparing! Cancelling now will charge a 50% cancellation fee. You will receive a partial refund (50% subtotal + 100% delivery fee) to your wallet. Proceed?";
    }
    if (!window.confirm(msg)) return;
    try {
      const response = await fetch(`http://localhost:5070/api/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        alert("Order cancelled successfully. Refund credited to DineDrop Wallet.");
        fetchMyOrders();
        fetchOrderDetails(orderId, false);
        fetchProfile();
        fetchRescueDeals(); // refresh list
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

        // Reset rating feedback states
        setRestRating(5);
        setRestFeedback('');
        setDriverRating(5);
        setDriverFeedback('');
        setRatingSubmitted(false);

        if (switchToTab) {
          setActiveTab('history');
        }
        
        // Join SignalR group for this order
        if (signalrConnection.current && signalrConnection.current.state === "Connected") {
          await signalrConnection.current.invoke("JoinOrderGroup", orderId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateOrder = async (orderId) => {
    setSubmittingRating(true);
    try {
      const response = await fetch(`http://localhost:5070/api/customer/orders/${orderId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantRating: restRating,
          restaurantFeedback: restFeedback,
          driverRating: driverRating,
          driverFeedback: driverFeedback
        }),
        credentials: 'include'
      });
      if (response.ok) {
        setRatingSubmitted(true);
        // Refresh details to update isRated flag
        fetchOrderDetails(orderId, false);
        // Silently refresh restaurants to display new real-time rating average!
        fetchRestaurants(false);
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to submit rating");
      }
    } catch (err) {
      alert("Error submitting rating: " + err.message);
    } finally {
      setSubmittingRating(false);
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
            border: orderNotification.status === 'Cancelled' ? '1px solid rgba(255, 77, 77, 0.5)' : orderNotification.otpCode ? '1px solid rgba(255, 200, 0, 0.5)' : '1px solid rgba(0, 243, 255, 0.3)',
            cursor: 'pointer',
            animation: 'slideInRight 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(30px)',
            maxWidth: '380px'
          }}
        >
          <div className="pulse" style={{ width: '48px', height: '48px', borderRadius: '50%', background: orderNotification.status === 'Cancelled' ? 'rgba(255, 77, 77, 0.15)' : orderNotification.otpCode ? 'rgba(255, 200, 0, 0.15)' : 'rgba(0, 243, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${orderNotification.status === 'Cancelled' ? '#ff4d4d' : orderNotification.otpCode ? '#ffc800' : '#00f3ff'}`, flexShrink: 0 }}>
            <span style={{ fontSize: '1.2rem' }}>{orderNotification.status === 'Cancelled' ? '⚠️' : orderNotification.otpCode ? '🛵' : '📦'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '4px', color: orderNotification.status === 'Cancelled' ? '#ff4d4d' : '#fff' }}>
              {orderNotification.status === 'Cancelled' ? '⚠️ Order Cancelled' : orderNotification.otpCode ? '🚀 Driver is on the way!' : 'Order Update!'}
            </h4>
            <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: orderNotification.otpCode ? '10px' : '0' }}>
              {orderNotification.message ? orderNotification.message : (
                <>Your order from <strong style={{ color: '#fff' }}>{orderNotification.restaurantName}</strong> is now <strong style={{ color: orderNotification.status === 'Cancelled' ? '#ff4d4d' : '#00f3ff' }}>{orderNotification.status}</strong>.</>
              )}
            </p>
            {orderNotification.otpCode && (
              <div style={{ background: 'rgba(255, 200, 0, 0.1)', border: '1px solid rgba(255, 200, 0, 0.4)', borderRadius: '12px', padding: '10px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: '#aaa', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '4px' }}>DELIVERY VERIFICATION CODE</p>
                <p style={{ fontSize: '2rem', fontWeight: '900', color: '#ffc800', letterSpacing: '0.3em', fontFamily: 'monospace' }}>{orderNotification.otpCode}</p>
                <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>Share this code with the driver to complete delivery</p>
              </div>
            )}
            {!orderNotification.otpCode && (
              <p style={{ color: orderNotification.status === 'Cancelled' ? '#ff4d4d' : '#00f3ff', fontSize: '0.75rem', fontWeight: '700', marginTop: '4px' }}>{orderNotification.status === 'Cancelled' ? 'VIEW HISTORY' : 'CLICK TO TRACK →'}</p>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); setOrderNotification(null); }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '8px', flexShrink: 0 }}>✕</button>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        .glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(30px);
          -webkit-backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
        }
        .neon-btn {
          background: linear-gradient(135deg, #00f3ff, #0070ff);
          color: #000;
          font-weight: 800;
          letter-spacing: 0.5px;
          border: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0, 243, 255, 0.2);
        }
        .neon-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 243, 255, 0.4);
          filter: brightness(1.1);
        }
        .neon-btn:active {
          transform: translateY(0);
        }
        .neon-btn:disabled {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: #444;
          box-shadow: none;
          cursor: not-allowed;
          transform: none;
        }
        
        .category-card {
          min-width: 110px;
          padding: 20px 14px;
          border-radius: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255, 255, 255, 0.04);
          background: rgba(255, 255, 255, 0.015);
        }
        .category-card:hover {
          transform: translateY(-4px);
          background: rgba(0, 243, 255, 0.03);
          border-color: rgba(0, 243, 255, 0.2);
          box-shadow: 0 8px 25px rgba(0, 243, 255, 0.1);
        }
        .category-card.active {
          background: rgba(0, 243, 255, 0.08);
          border-color: rgba(0, 243, 255, 0.4);
          box-shadow: 0 8px 30px rgba(0, 243, 255, 0.2);
          color: #00f3ff;
        }
        
        .restaurant-card {
          border-radius: 24px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        .restaurant-card:hover {
          transform: translateY(-6px);
          border-color: rgba(0, 243, 255, 0.25);
          box-shadow: 0 15px 35px rgba(0, 243, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }
        
        .dish-card {
          display: flex;
          gap: 20px;
          padding: 20px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dish-card:hover {
          transform: translateX(4px);
          border-color: rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        }
        
        .rescue-ticket {
          position: relative;
          background: linear-gradient(135deg, rgba(255, 0, 85, 0.04), rgba(0, 0, 0, 0));
          border: 1px solid rgba(255, 0, 85, 0.2);
          border-radius: 24px;
          padding: 24px;
          min-height: 250px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rescue-ticket:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 0, 85, 0.35);
          box-shadow: 0 15px 35px rgba(255, 0, 85, 0.15);
          background: linear-gradient(135deg, rgba(255, 0, 85, 0.06), rgba(0, 0, 0, 0));
        }

        .promo-card {
          border: 1px solid rgba(255, 255, 255, 0.04);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.01), rgba(0, 0, 0, 0));
          border-radius: 24px;
          padding: 24px;
          transition: all 0.3s ease;
          position: relative;
        }
        .promo-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 243, 255, 0.2);
          box-shadow: 0 10px 25px rgba(0, 243, 255, 0.05);
        }

        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
        .pulse { animation: pulse 2s infinite ease-in-out; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
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
                {/* Cinematic Hero Landing Header */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.12), rgba(0, 112, 255, 0.05), rgba(0,0,0,0))',
                  borderRadius: '36px',
                  padding: '50px 60px',
                  marginBottom: '40px',
                  border: '1px solid rgba(0, 243, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '40px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ flex: 1.2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                      <span style={{ padding: '6px 14px', background: 'rgba(0, 243, 255, 0.1)', color: '#00f3ff', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '2px', border: '1px solid rgba(0, 243, 255, 0.2)' }}>PREMIUM DINING</span>
                      <span className="pulse" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71' }}></span>
                      <span style={{ fontSize: '0.75rem', color: '#2ecc71', fontWeight: '800', letterSpacing: '1px' }}>24/7 LIVE DELIVERY</span>
                    </div>
                    <h2 style={{ fontSize: '3.6rem', fontWeight: '950', marginBottom: '16px', lineHeight: '1.05', letterSpacing: '-1.5px', background: 'linear-gradient(90deg, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      CRAVE. RESCUE.<br/>ENJOY.
                    </h2>
                    <p style={{ color: '#aaa', fontSize: '1.15rem', marginBottom: '32px', maxWidth: '480px', lineHeight: '1.6' }}>
                      Experience the next generation of food delivery. Rescue high-quality chef trays at <span style={{ color: '#ff0055', fontWeight: '800' }}>50% off</span> or order fresh from premium kitchens.
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button className="neon-btn" onClick={() => { const el = document.getElementById('restaurant-list-start'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} style={{ padding: '18px 36px', borderRadius: '16px', fontWeight: '900', fontSize: '0.95rem' }}>
                        EXPLORE KITCHENS
                      </button>
                      {rescueDeals && rescueDeals.length > 0 && (
                        <button className="neon-btn" onClick={() => { const el = document.getElementById('flash-rescue-start'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: 'rgba(255, 0, 85, 0.1)', border: '1px solid rgba(255, 0, 85, 0.3)', color: '#ff0055', boxShadow: 'none', padding: '18px 36px', borderRadius: '16px', fontWeight: '900', fontSize: '0.95rem' }}>
                          ⚡ RESCUE FEED ({rescueDeals.length})
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 0.8, display: 'flex', justifyContent: 'center', position: 'relative' }}>
                    <div className="glass" style={{ width: '280px', padding: '24px', borderRadius: '28px', border: '1px solid rgba(0, 243, 255, 0.15)', transform: 'rotate(6deg) translateY(-10px)', boxShadow: '0 20px 50px rgba(0, 243, 255, 0.15)', background: 'rgba(5, 5, 5, 0.8)' }}>
                      <span style={{ padding: '5px 10px', background: '#ffc800', color: '#000', borderRadius: '8px', fontSize: '0.68rem', fontWeight: '900', display: 'inline-block', marginBottom: '14px' }}>WEEKLY HOT DEAL</span>
                      <h4 style={{ fontSize: '1.3rem', fontWeight: '900', margin: '0 0 8px 0' }}>Sizzling BBQ Tray</h4>
                      <p style={{ color: '#666', fontSize: '0.82rem', margin: '0 0 16px 0' }}>Loaded smoked brisket, caramelized ribs & sweet coleslaw.</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: '#666', textDecoration: 'line-through', marginRight: '6px' }}>$34.00</span>
                          <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#00f3ff' }}>$17.00</span>
                        </div>
                        <span style={{ fontSize: '1.5rem' }}>🥩</span>
                      </div>
                    </div>
                    {/* Background glow behind preview card */}
                    <div style={{ position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(0, 243, 255, 0.15)', filter: 'blur(60px)', zIndex: -1 }}></div>
                  </div>
                </div>

                {/* Promotional Deals Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '48px' }}>
                  <div className="promo-card">
                    <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '12px' }}>🎁</span>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>50% OFF FIRST ORDER</h4>
                    <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0 0 16px 0' }}>Get half off your entire checkout. Valid on orders from any restaurant.</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#00f3ff', fontWeight: '800', background: 'rgba(0, 243, 255, 0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(0, 243, 255, 0.15)' }}>DINE50</span>
                      <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '600' }}>New Users Only</span>
                    </div>
                  </div>

                  <div className="promo-card">
                    <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '12px' }}>💳</span>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>$10 WALLET BONUS</h4>
                    <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0 0 16px 0' }}>Get an extra $10 added automatically when you add $50 or more to your wallet.</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#2ecc71', fontWeight: '800', background: 'rgba(46, 204, 113, 0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>FEAST10</span>
                      <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '600' }}>Active Offer</span>
                    </div>
                  </div>

                  <div className="promo-card">
                    <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '12px' }}>🛵</span>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>FREE DELIVERY</h4>
                    <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0 0 16px 0' }}>Enjoy zero delivery fees on orders above $30 from local top spots.</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#ffc800', fontWeight: '800', background: 'rgba(255, 200, 0, 0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255, 200, 0, 0.15)' }}>FREEDEL</span>
                      <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '600' }}>{"Orders > $30"}</span>
                    </div>
                  </div>
                </div>

                {/* Flash Food Rescue Deals Section */}
                {rescueDeals && rescueDeals.length > 0 && (
                  <div id="flash-rescue-start" style={{ marginBottom: '54px', animation: 'fadeIn 0.5s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                      <span className="pulse" style={{ display: 'inline-flex', width: '12px', height: '12px', borderRadius: '50%', background: '#ff0055', boxShadow: '0 0 12px #ff0055' }}></span>
                      <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        ⚡ FLASH RESCUE FEED <span style={{ fontSize: '0.82rem', color: '#ff0055', fontWeight: '900', background: 'rgba(255, 0, 85, 0.1)', padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(255, 0, 85, 0.25)', letterSpacing: '0.5px' }}>50% OFF LIVE</span>
                      </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                      {rescueDeals.map(deal => (
                        <RescueDealCard key={deal.orderId} deal={deal} onBuy={buyRescueDeal} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div style={{ marginBottom: '54px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.5px' }}>Browse Categories</h3>
                  </div>
                  <div className="no-scrollbar" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
                    {[
                      { id: 'pizza', name: 'Pizza', icon: '🍕' },
                      { id: 'burger', name: 'Burger', icon: '🍔' },
                      { id: 'sushi', name: 'Sushi', icon: '🍣' },
                      { id: 'healthy', name: 'Healthy', icon: '🥗' },
                      { id: 'dessert', name: 'Dessert', icon: '🍩' },
                      { id: 'coffee', name: 'Coffee', icon: '☕' }
                    ].filter(cat => 
                      restaurants.some(r => 
                        (r.description && r.description.toLowerCase().includes(cat.id)) ||
                        (r.name && r.name.toLowerCase().includes(cat.id))
                      )
                    ).map(cat => {
                      const isActive = selectedCategory === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                          className={`category-card ${isActive ? 'active' : ''}`}
                        >
                          <div style={{ fontSize: '2.2rem', marginBottom: '10px', filter: isActive ? 'drop-shadow(0 0 10px rgba(0, 243, 255, 0.4))' : 'none' }}>{cat.icon}</div>
                          <h4 style={{ fontSize: '0.92rem', fontWeight: '700', margin: 0 }}>{cat.name}</h4>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Restaurant List Section Header */}
                <header id="restaurant-list-start" style={{ marginBottom: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px' }}>
                  <div>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: '900', letterSpacing: '-0.8px', marginBottom: '6px' }}>
                      {selectedCategory ? `Top Spots in ${selectedCategory.toUpperCase()}` : 'All Premium Kitchens'}
                    </h2>
                    <p style={{ color: '#888', fontSize: '0.95rem' }}>Curated list of premium kitchens and restaurants delivering near you.</p>
                  </div>
                  <button onClick={handleLocateMe} style={{ padding: '14px 28px', borderRadius: '16px', background: nearbyOnly ? 'rgba(0, 243, 255, 0.15)' : 'rgba(255,255,255,0.02)', color: nearbyOnly ? '#00f3ff' : '#fff', border: `1px solid ${nearbyOnly ? 'rgba(0, 243, 255, 0.4)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', letterSpacing: '0.5px', transition: 'all 0.3s' }}>
                    📍 {nearbyOnly ? 'DELIVERING NEARBY' : 'SET CURRENT LOCATION'}
                  </button>
                </header>

                {showMap && (
                  <div className="glass" style={{ marginBottom: '36px', animation: 'fadeIn 0.3s ease-out', padding: '24px', borderRadius: '24px' }}>
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
                    })
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

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
                        {displayedList.map(res => {
                          const dist = userLocation ? getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, res.latitude, res.longitude) : null;
                          return (
                            <div
                              key={res.id}
                              onClick={() => fetchMenu(res)}
                              className="restaurant-card"
                            >
                              <div style={{
                                height: '180px',
                                background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.08), rgba(0, 112, 255, 0.03))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                position: 'relative'
                              }}>
                                <div style={{
                                  width: '80px',
                                  height: '80px',
                                  borderRadius: '50%',
                                  background: 'rgba(5,5,5,0.85)',
                                  border: '1px solid rgba(0, 243, 255, 0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '2.5rem',
                                  fontWeight: '900',
                                  color: '#00f3ff',
                                  boxShadow: '0 8px 25px rgba(0, 243, 255, 0.15)'
                                }}>
                                  {res.name.charAt(0)}
                                </div>
                                <span style={{
                                  position: 'absolute',
                                  top: '16px',
                                  right: '16px',
                                  padding: '5px 12px',
                                  borderRadius: '20px',
                                  background: res.isOpen ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)',
                                  color: res.isOpen ? '#2ecc71' : '#666',
                                  fontSize: '0.68rem',
                                  fontWeight: '900',
                                  border: `1px solid ${res.isOpen ? 'rgba(46, 204, 113, 0.25)' : 'rgba(255,255,255,0.08)'}`,
                                  letterSpacing: '0.5px'
                                }}>
                                  {res.isOpen ? 'OPEN NOW' : 'CLOSED'}
                                </span>
                                {dist !== null && (
                                  <span style={{
                                    position: 'absolute',
                                    bottom: '16px',
                                    left: '16px',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    background: 'rgba(0,0,0,0.6)',
                                    color: '#aaa',
                                    fontSize: '0.72rem',
                                    fontWeight: '700'
                                  }}>
                                    📍 {dist.toFixed(1)} km
                                  </span>
                                )}
                              </div>
                              <div style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                  <h3 style={{ fontSize: '1.25rem', fontWeight: '850', margin: 0, color: '#fff' }}>{res.name}</h3>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(241, 196, 15, 0.08)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(241, 196, 15, 0.15)' }}>
                                    <span style={{ color: '#f1c40f', fontSize: '0.78rem' }}>⭐</span>
                                    <span style={{ color: '#f1c40f', fontWeight: '900', fontSize: '0.78rem' }}>{res.rating.toFixed(1)}</span>
                                  </div>
                                </div>
                                <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {res.description || 'No description available for this premium dining kitchen.'}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '16px' }}>
                                  <span style={{ color: '#666', fontSize: '0.78rem', fontWeight: '700' }}>⭐ TOP RATED</span>
                                  <span style={{ color: '#00f3ff', fontSize: '0.8rem', fontWeight: '800' }}>BROWSE MENU →</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
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
                {/* Premium Restaurant Header Cover */}
                <div style={{
                  position: 'relative',
                  borderRadius: '28px',
                  padding: '40px',
                  marginBottom: '40px',
                  background: 'linear-gradient(135deg, rgba(0, 243, 255, 0.15), rgba(0, 112, 255, 0.05))',
                  border: '1px solid rgba(0, 243, 255, 0.15)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  overflow: 'hidden'
                }}>
                  <div>
                    <button 
                      onClick={() => setSelectedRestaurant(null)} 
                      style={{ 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        color: '#00f3ff', 
                        cursor: 'pointer', 
                        marginBottom: '20px', 
                        fontWeight: '700',
                        padding: '10px 18px',
                        borderRadius: '12px',
                        fontSize: '0.82rem',
                        letterSpacing: '0.5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 243, 255, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      ← BACK TO EXPLORE
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-1px' }}>{selectedRestaurant.name}</h2>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '8px', 
                        background: selectedRestaurant.isOpen ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)', 
                        color: selectedRestaurant.isOpen ? '#2ecc71' : '#666', 
                        fontSize: '0.7rem', 
                        fontWeight: '900',
                        border: `1px solid ${selectedRestaurant.isOpen ? 'rgba(46, 204, 113, 0.25)' : 'rgba(255,255,255,0.08)'}`
                      }}>
                        {selectedRestaurant.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                    <p style={{ color: '#aaa', fontSize: '1rem', marginTop: '8px', maxWidth: '600px', lineHeight: '1.5' }}>{selectedRestaurant.description}</p>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(241, 196, 15, 0.1)', padding: '5px 12px', borderRadius: '10px', border: '1px solid rgba(241, 196, 15, 0.2)' }}>
                        <span style={{ color: '#f1c40f', fontSize: '0.85rem' }}>⭐</span>
                        <span style={{ color: '#f1c40f', fontWeight: '900', fontSize: '0.85rem' }}>{selectedRestaurant.rating.toFixed(1)} / 5.0</span>
                      </div>
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>•</span>
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: '600' }}>🏪 {selectedRestaurant.address}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '7rem', opacity: 0.25, transform: 'rotate(-10deg)', userSelect: 'none' }}>🍽️</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '48px', alignItems: 'flex-start' }}>
                  {/* Left Column: Menu list */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.5px', margin: 0 }}>Available Offerings</h3>
                      <span style={{ color: '#666', fontSize: '0.88rem', fontWeight: '700' }}>{menu.length} CHEF SELECTIONS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {menu.map(item => (
                        <div key={item.id} className="dish-card">
                          <div style={{ width: '130px', height: '130px', borderRadius: '18px', background: 'rgba(0,0,0,0.3)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.03)' }}>
                            {item.imageUrl ? (
                              <img src={`http://localhost:5070${item.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={item.name} />
                            ) : (
                              <span style={{ fontSize: '2.8rem' }}>🍔</span>
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                <h4 style={{ fontSize: '1.2rem', fontWeight: '850', color: '#fff', margin: 0 }}>{item.name}</h4>
                                <span style={{ fontSize: '1.25rem', fontWeight: '950', color: '#00f3ff' }}>${item.price.toFixed(2)}</span>
                              </div>
                              <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: '1.4', marginTop: '6px', marginBottom: '16px' }}>{item.description}</p>
                            </div>
                            <button onClick={() => addToCart(item)} className="neon-btn" style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '900', fontSize: '0.8rem', width: 'fit-content' }}>
                              + ADD TO TRAY
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Sticky Cart Drawer */}
                  <div className="glass" style={{ padding: '36px', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: '40px', background: 'rgba(5, 5, 5, 0.8)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0 }}>Your Tray</h3>
                      <span style={{ padding: '4px 10px', background: 'rgba(0, 243, 255, 0.1)', color: '#00f3ff', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800' }}>
                        {cart.reduce((sum, i) => sum + i.quantity, 0)} items
                      </span>
                    </div>

                    {cart.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#444' }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📭</span>
                        <p style={{ fontWeight: '700', fontSize: '0.95rem', color: '#666', margin: 0 }}>Tray is currently empty</p>
                        <p style={{ fontSize: '0.8rem', color: '#444', marginTop: '6px' }}>Add premium chef plates from the menu listing to begin checkout.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px', maxHeight: '240px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                          {cart.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <div>
                                <p style={{ fontWeight: '700', color: '#fff', fontSize: '0.92rem', margin: 0 }}>{item.quantity}x {item.name}</p>
                                <p style={{ fontSize: '0.78rem', color: '#666', margin: '2px 0 0 0' }}>${item.price.toFixed(2)} ea</p>
                              </div>
                              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                <span style={{ fontWeight: '900', color: '#eee', fontSize: '0.92rem' }}>${(item.price * item.quantity).toFixed(2)}</span>
                                <button 
                                  onClick={() => removeFromCart(item.id)} 
                                  style={{ background: 'rgba(255,0,0,0.08)', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '0.9rem', width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,0,0,0.15)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,0,0,0.08)'}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', marginBottom: '28px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', color: '#888', marginBottom: '12px' }}>
                            <span>Subtotal</span>
                            <span style={{ color: '#eee', fontWeight: '600' }}>${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', color: '#888', marginBottom: '20px' }}>
                            <span>Delivery Fee</span>
                            <span style={{ color: '#eee', fontWeight: '600' }}>$5.00</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '900', marginBottom: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                            <span>Total</span>
                            <span style={{ color: '#00f3ff' }}>${(cart.reduce((sum, i) => sum + (i.price * i.quantity), 0) + 5).toFixed(2)}</span>
                          </div>

                          <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: '#666', marginBottom: '8px', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase' }}>DELIVERY ADDRESS</label>
                            {profileData.addresses && profileData.addresses.length > 0 ? (
                              <select 
                                value={selectedDeliveryAddress || ''} 
                                onChange={e => setSelectedDeliveryAddress(e.target.value)}
                                style={{ width: '100%', padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                              >
                                {profileData.addresses.map(addr => (
                                  <option key={addr.id} value={addr.id} style={{ background: '#0a0a0a', color: '#fff' }}>
                                    {addr.addressLine}, {addr.city}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button 
                                onClick={() => { setShowAddAddressModal(true); setActiveTab('profile'); }}
                                className="neon-btn"
                                style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: '800' }}
                              >
                                + ADD DELIVERY ADDRESS
                              </button>
                            )}
                          </div>
                        </div>

                        <button 
                          onClick={handlePlaceOrder} 
                          disabled={isPlacingOrder || !selectedDeliveryAddress} 
                          className="neon-btn" 
                          style={{ 
                            width: '100%', 
                            padding: '18px', 
                            borderRadius: '16px', 
                            fontWeight: '900', 
                            fontSize: '0.95rem', 
                            letterSpacing: '1px',
                            background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                            boxShadow: '0 8px 25px rgba(46, 204, 113, 0.15)'
                          }}
                        >
                          {isPlacingOrder ? 'TRANSMITTING ORDER…' : 'PLACE ORDER'}
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
                    {['Placed', 'Accepted', 'Preparing', 'Ready'].includes(trackingOrder.status) && (
                      <button 
                        onClick={() => cancelOrder(trackingOrder.id, trackingOrder.status)}
                        style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,77,77,0.1)', border: '1px solid #ff4d4d', color: '#ff4d4d', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', marginTop: '20px' }}
                      >
                        CANCEL ORDER
                      </button>
                    )}
                  </div>
                  <div className="glass" style={{ padding: '30px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h4 style={{ marginBottom: '10px', color: '#666', fontWeight: '700' }}>DELIVERY TO</h4>
                      <p style={{ fontWeight: '700', fontSize: '1.05rem', color: '#fff' }}>{trackingOrder.customerName || 'Customer'}</p>
                      <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '6px', lineHeight: '1.4' }}>{trackingOrder.customerAddress || 'Your pinned address in the system.'}</p>
                      {trackingOrder.status === 'Delivered' && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '700', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Delivery Partner</span>
                          <p style={{ fontWeight: '700', fontSize: '1rem', color: '#2ecc71', margin: 0 }}>
                            🛵 {trackingOrder.driverName || 'Authorized Delivery Professional'}
                          </p>
                          <span style={{ fontSize: '0.75rem', color: '#666', display: 'block', marginTop: '12px', textTransform: 'uppercase' }}>Delivery Status</span>
                          <p style={{ fontWeight: '700', fontSize: '1rem', color: '#fff', margin: 0 }}>
                            ✅ Handed over successfully
                          </p>
                        </div>
                      )}
                    </div>

                    {trackingOrder.status === 'Delivered' && (
                      <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '0.9rem', color: '#00f3ff', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>
                          Rate & Review your Order
                        </h4>
                        
                        {trackingOrder.isRated || ratingSubmitted ? (
                          <div className="glass" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.2)', textAlign: 'center' }}>
                            <span style={{ fontSize: '1.5rem' }}>✨</span>
                            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', fontWeight: '700', color: '#2ecc71' }}>Thank you for your feedback!</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#aaa' }}>Your ratings help us improve our service.</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Restaurant Rating */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: '0.78rem', color: '#eee', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                                Rate Restaurant: <span style={{ color: '#00f3ff' }}>{trackingOrder.restaurantName}</span>
                              </span>
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button 
                                    key={star}
                                    onClick={() => setRestRating(star)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '1.4rem',
                                      color: star <= restRating ? '#f39c12' : '#444',
                                      padding: 0,
                                      transition: 'transform 0.1s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                              <input 
                                type="text"
                                placeholder="Write restaurant feedback..."
                                value={restFeedback}
                                onChange={e => setRestFeedback(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  color: '#fff',
                                  fontSize: '0.8rem',
                                  fontFamily: 'Outfit, sans-serif'
                                }}
                              />
                            </div>

                            {/* Driver Rating */}
                            {trackingOrder.driverName && (
                              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontSize: '0.78rem', color: '#eee', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                                  Rate Driver: <span style={{ color: '#00f3ff' }}>{trackingOrder.driverName}</span>
                                </span>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button 
                                      key={star}
                                      onClick={() => setDriverRating(star)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '1.4rem',
                                        color: star <= driverRating ? '#f39c12' : '#444',
                                        padding: 0,
                                        transition: 'transform 0.1s'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                                <input 
                                  type="text"
                                  placeholder="Write driver feedback..."
                                  value={driverFeedback}
                                  onChange={e => setDriverFeedback(e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: '#fff',
                                    fontSize: '0.8rem',
                                    fontFamily: 'Outfit, sans-serif'
                                  }}
                                />
                              </div>
                            )}

                            <button
                              onClick={() => handleRateOrder(trackingOrder.id)}
                              disabled={submittingRating}
                              style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #00f3ff 0%, #0070ff 100%)',
                                border: 'none',
                                color: '#000',
                                fontWeight: '800',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                letterSpacing: '1px',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 243, 255, 0.4)'}
                              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                            >
                              {submittingRating ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {trackingOrder.status === 'Picked' && trackingOrder.deliveryOtp && (
                      <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(0, 243, 255, 0.3)', background: 'rgba(0, 243, 255, 0.05)', textAlign: 'center', marginTop: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#00f3ff', fontWeight: '800', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>DELIVERY VERIFICATION CODE</span>
                        <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', letterSpacing: '8px', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>{trackingOrder.deliveryOtp}</span>
                        <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '8px', margin: 0 }}>Please share this 4-digit code with the driver to complete delivery.</p>
                      </div>
                    )}

                    {/* Interactive Real-Time Map Tracking */}
                    {trackingOrder.status !== 'Delivered' && trackingOrder.customerLatitude && trackingOrder.customerLongitude && (
                      <div style={{ marginTop: '10px' }}>
                        <OrderTrackingMap 
                          customerCoords={{ lat: trackingOrder.customerLatitude, lng: trackingOrder.customerLongitude }}
                          restaurantCoords={{ lat: trackingOrder.restaurantLatitude, lng: trackingOrder.restaurantLongitude }}
                          driverCoords={
                            trackingOrder.driverLatitude && trackingOrder.driverLongitude 
                              ? { lat: trackingOrder.driverLatitude, lng: trackingOrder.driverLongitude } 
                              : null
                          }
                          orderStatus={trackingOrder.status}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '40px' }}>Your Profile</h2>

            {/* Avatar + Personal Info */}
            <div className="glass" style={{ padding: '36px', borderRadius: '28px', marginBottom: '28px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '800' }}>Personal Info</h3>
                {isEditingProfile ? (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setIsEditingProfile(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontWeight: '700' }}>CANCEL</button>
                    <button onClick={handleSaveProfile} style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(0, 243, 255, 0.15)', border: '1px solid #00f3ff', color: '#00f3ff', cursor: 'pointer', fontWeight: '800' }}>SAVE CHANGES</button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditingProfile(true)} style={{ padding: '8px 20px', borderRadius: '12px', background: 'rgba(0, 243, 255, 0.08)', border: '1px solid rgba(0, 243, 255, 0.2)', color: '#00f3ff', cursor: 'pointer', fontWeight: '700' }}>✏️ EDIT</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '36px', alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '2px solid rgba(0, 243, 255, 0.3)', overflow: 'hidden', background: 'rgba(0, 243, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {profileData.profileImageUrl ? (
                      <img src={profileData.profileImageUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '2.8rem', fontWeight: '900', color: '#00f3ff' }}>{profileData.name?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {isEditingProfile && (
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      <label style={{ fontSize: '0.72rem', color: '#00f3ff', cursor: 'pointer', fontWeight: '700' }}>CHANGE URL</label>
                    </div>
                  )}
                </div>

                {/* Fields */}
                <div style={{ flex: 1 }}>
                  {isEditingProfile ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>FULL NAME</label>
                        <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>PHONE</label>
                        <input type="text" value={profileData.phone} placeholder="+1 234 567 8900" onChange={e => setProfileData({...profileData, phone: e.target.value})} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>EMAIL (READ-ONLY)</label>
                        <input type="email" disabled value={profileData.email} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#555', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>DATE OF BIRTH</label>
                        <input
                          type="date"
                          value={profileData.dateOfBirth ? profileData.dateOfBirth.substring(0, 10) : ''}
                          onChange={e => setProfileData({...profileData, dateOfBirth: e.target.value})}
                          style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', colorScheme: 'dark', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>GENDER</label>
                        <select value={profileData.gender || ''} onChange={e => setProfileData({...profileData, gender: e.target.value})} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: profileData.gender ? '#fff' : '#666', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                          <option value="" style={{ color: '#666' }}>Select gender</option>
                          <option value="Male" style={{ color: '#fff' }}>Male</option>
                          <option value="Female" style={{ color: '#fff' }}>Female</option>
                          <option value="Non-binary" style={{ color: '#fff' }}>Non-binary</option>
                          <option value="Prefer not to say" style={{ color: '#fff' }}>Prefer not to say</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>PROFILE IMAGE URL (OPTIONAL)</label>
                        <input type="text" value={profileData.profileImageUrl || ''} placeholder="https://example.com/your-photo.jpg" onChange={e => setProfileData({...profileData, profileImageUrl: e.target.value || null})} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      {[
                        { label: 'Full Name', value: profileData.name },
                        { label: 'Phone', value: profileData.phone || '—' },
                        { label: 'Email', value: profileData.email },
                        { label: 'Gender', value: profileData.gender || '—' },
                        { label: 'Date of Birth', value: profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <p style={{ fontSize: '0.75rem', color: '#666', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '6px' }}>{label.toUpperCase()}</p>
                          <p style={{ fontSize: '1rem', fontWeight: '700', color: '#fff' }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '28px' }}>
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

              {/* Quick Stats */}
              <div className="glass" style={{ padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '4px' }}>Activity Summary</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#888', fontWeight: '600' }}>Total Orders</span>
                  <span style={{ fontWeight: '900', fontSize: '1.2rem', color: '#00f3ff' }}>{myOrders.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#888', fontWeight: '600' }}>Delivered</span>
                  <span style={{ fontWeight: '900', fontSize: '1.2rem', color: '#2ecc71' }}>{myOrders.filter(o => o.status === 'Delivered').length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#888', fontWeight: '600' }}>Cancelled</span>
                  <span style={{ fontWeight: '900', fontSize: '1.2rem', color: '#ff4d4d' }}>{myOrders.filter(o => o.status === 'Cancelled').length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
                  <span style={{ color: '#888', fontWeight: '600' }}>Saved Addresses</span>
                  <span style={{ fontWeight: '900', fontSize: '1.2rem', color: '#f39c12' }}>{profileData.addresses?.length || 0}</span>
                </div>
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
