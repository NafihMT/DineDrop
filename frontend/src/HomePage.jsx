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
          <span style={{ fontSize: '0.8rem', color: '#666', textDecoration: 'line-through', marginRight: '8px' }}>₹{(deal.originalSubtotal || 0).toFixed(2)}</span>
          <span style={{ fontSize: '1.4rem', fontWeight: '950', color: isCritical ? '#ff0055' : '#00f3ff' }}>₹{(deal.rescuedPrice || 0).toFixed(2)}</span>
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
  const [selectedRestaurant, setSelectedRestaurant] = useState(() => {
    const saved = sessionStorage.getItem('customer_selected_restaurant');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (selectedRestaurant) {
      sessionStorage.setItem('customer_selected_restaurant', JSON.stringify(selectedRestaurant));
    } else {
      sessionStorage.removeItem('customer_selected_restaurant');
    }
  }, [selectedRestaurant]);

  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('dinedrop_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [cartRestaurant, setCartRestaurant] = useState(() => {
    const saved = localStorage.getItem('dinedrop_cart_restaurant');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('dinedrop_cart', JSON.stringify(cart));
    if (cart.length === 0) {
      setCartRestaurant(null);
      localStorage.removeItem('dinedrop_cart_restaurant');
    } else if (cartRestaurant) {
      localStorage.setItem('dinedrop_cart_restaurant', JSON.stringify(cartRestaurant));
    }
  }, [cart, cartRestaurant]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('customer_active_tab') || 'browse';
  });

  useEffect(() => {
    localStorage.setItem('customer_active_tab', activeTab);
  }, [activeTab]); // browse, history, tracking
  const [myOrders, setMyOrders] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 8;
  const totalHistoryPages = Math.ceil(myOrders.length / itemsPerPage);
  const paginatedHistory = myOrders.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ color: '#888', fontSize: '0.9rem' }}>
          Showing page <strong style={{ color: '#fff' }}>{currentPage}</strong> of <strong style={{ color: '#fff' }}>{totalPages}</strong>
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onPageChange(currentPage - 1)} 
            disabled={currentPage === 1}
            style={{ padding: '8px 16px', borderRadius: '12px', background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', color: currentPage === 1 ? '#666' : '#fff', border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.9rem', transition: 'all 0.2s' }}
          >
            Prev
          </button>
          {(() => { let pages = []; if (totalPages <= 3) pages = Array.from({ length: totalPages }, (_, i) => i + 1); else if (currentPage === 1) pages = [1, 2, 3]; else if (currentPage === totalPages) pages = [totalPages - 2, totalPages - 1, totalPages]; else pages = [currentPage - 1, currentPage, currentPage + 1]; return pages; })().map(p => (
            <button 
              key={p}
              onClick={() => onPageChange(p)}
              style={{ width: '38px', height: '38px', borderRadius: '12px', background: currentPage === p ? '#00f3ff' : 'rgba(255,255,255,0.03)', color: currentPage === p ? '#000' : '#fff', border: currentPage === p ? 'none' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', transition: 'all 0.2s' }}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={() => onPageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
            style={{ padding: '8px 16px', borderRadius: '12px', background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)', color: currentPage === totalPages ? '#666' : '#fff', border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.9rem', transition: 'all 0.2s' }}
          >
            Next
          </button>
        </div>
      </div>
    );
  };
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orderNotification, setOrderNotification] = useState(null);
  const trackingOrderRef = useRef(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [userLocation, setUserLocation] = useState(() => {
    const saved = localStorage.getItem('dinedrop_location');
    return saved ? JSON.parse(saved) : null;
  });
  const [userLocationName, setUserLocationName] = useState(() => localStorage.getItem('dinedrop_location_name') || '');
  const [userLocationFull, setUserLocationFull] = useState(() => localStorage.getItem('dinedrop_location_full') || '');
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('dinedrop_recent_locations');
    return saved ? JSON.parse(saved) : [];
  });
  const [nearbyOnly, setNearbyOnly] = useState(() => !!localStorage.getItem('dinedrop_location'));

  useEffect(() => {
    if (userLocation) {
      localStorage.setItem('dinedrop_location', JSON.stringify(userLocation));
      localStorage.setItem('dinedrop_location_name', userLocationName);
      localStorage.setItem('dinedrop_location_full', userLocationFull);
    } else {
      localStorage.removeItem('dinedrop_location');
      localStorage.removeItem('dinedrop_location_name');
      localStorage.removeItem('dinedrop_location_full');
    }
  }, [userLocation, userLocationName, userLocationFull]);
  const [visibleCount, setVisibleCount] = useState(6);
  const [rescueDeals, setRescueDeals] = useState([]);
  const [availableOffers, setAvailableOffers] = useState([]);
  const signalrConnection = useRef(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Online'); // Online, Wallet, COD
  const [cartConflictModal, setCartConflictModal] = useState({ show: false, item: null, contextRest: null, dishContext: null });
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponCode('');
    }
  }, [cartTotal]);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const targetRest = cartRestaurant || selectedRestaurant;
    if (!targetRest) return;
    try {
      const res = await fetch(`http://localhost:5070/api/offer/apply?code=${encodeURIComponent(couponCode)}&restaurantId=${targetRest.id}&subtotal=${cartTotal}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.isValid) {
        setAppliedCoupon(data);
      } else {
        showToast(data.message || 'Invalid coupon');
        setAppliedCoupon(null);
      }
    } catch (err) {
      showToast("Error applying coupon");
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

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
  const [deleteAddressId, setDeleteAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState({
    name: '',
    mobile: '',
    flat: '',
    area: '',
    landmark: '',
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

  const [browseRestRating, setBrowseRestRating] = useState(5);
  const [browseRestFeedback, setBrowseRestFeedback] = useState('');
  const [submittingBrowseRating, setSubmittingBrowseRating] = useState(false);
  const [browseRatingSubmitted, setBrowseRatingSubmitted] = useState(false);
  const [showBrowseRatingUI, setShowBrowseRatingUI] = useState(false);

  const [showMap, setShowMap] = useState(false);
  const [searchLocationText, setSearchLocationText] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation({ lat, lng });
      setNearbyOnly(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`);
        const data = await res.json();
        if (data && data.display_name) {
          const parts = data.display_name.split(',');
          setUserLocationName(parts[0].trim());
          setUserLocationFull(data.display_name);
        }
      } catch (e) { console.error(e); }
      setShowMap(false);
    });
  };

  const lastFetchedQuery = useRef('');
  const searchCache = useRef({});
  const dealsContainerRef = useRef(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const query = searchLocationText.trim();
      if (query.length > 2) {
        if (query === lastFetchedQuery.current) return;

        if (searchCache.current[query]) {
          setLocationSuggestions(searchCache.current[query]);
          lastFetchedQuery.current = query;
          return;
        }

        lastFetchedQuery.current = query;
        setIsSearchingLocation(true);
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=en`);
          const data = await response.json();
          const suggestions = data || [];
          searchCache.current[query] = suggestions;
          setLocationSuggestions(suggestions);
        } catch (err) {
          console.error("Failed to fetch suggestions", err);
        } finally {
          setIsSearchingLocation(false);
        }
      } else {
        setLocationSuggestions([]);
        lastFetchedQuery.current = '';
      }
    }, 1200);

    return () => clearTimeout(delayDebounceFn);
  }, [searchLocationText]);

  const selectLocation = (lat, lon, displayName) => {
    setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lon) });
    const parts = displayName.split(',');
    setUserLocationName(parts[0].trim());
    setUserLocationFull(displayName);
    setNearbyOnly(true);
    setShowMap(false);
    setSearchLocationText('');
    setLocationSuggestions([]);

    const newRecent = [{ lat, lon, displayName }, ...recentSearches.filter(s => s.displayName !== displayName)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('dinedrop_recent_locations', JSON.stringify(newRecent));
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('dinedrop_recent_locations');
  };

  useEffect(() => {
    trackingOrderRef.current = trackingOrder;
  }, [trackingOrder]);

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
        setSelectedRestaurant(prev => {
          if (!prev) return null;
          const updated = data.find(r => r.id === prev.id);
          return updated || prev;
        });
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

  const fetchMenu = async (restaurant, isPolling = false) => {
    if (!isPolling) {
      setSelectedRestaurant(restaurant);
      setMenu([]);
    }
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

  useEffect(() => {
    if (selectedRestaurant) {
      fetchMenu(selectedRestaurant, true);
      const menuInterval = setInterval(() => {
        fetchMenu(selectedRestaurant, true);
      }, 5000);
      return () => clearInterval(menuInterval);
    }
  }, [selectedRestaurant?.id]);

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

  const fetchOffers = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/offer', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAvailableOffers(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch offers:", err);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    fetchMyOrders();
    fetchProfile();
    fetchRescueDeals();
    fetchOffers();
    setupSignalR();

    const interval = setInterval(fetchRescueDeals, 30000);

    return () => {
      if (signalrConnection.current) signalrConnection.current.stop();
      clearInterval(interval);
    };
  }, []);

  const buyRescueDeal = async (orderId) => {
    if (!selectedDeliveryAddress) {
      showToast("Please select or add a delivery address in your Profile tab first.");
      setActiveTab('profile');
      return;
    }

    if (!(await window.confirm("🔥 Confirm Flash Food Rescue Claim? The deal subtotal will be deducted from your DineDrop Wallet."))) return;

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
        showToast("⚡ Flash Rescue Claimed! Order is pre-prepared and ready for driver pickup.");
        setCart([]); setAppliedCoupon(null); setCouponCode('');
        fetchProfile();
        fetchRescueDeals();
        fetchMyOrders(true);
        fetchOrderDetails(result.orderId, true);
      } else {
        showToast(result.message || "Failed to claim Flash Rescue deal.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error claiming Flash Rescue deal: " + err.message);
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
      showToast("Error saving profile: " + err.message);
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
            area: road ? road : prev.area,
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
    const parts = (addr.addressLine || '').split(' | ');
    setNewAddress({
      name: parts.length >= 5 ? parts[0] : profileData?.name || '',
      mobile: parts.length >= 5 ? parts[1] : profileData?.phone || '',
      flat: parts.length >= 5 ? parts[2] : addr.addressLine || '',
      area: parts.length >= 5 ? parts[3] : '',
      landmark: parts.length >= 5 ? parts[4] : '',
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
    if ((!newAddress.flat && !newAddress.addressLine) || !newAddress.city) {
      showToast("Please enter address and city");
      return;
    }
    const addressLineStr = [newAddress.name, newAddress.mobile, newAddress.flat, newAddress.area, newAddress.landmark].join(' | ');
    const payload = {
      ...newAddress,
      addressLine: newAddress.flat || newAddress.area ? addressLineStr : newAddress.addressLine
    };
    const url = editingAddressId
      ? `http://localhost:5070/api/user/addresses/${editingAddressId}`
      : 'http://localhost:5070/api/user/addresses';
    const method = editingAddressId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (response.ok) {
        setShowAddAddressModal(false);
        setEditingAddressId(null);
        setNewAddress({ name: '', mobile: '', flat: '', area: '', landmark: '', addressLine: '', city: '', state: '', pincode: '', latitude: 11.1202, longitude: 76.1200, isDefault: false });
        fetchProfile();
      } else {
        const err = await response.json();
        showToast(err.message || "Failed to save address");
      }
    } catch (err) {
      showToast("Error saving address: " + err.message);
    }
  };

  const confirmDeleteAddress = async () => {
    if (!deleteAddressId) return;
    try {
      const response = await fetch(`http://localhost:5070/api/user/addresses/${deleteAddressId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        showToast("Address deleted successfully");
        setDeleteAddressId(null);
        fetchProfile();
      } else {
        showToast("Failed to delete address");
      }
    } catch (err) {
      showToast("Error deleting address: " + err.message);
    }
  };

  const cancelOrder = async (orderId, status) => {
    let msg = "Are you sure you want to cancel this order? Your refund will be credited to your DineDrop wallet.";
    if (status === 'Preparing' || status === 'Ready') {
      msg = "⚠️ This order is already prepared/preparing! Cancelling now will charge a 50% cancellation fee. You will receive a partial refund (50% subtotal + 100% delivery fee) to your wallet. Proceed?";
    }
    if (!(await window.confirm(msg))) return;
    try {
      const response = await fetch(`http://localhost:5070/api/customer/orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        showToast("Order cancelled successfully. Refund credited to DineDrop Wallet.");
        fetchMyOrders();
        fetchOrderDetails(orderId, false);
        fetchProfile();
        fetchRescueDeals(); // refresh list
      } else {
        const error = await response.json();
        showToast(error.message || "Failed to cancel order");
      }
    } catch (err) {
      showToast("Error cancelling order: " + err.message);
    }
  };

  const handleAddFunds = async () => {
    const amountInput = prompt("Enter amount to add to wallet (in ₹):", "50");
    if (!amountInput) return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid amount.");
      return;
    }

    try {
      // 1. Create Order on Backend
      const orderResponse = await fetch('http://localhost:5070/api/user/wallet/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      });
      if (!orderResponse.ok) {
        showToast("Failed to initiate payment");
        return;
      }
      const orderData = await orderResponse.json();

      // 2. Open Razorpay Checkout
      const options = {
        key: "rzp_test_SwdCmzSaHtuMRq", // Matching backend key
        amount: orderData.amount, // in subunits (paise)
        currency: "INR",
        name: "DineDrop",
        description: "Wallet Top-up",
        order_id: orderData.orderId,
        handler: async function (response) {
          // 3. Verify Payment
          try {
            const verifyResponse = await fetch('http://localhost:5070/api/user/wallet/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                amount: amount
              }),
              credentials: 'include'
            });

            if (verifyResponse.ok) {
              const result = await verifyResponse.json();
              showToast(result.message || "Funds added successfully!");
              fetchProfile();
            } else {
              showToast("Payment verification failed on server");
            }
          } catch (err) {
            console.error(err);
            showToast("Error verifying payment");
          }
        },
        theme: {
          color: "#00f3ff"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      showToast("Error processing payment");
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
          restaurantRating: 0,
          restaurantFeedback: "",
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
        showToast(errorData.message || "Failed to submit rating");
      }
    } catch (err) {
      showToast("Error submitting rating: " + err.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleRateRestaurant = async () => {
    if (!selectedRestaurant) return;
    setSubmittingBrowseRating(true);
    try {
      const response = await fetch(`http://localhost:5070/api/user/restaurants/${selectedRestaurant.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: browseRestRating,
          feedback: browseRestFeedback
        }),
        credentials: 'include'
      });
      if (response.ok) {
        setBrowseRatingSubmitted(true);
        showToast("Restaurant rating submitted!");
        fetchRestaurants(); 
      } else {
        const err = await response.json();
        showToast(err.message || "Failed to submit rating.");
      }
    } catch (err) {
      showToast("Error submitting rating.");
    } finally {
      setSubmittingBrowseRating(false);
    }
  };

  const executeAddToCart = (item, contextRest, dishContext) => {
    setCartRestaurant(contextRest);
    if (dishContext && !selectedRestaurant) {
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

  const confirmCartReset = () => {
    setCart([]); setAppliedCoupon(null); setCouponCode('');
    executeAddToCart(cartConflictModal.item, cartConflictModal.contextRest, cartConflictModal.dishContext);
    setCartConflictModal({ show: false, item: null, contextRest: null, dishContext: null });
  };

  const addToCart = (item, dishContext = null) => {
    const contextRest = dishContext || selectedRestaurant;

    if (cart.length > 0 && cartRestaurant && cartRestaurant.id !== contextRest.id) {
      setCartConflictModal({ show: true, item, contextRest, dishContext });
      return;
    }
    executeAddToCart(item, contextRest, dishContext);
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (!selectedDeliveryAddress) {
      showToast("Please select or add a delivery address first.");
      return;
    }
    const targetRest = cartRestaurant || selectedRestaurant;
    const addressObj = profileData?.addresses?.find(a => a.id === selectedDeliveryAddress);
    if (addressObj && targetRest) {
      const dist = getDistanceFromLatLonInKm(targetRest.latitude, targetRest.longitude, addressObj.latitude, addressObj.longitude);
      if (dist > 30) {
        showToast(`Delivery address (${addressObj.addressLine}) is ${dist.toFixed(1)} km away from ${targetRest.name}. We only deliver within a 30 km radius.`);
        return;
      }
    }
    setIsPlacingOrder(true);
    try {
      let dist = 5;
      if (addressObj && targetRest) {
        dist = getDistanceFromLatLonInKm(targetRest.latitude, targetRest.longitude, addressObj.latitude, addressObj.longitude);
      }
      const deliveryCharge = Math.max(5, Math.round(dist * 2));
      const platformFee = 20.00;
      const subtotal = Math.max(0, cartTotal - (appliedCoupon ? appliedCoupon.discountAmount : 0));
      const gstOnFood = subtotal * 0.05;
      const gstOnDeliveryAndPlatform = (platformFee + deliveryCharge) * 0.18;
      const totalGst = gstOnFood + gstOnDeliveryAndPlatform;
      const finalAmount = Math.max(0, subtotal + platformFee + deliveryCharge + totalGst);

      const orderDto = {
        restaurantId: targetRest.id,
        addressId: selectedDeliveryAddress,
        items: cart.map(i => ({ menuItemId: i.id, quantity: i.quantity })),
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        paymentMethod: paymentMethod
      };

      if (paymentMethod === 'Wallet' || paymentMethod === 'COD') {
        const placeResp = await fetch('http://localhost:5070/api/customer/orders/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderDto),
          credentials: 'include'
        });

        if (placeResp.ok) {
          const data = await placeResp.json();
          setCart([]); setAppliedCoupon(null); setCouponCode('');
          setSelectedRestaurant(null);
          fetchMyOrders(false);
          fetchOrderDetails(data.orderId);
          fetchProfile();
          showToast(`Order placed successfully using ${paymentMethod}!`);
        } else {
          const err = await placeResp.json();
          showToast(err.message || `Failed to place order using ${paymentMethod}.`);
        }
        setIsPlacingOrder(false);
        return;
      }

      // 1. Create Order on Backend for Razorpay amount
      const rzpOrderResp = await fetch('http://localhost:5070/api/user/wallet/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalAmount }),
        credentials: 'include'
      });
      if (!rzpOrderResp.ok) {
        showToast("Failed to initiate secure payment.");
        setIsPlacingOrder(false);
        return;
      }
      const rzpOrderData = await rzpOrderResp.json();

      // 2. Open Razorpay Checkout
      const options = {
        key: "rzp_test_SwdCmzSaHtuMRq", // Matching backend key
        amount: rzpOrderData.amount, // in paise
        currency: "INR",
        name: "DineDrop",
        description: `Order from ${targetRest.name}`,
        order_id: rzpOrderData.orderId,
        handler: async function (response) {
          try {
            // 3a. Verify Payment to Top-Up Wallet
            const verifyResp = await fetch('http://localhost:5070/api/user/wallet/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: finalAmount,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              }),
              credentials: 'include'
            });

            if (!verifyResp.ok) {
              showToast("Payment verification failed. Order not placed.");
              setIsPlacingOrder(false);
              return;
            }

            // 3b. Payment Success - Place actual order
            const placeResp = await fetch('http://localhost:5070/api/customer/orders/place', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(orderDto),
              credentials: 'include'
            });

            if (placeResp.ok) {
              const data = await placeResp.json();
              setCart([]); setAppliedCoupon(null); setCouponCode('');
              setSelectedRestaurant(null);
              fetchMyOrders(false);
              fetchOrderDetails(data.orderId);
              fetchProfile();
            } else {
              const err = await placeResp.json();
              showToast(err.message || "Failed to place order after payment.");
            }
          } catch (err) {
            showToast("Error placing order: " + err.message);
          } finally {
            setIsPlacingOrder(false);
          }
        },
        prefill: {
          name: profileData?.name || "Customer",
          contact: profileData?.mobileNumber || "9999999999"
        },
        theme: { color: "#00f3ff" },
        modal: {
          ondismiss: function() {
            setIsPlacingOrder(false);
            showToast("Payment cancelled.");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      showToast("Error: " + err.message);
      setIsPlacingOrder(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
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
        
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
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
            { id: 'cart', icon: '🛒', label: 'Tray' },
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
      <main style={{ marginLeft: '280px', flex: 1, padding: '60px 80px', paddingBottom: cart.length > 0 && cartRestaurant && activeTab !== 'cart' ? '120px' : '60px' }}>

        {/* Top Location Header */}
        {activeTab === 'browse' && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', position: 'relative', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div onClick={() => setShowMap(!showMap)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <span style={{ fontWeight: '900', fontSize: '1.4rem', color: '#fff', borderBottom: '2px solid #fff', paddingBottom: '2px' }}>
                {userLocationName || 'Select Location'}
              </span>
              <span style={{ color: '#888', fontSize: '1.1rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userLocationFull ? userLocationFull.replace(userLocationName + ', ', '') : ''}
              </span>
              <span style={{ color: '#f39c12', fontSize: '1.2rem', marginLeft: '5px', transform: showMap ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                ▼
              </span>
            </div>

            {userLocation && (
              <button
                onClick={() => {
                  setUserLocation(null);
                  setUserLocationName('');
                  setUserLocationFull('');
                  setNearbyOnly(false);
                }}
                title="Clear location to view all restaurants"
                style={{ background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.2)', color: '#ff4d4d', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '16px', fontSize: '0.9rem', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 77, 0.2)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                ✕
              </button>
            )}
          </div>

          {showMap && (
            <div className="glass card" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '20px', width: '500px', maxHeight: '80vh', overflowY: 'auto', padding: '24px', borderRadius: '24px', background: '#111', border: '1px solid rgba(0, 243, 255, 0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 1000 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Search Delivery Location</h3>
                <button onClick={() => setShowMap(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>

              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <input
                  type="text"
                  value={searchLocationText}
                  onChange={(e) => setSearchLocationText(e.target.value)}
                  placeholder="Search for area, street name..."
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', paddingRight: '40px' }}
                />

                {searchLocationText && !isSearchingLocation && (
                  <button onClick={() => { setSearchLocationText(''); setLocationSuggestions([]); }} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem', padding: '0', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#fff'} onMouseLeave={(e) => e.target.style.color = '#888'}>✕</button>
                )}

                {isSearchingLocation && (
                  <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', background: '#00f3ff', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
                    <div style={{ width: '6px', height: '6px', background: '#00f3ff', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
                    <div style={{ width: '6px', height: '6px', background: '#00f3ff', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                  </div>
                )}

                {/* Suggestions Dropdown */}
                {locationSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '5px', background: '#1a1a1a', border: '1px solid rgba(0, 243, 255, 0.2)', borderRadius: '12px', zIndex: 1000, overflow: 'hidden' }}>
                    {locationSuggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectLocation(suggestion.lat, suggestion.lon, suggestion.display_name)}
                        style={{ padding: '14px 16px', borderBottom: idx < locationSuggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 243, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: '#00f3ff', fontSize: '1.2rem' }}>📍</span>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{suggestion.display_name.split(',')[0]}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{suggestion.display_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleLocateMe} style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(0, 243, 255, 0.1)', border: '1px solid rgba(0, 243, 255, 0.3)', color: '#00f3ff', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px', fontWeight: '700' }}>
                <span style={{ fontSize: '1.2rem' }}>🎯</span> Get current location <br /><span style={{ fontSize: '0.75rem', fontWeight: '400', color: '#888', marginLeft: 'auto' }}>Using GPS</span>
              </button>

              {recentSearches.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '800', letterSpacing: '1px' }}>RECENT SEARCHES</span>
                    <button onClick={handleClearRecentSearches} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>CLEAR</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentSearches.map((search, idx) => (
                      <div key={idx} onClick={() => selectLocation(search.lat, search.lon, search.displayName)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 0' }}>
                        <span style={{ color: '#888', fontSize: '1.2rem' }}>🕒</span>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: '#fff', fontWeight: '600' }}>{search.displayName.split(',')[0]}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>{search.displayName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

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
                      CRAVE. RESCUE.<br />ENJOY.
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
                          <span style={{ fontSize: '0.8rem', color: '#666', textDecoration: 'line-through', marginRight: '6px' }}>₹34.00</span>
                          <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#00f3ff' }}>₹17.00</span>
                        </div>
                        <span style={{ fontSize: '1.5rem' }}>🥩</span>
                      </div>
                    </div>
                    {/* Background glow behind preview card */}
                    <div style={{ position: 'absolute', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(0, 243, 255, 0.15)', filter: 'blur(60px)', zIndex: -1 }}></div>
                  </div>
                </div>

                {/* Promotional Deals Grid */}
                {availableOffers && availableOffers.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '48px' }}>
                    {availableOffers.map((offer, index) => {
                      const icons = ['🎁', '💳', '🛵', '🔥', '🌟'];
                      const icon = icons[index % icons.length];
                      return (
                        <div key={offer.id || index} className="promo-card" style={{ background: 'rgba(10, 10, 10, 0.4)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.border = '1px solid rgba(0, 243, 255, 0.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)'; }}>
                          <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '12px' }}>{icon}</span>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#fff', marginBottom: '6px' }}>
                            {offer.type === 'Percentage' || offer.type === 0 ? `${offer.value}% OFF` : `FLAT ₹${offer.value} OFF`}
                          </h4>
                          <p style={{ color: '#aaa', fontSize: '0.82rem', margin: '0 0 16px 0' }}>
                            Get {offer.type === 'Percentage' || offer.type === 0 ? `${offer.value}%` : `₹${offer.value}`} off your entire order. Valid on orders above ₹{offer.minOrderAmount}.
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#00f3ff', fontWeight: '800', background: 'rgba(0, 243, 255, 0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(0, 243, 255, 0.15)' }}>{offer.code}</span>
                            <span style={{ fontSize: '0.75rem', color: '#2ecc71', fontWeight: '600' }}>Active Offer</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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
                      { id: 'top-rated', name: 'Top Rated', icon: '⭐' },
                      { id: 'pizza', name: 'Pizza', icon: '🍕' },
                      { id: 'burger', name: 'Burger', icon: '🍔' },
                      { id: 'sushi', name: 'Sushi', icon: '🍣' },
                      { id: 'healthy', name: 'Healthy', icon: '🥗' },
                      { id: 'dessert', name: 'Dessert', icon: '🍩' },
                      { id: 'coffee', name: 'Coffee', icon: '☕' },
                      { id: 'indian', name: 'Indian', icon: '🍛' },
                      { id: 'chinese', name: 'Chinese', icon: '🥡' }
                    ].map(cat => {
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
                </header>

                {(() => {
                  const filteredList = restaurants
                    .filter(r => {
                      if (!selectedCategory) return true;
                      if (selectedCategory === 'top-rated') return r.rating >= 4.0;
                      return r.categories && r.categories.some(c => c.toLowerCase() === selectedCategory.toLowerCase());
                    })
                    .filter(r => {
                      if (!nearbyOnly || !userLocation) return true;
                      const dist = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, r.latitude, r.longitude);
                      return dist <= 30;
                    })
                    .sort((a, b) => {
                      if (a.isOpen && !b.isOpen) return -1;
                      if (!a.isOpen && b.isOpen) return 1;
                      return (b.rating || 0) - (a.rating || 0);
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
                                background: res.imageUrl ? `url(http://localhost:5070${res.imageUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(0, 243, 255, 0.08), rgba(0, 112, 255, 0.03))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                position: 'relative'
                              }}>
                                {!res.imageUrl && (
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
                                )}
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
                                  <span style={{ color: '#666', fontSize: '0.78rem', fontWeight: '800', letterSpacing: '1px' }}>🍽️ {res.dishCount || 0} DISHES</span>
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
                  background: selectedRestaurant.imageUrl ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(http://localhost:5070${selectedRestaurant.imageUrl}) center/cover no-repeat` : 'linear-gradient(135deg, rgba(0, 243, 255, 0.15), rgba(0, 112, 255, 0.05))',
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
                      <div 
                        onClick={() => setShowBrowseRatingUI(!showBrowseRatingUI)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(241, 196, 15, 0.1)', padding: '5px 12px', borderRadius: '10px', border: '1px solid rgba(241, 196, 15, 0.2)', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(241, 196, 15, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(241, 196, 15, 0.1)'}
                      >
                        <span style={{ color: '#f1c40f', fontSize: '0.85rem' }}>⭐</span>
                        <span style={{ color: '#f1c40f', fontWeight: '900', fontSize: '0.85rem' }}>{selectedRestaurant.rating.toFixed(1)} / 5.0</span>
                      </div>
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>•</span>
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: '600' }}>🏪 {selectedRestaurant.address || "Location not provided"}</span>
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>•</span>
                      <span style={{ color: '#aaa', fontSize: '0.9rem', fontWeight: '600' }}>📞 {selectedRestaurant.contactNumber || "No contact"}</span>
                    </div>
                  </div>
                  {showBrowseRatingUI ? (
                    <div className="glass" style={{ 
                      position: 'absolute',
                      top: '50%',
                      right: '40px',
                      transform: 'translateY(-50%)',
                      padding: '24px', 
                      borderRadius: '24px', 
                      border: '1px solid rgba(0, 243, 255, 0.2)', 
                      background: 'linear-gradient(145deg, rgba(0, 243, 255, 0.05) 0%, rgba(0,0,0,0.6) 100%)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      animation: 'fadeIn 0.3s ease-out'
                    }}>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '900', margin: '0 0 16px 0', color: '#00f3ff', letterSpacing: '-0.5px' }}>RATE YOUR EXPERIENCE</h4>
                      {browseRatingSubmitted ? (
                        <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.2)', textAlign: 'center' }}>
                          <span style={{ fontSize: '1.8rem' }}>✨</span>
                          <p style={{ margin: '8px 0 0 0', fontSize: '1.05rem', fontWeight: '800', color: '#2ecc71' }}>Thank you for your feedback!</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '350px' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                onClick={() => setBrowseRestRating(star)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: '2rem', color: star <= browseRestRating ? '#f1c40f' : '#333',
                                  padding: 0, transition: 'all 0.2s',
                                  filter: star <= browseRestRating ? 'drop-shadow(0 0 8px rgba(241, 196, 15, 0.5))' : 'none'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >★</button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input
                              type="text"
                              placeholder="Tell us what you loved..."
                              value={browseRestFeedback}
                              onChange={e => setBrowseRestFeedback(e.target.value)}
                              style={{
                                width: '100%', padding: '12px 16px', borderRadius: '14px',
                                background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                                color: '#fff', fontSize: '0.95rem', outline: 'none', fontFamily: 'Outfit, sans-serif',
                                transition: 'all 0.3s'
                              }}
                              onFocus={(e) => { e.target.style.border = '1px solid rgba(0, 243, 255, 0.5)'; e.target.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.1)'; }}
                              onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                            />
                            <button
                              onClick={handleRateRestaurant}
                              disabled={submittingBrowseRating}
                              className="neon-btn"
                              style={{
                                width: '100%', background: 'linear-gradient(135deg, #00f3ff 0%, #0070ff 100%)', color: '#000', border: 'none',
                                padding: '12px', borderRadius: '14px', fontWeight: '900', cursor: submittingBrowseRating ? 'not-allowed' : 'pointer',
                                fontSize: '0.95rem', boxShadow: '0 0 20px rgba(0,243,255,0.4)', transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => { if(!submittingBrowseRating) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                              onMouseLeave={(e) => { if(!submittingBrowseRating) e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                              {submittingBrowseRating ? 'SUBMITTING...' : 'SUBMIT'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '7rem', opacity: 0.25, transform: 'rotate(-10deg)', userSelect: 'none' }}>🍽️</div>
                  )}
                </div>


                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '48px', alignItems: 'flex-start' }}>
                  {/* Left Column: Menu list */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.5px', margin: 0 }}>Available Offerings</h3>
                      <span style={{ color: '#666', fontSize: '0.88rem', fontWeight: '700' }}>{menu.length} CHEF SELECTIONS</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {menu.map(item => (
                        <div key={item.id} className="dish-card" style={{ opacity: item.isAvailable ? 1 : 0.4, pointerEvents: item.isAvailable ? 'auto' : 'none' }}>
                          <div style={{ width: '130px', height: '130px', borderRadius: '18px', background: 'rgba(0,0,0,0.3)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.03)', position: 'relative' }}>
                            {item.imageUrl ? (
                              <img src={`http://localhost:5070${item.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: item.isAvailable ? 'none' : 'grayscale(100%)' }} alt={item.name} />
                            ) : (
                              <span style={{ fontSize: '2.8rem', filter: item.isAvailable ? 'none' : 'grayscale(100%)' }}>🍔</span>
                            )}
                            {!item.isAvailable && (
                               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                                 <span style={{ color: '#fff', fontWeight: '800', fontSize: '0.8rem', background: 'rgba(255,0,0,0.8)', padding: '4px 8px', borderRadius: '8px' }}>SOLD OUT</span>
                               </div>
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '14px', height: '14px', border: `1px solid ${item.isVeg ? '#2ecc71' : '#e74c3c'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px'
                                  }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.isVeg ? '#2ecc71' : '#e74c3c' }}></div>
                                  </div>
                                  <h4 style={{ fontSize: '1.2rem', fontWeight: '850', color: '#fff', margin: 0 }}>{item.name}</h4>
                                </div>
                                <span style={{ fontSize: '1.25rem', fontWeight: '950', color: item.isAvailable ? '#00f3ff' : '#888' }}>₹{item.price.toFixed(2)}</span>
                              </div>
                              <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: '1.4', marginTop: '6px', marginBottom: '16px' }}>{item.description}</p>
                            </div>
                            <button onClick={() => addToCart(item)} className="neon-btn" disabled={!item.isAvailable} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '900', fontSize: '0.8rem', width: 'fit-content', background: item.isAvailable ? '' : 'rgba(255,255,255,0.1)', color: item.isAvailable ? '' : '#555', border: item.isAvailable ? '' : 'none', cursor: item.isAvailable ? 'pointer' : 'not-allowed' }}>
                              {item.isAvailable ? '+ ADD TO TRAY' : 'UNAVAILABLE'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

{
  activeTab === 'cart' && (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '5px' }}>Your Tray</h2>
      {cartRestaurant && cart.length > 0 && <p style={{ color: '#888', fontSize: '1rem', marginBottom: '20px' }}>Ordering from <span style={{ color: '#fff', fontWeight: '700' }}>{cartRestaurant.name}</span></p>}

      <div style={{ maxWidth: '800px' }}>
        {cart.length === 0 ? (
          <div className="glass" style={{ textAlign: 'center', padding: '60px 0', color: '#444', borderRadius: '24px' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>📭</span>
            <p style={{ fontWeight: '700', fontSize: '1.1rem', color: '#666', margin: 0 }}>Tray is currently empty</p>
            <p style={{ fontSize: '0.9rem', color: '#444', marginTop: '8px' }}>Browse available restaurants and add dishes to checkout.</p>
            <button onClick={() => setActiveTab('browse')} className="neon-btn" style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '14px', fontWeight: '800' }}>BROWSE MENUS</button>
          </div>
        ) : (
          <div className="glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5, 5, 5, 0.8)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <p style={{ fontWeight: '700', color: '#fff', fontSize: '1rem', margin: 0 }}>{item.quantity}x {item.name}</p>
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: '4px 0 0 0' }}>₹{item.price.toFixed(2)} ea</p>
                  </div>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ fontWeight: '900', color: '#eee', fontSize: '1rem' }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      style={{ background: 'rgba(255,0,0,0.08)', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1rem', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,0,0,0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,0,0,0.08)'}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '15px', marginBottom: '10px' }}>
              <button 
                onClick={() => {
                  if (cartRestaurant) {
                    fetchMenu(cartRestaurant);
                    setActiveTab('browse');
                  }
                }}
                className="neon-btn"
                style={{
                  background: 'rgba(0, 243, 255, 0.05)',
                  border: '1px solid rgba(0, 243, 255, 0.2)',
                  color: '#00f3ff',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 243, 255, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 243, 255, 0.05)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                + ADD MORE ITEMS FROM {cartRestaurant?.name.toUpperCase()}
              </button>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '12px' }}>
                <span>Subtotal</span>
                <span style={{ color: '#eee', fontWeight: '600' }}>₹{cartTotal.toFixed(2)}</span>
              </div>

              {/* Deals Carousel */}
              {(() => {
                const targetRest = cartRestaurant;
                const eligibleOffers = availableOffers.filter(o =>
                  !o.restaurantId || (targetRest && o.restaurantId === targetRest.id)
                ).sort((a, b) => {
                  const aEligible = cartTotal >= a.minOrderAmount ? 1 : 0;
                  const bEligible = cartTotal >= b.minOrderAmount ? 1 : 0;
                  return bEligible - aEligible;
                });
                if (eligibleOffers.length === 0) return null;
                return (
                  <div style={{ marginBottom: '20px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>Deals for you</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => dealsContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        >
                          ←
                        </button>
                        <button 
                          onClick={() => dealsContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        >
                          →
                        </button>
                      </div>
                    </div>
                    <div ref={dealsContainerRef} style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}>
                      {eligibleOffers.map(offer => {
                        const isEligible = cartTotal >= offer.minOrderAmount;
                        return (
                          <div key={offer.id}
                            onClick={() => {
                              if (isEligible) setCouponCode(offer.code);
                            }}
                            style={{
                              flex: '0 0 auto',
                              width: '220px',
                              padding: '12px 16px',
                              borderRadius: '16px',
                              background: isEligible ? 'rgba(0, 243, 255, 0.05)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${isEligible ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                              cursor: isEligible ? 'pointer' : 'not-allowed',
                              opacity: isEligible ? 1 : 0.4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'transform 0.2s, box-shadow 0.2s'
                            }}
                            onMouseEnter={(e) => { if (isEligible) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,243,255,0.1)'; } }}
                            onMouseLeave={(e) => { if (isEligible) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; } }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0, 243, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#00f3ff' }}>%</div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.2px' }}>{offer.type === 'Percentage' || offer.type === 0 ? `${offer.value}% Off` : `Flat ₹${offer.value} Off`}</p>
                              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: '#888', fontWeight: '800', letterSpacing: '0.5px' }}>USE {offer.code}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="PROMO CODE"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    disabled={appliedCoupon !== null}
                    style={{ flex: 1, padding: '10px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.85rem', outline: 'none', textTransform: 'uppercase', letterSpacing: '1px' }}
                  />
                  {appliedCoupon ? (
                    <button onClick={handleRemoveCoupon} style={{ padding: '0 20px', borderRadius: '10px', background: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.2)', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem' }}>REMOVE</button>
                  ) : (
                    <button onClick={handleApplyCoupon} style={{ padding: '0 20px', borderRadius: '10px', background: 'rgba(0, 243, 255, 0.1)', color: '#00f3ff', border: '1px solid rgba(0, 243, 255, 0.2)', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem' }}>APPLY</button>
                  )}
                </div>
                {appliedCoupon && (
                  <p style={{ fontSize: '0.8rem', color: '#2ecc71', margin: '6px 0 0 0', fontWeight: '600' }}>✓ {appliedCoupon.message}</p>
                )}
              </div>

              {appliedCoupon && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#2ecc71', marginBottom: '12px' }}>
                  <span>Discount ({appliedCoupon.code})</span>
                  <span style={{ fontWeight: '600' }}>-₹{appliedCoupon.discountAmount.toFixed(2)}</span>
                </div>
              )}

              {(() => {
                const targetRest = cartRestaurant || selectedRestaurant;
                const addressObj = profileData?.addresses?.find(a => a.id === selectedDeliveryAddress);
                let dist = 5;
                if (targetRest && addressObj) {
                  dist = getDistanceFromLatLonInKm(targetRest.latitude, targetRest.longitude, addressObj.latitude, addressObj.longitude);
                }
                const deliveryCharge = Math.max(5, Math.round(dist * 2));
                const platformFee = 20.00;
                const subtotal = Math.max(0, cartTotal - (appliedCoupon ? appliedCoupon.discountAmount : 0));
                const gstOnFood = subtotal * 0.05;
                const gstOnDeliveryAndPlatform = (platformFee + deliveryCharge) * 0.18;
                const totalGst = gstOnFood + gstOnDeliveryAndPlatform;
                const finalAmount = Math.max(0, subtotal + platformFee + deliveryCharge + totalGst);

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '16px' }}>
                      <span>Delivery Fee</span>
                      <span style={{ color: '#eee', fontWeight: '600' }}>₹{deliveryCharge.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '16px' }}>
                      <span>Platform Fee</span>
                      <span style={{ color: '#eee', fontWeight: '600' }}>₹{platformFee.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '16px' }}>
                      <span>GST (Taxes)</span>
                      <span style={{ color: '#eee', fontWeight: '600' }}>₹{totalGst.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '900', marginBottom: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                      <span>Total</span>
                      <span style={{ color: '#00f3ff' }}>₹{finalAmount.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '8px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>DELIVERY ADDRESS</label>
                {profileData.addresses && profileData.addresses.length > 0 ? (
                  <select
                    value={selectedDeliveryAddress || ''}
                    onChange={e => setSelectedDeliveryAddress(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
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
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '800' }}
                  >
                    + ADD DELIVERY ADDRESS
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '8px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>PAYMENT METHOD</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div onClick={() => setPaymentMethod('Online')} style={{ flex: 1, padding: '12px', background: paymentMethod === 'Online' ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)', border: paymentMethod === 'Online' ? '1px solid #00f3ff' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <span style={{ color: paymentMethod === 'Online' ? '#00f3ff' : '#aaa', fontWeight: '800', fontSize: '0.9rem' }}>Net Banking</span>
                  </div>
                  <div onClick={() => setPaymentMethod('Wallet')} style={{ flex: 1, padding: '12px', background: paymentMethod === 'Wallet' ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)', border: paymentMethod === 'Wallet' ? '1px solid #00f3ff' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <span style={{ color: paymentMethod === 'Wallet' ? '#00f3ff' : '#aaa', fontWeight: '800', fontSize: '0.9rem' }}>Wallet</span>
                  </div>
                  <div onClick={() => setPaymentMethod('COD')} style={{ flex: 1, padding: '12px', background: paymentMethod === 'COD' ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)', border: paymentMethod === 'COD' ? '1px solid #00f3ff' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <span style={{ color: paymentMethod === 'COD' ? '#00f3ff' : '#aaa', fontWeight: '700', fontSize: '0.9rem' }}>Cash on Delivery</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || !selectedDeliveryAddress || cart.length === 0}
              className="neon-btn"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                fontWeight: '900',
                fontSize: '1rem',
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                boxShadow: '0 8px 24px rgba(46, 204, 113, 0.2)'
              }}
            >
              {isPlacingOrder ? 'TRANSMITTING ORDER…' : 'PLACE ORDER'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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
          <>
            {paginatedHistory.map(order => (
              <div key={order.id} className="glass" style={{ padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{order.restaurantName}</h4>
                  <p style={{ color: '#666', fontSize: '0.85rem' }}>{new Date(order.createdAt).toLocaleDateString()} • {order.itemCount} items</p>
                </div>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '800' }}>₹{order.totalAmount.toFixed(2)}</p>
                    <span style={{ color: getStatusColor(order.status), fontSize: '0.8rem', fontWeight: '800', letterSpacing: '1px' }}>{order.status.toUpperCase()}</span>
                  </div>
                  <button onClick={() => fetchOrderDetails(order.id)} style={{ padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: '600' }}>Details</button>
                </div>
              </div>
            ))}
            <Pagination currentPage={historyPage} totalPages={totalHistoryPages} onPageChange={setHistoryPage} />
          </>
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
              {['Placed', 'Accepted', 'Preparing', 'Ready', 'Picked', 'Delivered'].map((step, i) => {
                const steps = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Picked', 'Delivered'];
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
              <span style={{ fontWeight: '700' }}>₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '20px', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '10px' }}>
            <span>Subtotal</span>
            <span>₹{(trackingOrder.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) - (trackingOrder.discountAmount || 0)).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '10px' }}>
            <span>Delivery Fee</span>
            <span>₹{(trackingOrder.deliveryFee || 5).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '10px' }}>
            <span>Platform Fee</span>
            <span>₹20.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#888', marginBottom: '20px' }}>
            <span>GST (Taxes)</span>
            <span>₹{(trackingOrder.totalAmount - (trackingOrder.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) - (trackingOrder.discountAmount || 0)) - (trackingOrder.deliveryFee || 5) - 20).toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '800', marginBottom: trackingOrder.status === 'Placed' ? '20px' : '0' }}>
            <span>Total</span>
            <span style={{ color: '#00f3ff' }}>₹{trackingOrder.totalAmount.toFixed(2)}</span>
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


                  {/* Driver Rating */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '0.78rem', color: '#eee', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                      Rate Driver: <span style={{ color: '#00f3ff' }}>{trackingOrder.driverName || 'Delivery Partner'}</span>
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

{
  activeTab === 'profile' && (
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
                  <input type="text" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>PHONE</label>
                  <input type="text" value={profileData.phone} placeholder="+1 234 567 8900" onChange={e => setProfileData({ ...profileData, phone: e.target.value })} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} />
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
                    onChange={e => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                    style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', colorScheme: 'dark', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>GENDER</label>
                  <select value={profileData.gender || ''} onChange={e => setProfileData({ ...profileData, gender: e.target.value })} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: profileData.gender ? '#fff' : '#666', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                    <option value="" style={{ color: '#666' }}>Select gender</option>
                    <option value="Male" style={{ color: '#fff' }}>Male</option>
                    <option value="Female" style={{ color: '#fff' }}>Female</option>
                    <option value="Non-binary" style={{ color: '#fff' }}>Non-binary</option>
                    <option value="Prefer not to say" style={{ color: '#fff' }}>Prefer not to say</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.78rem', color: '#888', marginBottom: '6px', display: 'block', fontWeight: '600', letterSpacing: '0.5px' }}>PROFILE IMAGE URL (OPTIONAL)</label>
                  <input type="text" value={profileData.profileImageUrl || ''} placeholder="https://example.com/your-photo.jpg" onChange={e => setProfileData({ ...profileData, profileImageUrl: e.target.value || null })} style={{ width: '100%', padding: '13px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.95rem', boxSizing: 'border-box' }} />
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
              <button onClick={handleAddFunds} style={{ padding: '6px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: '1px solid #2ecc71', cursor: 'pointer', fontWeight: '800', fontSize: '0.8rem' }}>+ ADD FUNDS</button>
            </div>
            <p style={{ color: '#888', marginBottom: '10px' }}>Available Balance</p>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900', color: '#fff' }}>₹{(profileData.walletBalance || 0).toFixed(2)}</h1>
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
          <button onClick={() => { setEditingAddressId(null); setNewAddress({ name: profileData?.name || '', mobile: profileData?.phone || '', flat: '', area: '', landmark: '', addressLine: '', city: '', state: '', pincode: '', latitude: 11.1202, longitude: 76.1200, isDefault: false }); setShowAddAddressModal(true); }} className="neon-btn" style={{ padding: '8px 16px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem' }}>+ ADD NEW</button>
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
                  <button onClick={() => setDeleteAddressId(addr.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontWeight: '700' }}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Address Confirm Modal */}
      {deleteAddressId && (
        <div onClick={() => setDeleteAddressId(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="glass card" style={{ width: '400px', padding: '32px', borderRadius: '24px', background: '#0a0a0a', border: '1px solid rgba(255, 77, 77, 0.3)', textAlign: 'center', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🗑️</div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '10px' }}>Delete Address?</h3>
            <p style={{ color: '#888', marginBottom: '32px' }}>Are you sure you want to remove this delivery address? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setDeleteAddressId(null)} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteAddress} className="neon-btn" style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.5)', color: '#ff4d4d', fontWeight: '800', cursor: 'pointer', boxShadow: '0 0 15px rgba(255, 77, 77, 0.2)' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Address Modal */}
      {showAddAddressModal && (
        <div onClick={() => setShowAddAddressModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="glass card" style={{ width: '500px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', padding: '40px', borderRadius: '32px', background: '#0a0a0a', border: '1px solid rgba(0, 243, 255, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{editingAddressId ? 'Edit Delivery Address' : 'Add Delivery Address'}</h3>
              <button onClick={() => setShowAddAddressModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Name</label>
                  <input type="text" placeholder="John Doe" value={newAddress.name} onChange={e => setNewAddress({ ...newAddress, name: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Mobile number</label>
                  <input type="text" placeholder="1234567890" value={newAddress.mobile} onChange={e => setNewAddress({ ...newAddress, mobile: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Flat, house no, building, company, Apartment</label>
                <input type="text" placeholder="Apt 4B, XYZ Building" value={newAddress.flat} onChange={e => setNewAddress({ ...newAddress, flat: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Area, Street, Village</label>
                  <input type="text" placeholder="Main Street" value={newAddress.area} onChange={e => setNewAddress({ ...newAddress, area: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Landmark</label>
                  <input type="text" placeholder="Near Apollo Hospital" value={newAddress.landmark} onChange={e => setNewAddress({ ...newAddress, landmark: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Town/City</label>
                  <input type="text" placeholder="Springfield" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>State & Country</label>
                  <input type="text" placeholder="IL, USA" value={newAddress.state} onChange={e => setNewAddress({ ...newAddress, state: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'block', fontWeight: '600' }}>Pincode</label>
                  <input type="text" placeholder="62701" value={newAddress.pincode} onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value })} style={{ width: '100%', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="isDefault" checked={newAddress.isDefault} onChange={e => setNewAddress({ ...newAddress, isDefault: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                <label htmlFor="isDefault" style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '600' }}>Mark as default Address</label>
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
  )
}

{/* Sticky Bottom Cart Banner */ }
{
  cart.length > 0 && cartRestaurant && activeTab === 'browse' && (
    <div className="glass" style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderRadius: '20px', background: 'rgba(0, 243, 255, 0.1)', border: '1px solid rgba(0, 243, 255, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 1000, cursor: 'pointer', transition: 'transform 0.2s', animation: 'popupBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-50%) translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(-50%) translateY(0)'} onClick={() => { setActiveTab('cart'); setSelectedRestaurant(null); }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Tray • {cartRestaurant.name}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>{cart.reduce((sum, item) => sum + item.quantity, 0)} Items | ₹{cartTotal.toFixed(2)}</p>
      </div>
      <button className="neon-btn" style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '900', letterSpacing: '1px' }}>VIEW TRAY →</button>
    </div>
  )
}
      </main >

  {/* Cart Conflict Modal */ }
{
  cartConflictModal.show && (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass" style={{ width: '500px', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', border: '1px solid rgba(0, 243, 255, 0.2)', background: 'rgba(10, 10, 10, 0.95)', fontFamily: "'Inter', sans-serif" }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.6rem', fontWeight: '800', color: '#fff' }}>Items already in tray</h2>
        <p style={{ margin: '0 0 32px 0', fontSize: '1rem', color: '#aaa', lineHeight: '1.6' }}>
          Your tray contains items from another restaurant. Would you like to clear your tray to add items from this restaurant?
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => setCartConflictModal({ show: false, item: null, contextRest: null, dishContext: null })}
            style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            CANCEL
          </button>
          <button
            onClick={confirmCartReset}
            className="neon-btn"
            style={{ flex: 1, padding: '14px', borderRadius: '14px', fontWeight: '900', fontSize: '0.9rem', letterSpacing: '0.5px' }}
          >
            YES, START AFRESH
          </button>
        </div>
      </div>
    </div>
  )
}
      {/* Scroll to Top Button */}
      {showScrollTop && activeTab === 'browse' && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="glass neon-btn"
          title="Go to top"
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            zIndex: 9999,
            padding: 0,
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          ↑
        </button>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(231, 76, 60, 0.95)',
          color: '#fff',
          padding: '16px 32px',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '1rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 10000,
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {toastMessage}
        </div>
      )}
    </div >
  );
};

export default HomePage;
