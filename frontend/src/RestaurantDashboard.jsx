import { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import * as signalR from "@microsoft/signalr";
import LocationPicker from './LocationPicker';
import WalletView from './WalletView';

const RestaurantDashboard = ({ onLogout }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('restaurant_active_tab') || 'overview';
  });

  useEffect(() => {
    localStorage.setItem('restaurant_active_tab', activeTab);
  }, [activeTab]);
  
  // Profile state
  const [profile, setProfile] = useState({ name: '', description: '', address: '', businessType: '', businessHours: '', isOpen: true, latitude: '', longitude: '' });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const signalrConnection = useRef(null);
  
  // Offers state
  const [offers, setOffers] = useState([]);
  const [newOffer, setNewOffer] = useState({ id: null, code: '', discountAmount: '', isPercentage: false, minimumOrderValue: '', expiresAt: '' });
  const [showOfferForm, setShowOfferForm] = useState(false);

  // Pagination state for history
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 8;

  // Stats state
  const [stats, setStats] = useState({ todayRevenue: 0, activeOrdersCount: 0, totalOrdersCount: 0, averageOrderValue: 0, revenueChart: [] });

  // Form states
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', categoryName: '', isAvailable: true, isVeg: true });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // Edit/Delete states
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  useEffect(() => {
    fetchActiveOrders();
    fetchHistory();
    fetchStats();
    fetchOffers();
    fetchProfileData();
    return () => {
      if (signalrConnection.current) signalrConnection.current.stop();
    };
  }, []);

  useEffect(() => {
    if (profile.id && !signalrConnection.current) {
      setupSignalR(profile.id);
    }
  }, [profile.id]);

  const setupSignalR = async (restaurantId) => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl("http://localhost:5070/orderHub")
      .withAutomaticReconnect()
      .build();

    connection.on("NewOrderReceived", (data) => {
      fetchActiveOrders();
      fetchStats();
      try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e) {}
    });

    connection.on("OrderCancelledByCustomer", (data) => {
      fetchActiveOrders();
      fetchHistory();
      fetchStats();
    });

    connection.on("OrderStatusUpdated", (data) => {
      fetchActiveOrders();
      fetchHistory();
      fetchStats();
    });

    try {
      await connection.start();
      console.log("SignalR Connected (Restaurant)");
      await connection.invoke("JoinRestaurantGroup", restaurantId);
      signalrConnection.current = connection;
    } catch (err) {
      console.error("SignalR Connection Error:", err);
    }
  };

  const fetchOffers = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/offer', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setOffers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    if (!newOffer.code || !newOffer.discountAmount) {
      alert("Code and Discount Amount are required.");
      return;
    }
    try {
      const isEdit = newOffer.id != null;
      const url = isEdit ? `http://localhost:5070/api/offer/${newOffer.id}` : 'http://localhost:5070/api/offer';
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newOffer.code,
          value: parseFloat(newOffer.discountAmount),
          type: newOffer.isPercentage ? 0 : 1,
          minOrderAmount: newOffer.minimumOrderValue ? parseFloat(newOffer.minimumOrderValue) : 0,
          expiryDate: newOffer.expiresAt ? new Date(newOffer.expiresAt).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }),
        credentials: 'include'
      });
      if (response.ok) {
        setNewOffer({ id: null, code: '', discountAmount: '', isPercentage: false, minimumOrderValue: '', expiresAt: '' });
        setShowOfferForm(false);
        fetchOffers();
        alert(isEdit ? "Offer updated successfully!" : "Offer created successfully!");
      } else {
        const errText = await response.text();
        try {
          const err = JSON.parse(errText);
          alert(err.message || "Failed to save offer.");
        } catch {
          alert(errText || "Failed to save offer.");
        }
      }
    } catch (err) {
      alert("Error saving offer. Please check your connection.");
    }
  };

  const toggleOfferStatus = async (offerId) => {
    try {
      const response = await fetch(`http://localhost:5070/api/offer/toggle/${offerId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) fetchOffers();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOffer = async (offerId) => {
    if (!(await window.confirm("Are you sure you want to delete this offer?"))) return;
    try {
      const response = await fetch(`http://localhost:5070/api/offer/${offerId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) fetchOffers();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/restaurant/orders/stats', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const statusReverseMap = { 0: 'Placed', 1: 'Accepted', 2: 'Preparing', 3: 'Ready', 4: 'Picked', 5: 'Delivered', 6: 'Cancelled' };

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/restaurant/orders/history', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map(o => ({
          ...o,
          status: typeof o.status === 'number' ? statusReverseMap[o.status] : o.status
        }));
        setHistory(mappedData);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const fetchActiveOrders = async () => {
    setIsOrdersLoading(true);
    try {
      const response = await fetch('http://localhost:5070/api/restaurant/orders/active', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map(o => ({
          ...o,
          status: typeof o.status === 'number' ? statusReverseMap[o.status] : o.status
        }));
        setOrders(mappedData);
      }
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const statusMap = { 'Placed': 0, 'Accepted': 1, 'Preparing': 2, 'Ready': 3, 'Picked': 4, 'Delivered': 5, 'Cancelled': 6 };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch('http://localhost:5070/api/restaurant/orders/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, newStatus: statusMap[newStatus] }),
        credentials: 'include'
      });
      
      if (response.ok) {
        if (newStatus === 'Delivered' || newStatus === 'Cancelled') {
          setOrders(prev => prev.filter(o => o.id !== orderId));
          fetchHistory();
          fetchStats();
        } else {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const fetchProfileData = async () => {
    try {
      const response = await fetch('http://localhost:5070/api/restaurant/profile', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setProfile({
          ...data,
          latitude: data.latitude || '',
          longitude: data.longitude || ''
        });
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const handleLocationSelect = async (lat, lng) => {
    setProfile(prev => ({ ...prev, latitude: lat, longitude: lng }));
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        // Only keep the first two parts of the address (e.g., Road name and City/Town)
        const shortAddress = data.display_name.split(',').slice(0, 2).join(',').trim();
        setProfile(prev => ({ ...prev, address: shortAddress }));
      }
    } catch (err) {
      console.error("Reverse geocoding failed", err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    
    // Parse the coordinates similar to registration
    const parseCoordinate = (coord) => {
      if (!coord) return 0;
      const str = coord.toString();
      let val = parseFloat(str.replace(/[^0-9.-]/g, ''));
      if (str.toUpperCase().includes('S') || str.toUpperCase().includes('W')) {
        val = -Math.abs(val);
      }
      return val || 0;
    };

    const payload = {
      ...profile,
      latitude: parseCoordinate(profile.latitude),
      longitude: parseCoordinate(profile.longitude)
    };

    try {
      const response = await fetch('http://localhost:5070/api/restaurant/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (response.ok) {
        if (profileImageFile) {
          const formData = new FormData();
          formData.append('file', profileImageFile);
          try {
            await fetch('http://localhost:5070/api/restaurant/profile/upload-image', {
              method: 'POST',
              body: formData,
              credentials: 'include'
            });
          } catch (imgErr) {
            console.error("Failed to upload profile image", imgErr);
          }
        }
        alert("Profile updated successfully!");
        setProfileImageFile(null);
        setProfilePreviewUrl(null);
        fetchProfileData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const menuRes = await fetch('http://localhost:5070/api/restaurant/menu-items', { credentials: 'include' });
      const catRes = await fetch('http://localhost:5070/api/restaurant/categories', { credentials: 'include' });
      if (menuRes.ok) setMenuItems(await menuRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'menu') {
      fetchItems();
    } else if (activeTab === 'history') {
      setHistoryPage(1);
      fetchHistory();
    }
  }, [activeTab]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    
    const isEditing = !!editingItem.id;
    const menuItemData = {
      ...(isEditing && { id: editingItem.id, categoryId: editingItem.categoryId }),
      name: newItem.name,
      description: newItem.description,
      price: parseFloat(newItem.price),
      categoryName: newItem.categoryName,
      isAvailable: newItem.isAvailable,
      isVeg: newItem.isVeg
    };

    try {
      const response = await fetch('http://localhost:5070/api/restaurant/menu-items', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuItemData),
        credentials: 'include'
      });

      if (response.ok) {
        const savedItem = await response.json();
        
        if (selectedFile && savedItem.id) {
          const imageData = new FormData();
          imageData.append('file', selectedFile);
          
          await fetch(`http://localhost:5070/api/restaurant/menu-items/${savedItem.id}/upload-image`, {
            method: 'POST',
            body: imageData,
            credentials: 'include'
          });
        }

        setNewItem({ name: '', description: '', price: '', categoryName: '', isAvailable: true, isVeg: true });
        setSelectedFile(null);
        setPreviewUrl(null);
        setEditingItem(null);
        fetchItems();
      }
    } catch (err) {
      console.error("Failed to save menu item:", err);
    }
  };
  
  const handleAddCategory = async (e) => {
    e.preventDefault();
    const newName = customCategoryName.trim();
    if (!newName) return;
    
    // Prevent duplicate categories
    const isDuplicate = categories.some(c => c.name.toLowerCase() === newName.toLowerCase());
    if (isDuplicate) {
      alert(`Category "${newName}" already exists!`);
      return;
    }

    setIsAddingCategory(true);
    try {
      const response = await fetch('http://localhost:5070/api/restaurant/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
        credentials: 'include'
      });
      if (response.ok) {
        const created = await response.json();
        alert(`Category "${created.name}" created successfully!`);
        // Refresh categories list
        const catRes = await fetch('http://localhost:5070/api/restaurant/categories', { credentials: 'include' });
        if (catRes.ok) {
          const updatedCats = await catRes.json();
          setCategories(updatedCats);
        }
        // Select this category for the current dish
        setNewItem(prev => ({ ...prev, categoryName: created.name }));
        setCustomCategoryName('');
        setShowNewCategoryInput(false);
      } else {
        const errText = await response.text();
        alert(errText || "Failed to create category.");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating category: " + err.message);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    const dishesInCategory = menuItems.filter(item => item.categoryName === name);
    
    if (dishesInCategory.length > 0) {
      const dishNames = dishesInCategory.map(d => d.name).join(', ');
      let promptMsg = `The category "${name}" contains ${dishesInCategory.length} dish(es) (${dishNames}).\n\nTo move them, select the new category below:`;
      const availableCategories = ['Uncategorized', ...categories.map(c => c.name).filter(n => n !== name)];
      const fallbackCategory = await window.prompt(promptMsg, 'Uncategorized', availableCategories);
      
      if (!fallbackCategory || fallbackCategory.trim() === '') {
        return; // User cancelled
      }

      const targetCategory = fallbackCategory.trim();

      try {
        // First, move dishes to new category
        await Promise.all(dishesInCategory.map(item => {
           const updatedDto = { ...item, categoryName: targetCategory };
           return fetch(`http://localhost:5070/api/restaurant/menu-items`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(updatedDto),
             credentials: 'include'
           });
        }));

        // Then, delete the category itself
        const res = await fetch(`http://localhost:5070/api/restaurant/categories/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (res.ok) {
          setCategories(prev => prev.filter(c => c.id !== id));
          // If targetCategory didn't exist in local state, we should ideally fetchCategories. 
          // But for now, we'll optimistically update the menuItems. The select dropdown allows any name.
          setMenuItems(prev => prev.map(item => item.categoryName === name ? { ...item, categoryName: targetCategory } : item));
          alert(`Successfully moved items and deleted "${name}"!`);
        } else {
          alert("Failed to delete category");
        }
      } catch (err) {
        console.error(err);
        alert("Error moving items and deleting category");
      }
    } else {
      let confirmMsg = `Are you sure you want to delete the empty category "${name}"?`;
      if (!(await window.confirm(confirmMsg))) return;
      
      try {
        const res = await fetch(`http://localhost:5070/api/restaurant/categories/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (res.ok) {
          setCategories(prev => prev.filter(c => c.id !== id));
        } else {
          alert("Failed to delete category");
        }
      } catch (err) {
        console.error(err);
        alert("Error deleting category");
      }
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryName: item.categoryName,
      isAvailable: item.isAvailable ?? true,
      isVeg: item.isVeg ?? true
    });
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleDeleteItem = (id) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`http://localhost:5070/api/restaurant/menu-items/${itemToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        fetchItems();
        setItemToDelete(null);
      } else {
        alert("Failed to delete item. It may be part of an existing order.");
        setItemToDelete(null);
      }
    } catch (err) {
      console.error(err);
      setItemToDelete(null);
    }
  };

  const totalHistoryPages = Math.ceil(history.length / itemsPerPage);
  const paginatedHistory = history.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

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
              style={{ width: '38px', height: '38px', borderRadius: '12px', background: currentPage === p ? '#ef9f27' : 'rgba(255,255,255,0.03)', color: currentPage === p ? '#000' : '#fff', border: currentPage === p ? 'none' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', transition: 'all 0.2s' }}
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

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'Outfit, sans-serif', display: 'flex' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
        .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); }
        .sidebar-btn { display: flex; align-items: center; gap: 15px; padding: 16px 20px; border-radius: 16px; border: none; background: transparent; color: #888; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
        .sidebar-btn.active { background: rgba(239, 159, 39, 0.1); color: #ef9f27; }
        .tab-content { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* Date picker calendar icon */
        input[type="date"]::-webkit-calendar-picker-indicator {
            cursor: pointer;
        }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: '280px', height: '100vh', borderRight: '1px solid rgba(255,255,255,0.05)', position: 'fixed', padding: '40px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '60px', padding: '0 20px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-1px' }}>DineDrop</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {[
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'live', icon: '🔥', label: 'Live Orders', badge: orders.length },
            { id: 'menu', icon: '🍴', label: 'Menu Editor' },
            { id: 'history', icon: '📜', label: 'History' },
            { id: 'offers', icon: '🏷️', label: 'Offers / Coupons' },
            { id: 'wallet', icon: '💳', label: 'Wallet' },
            { id: 'settings', icon: '⚙️', label: 'Settings' }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}>
              <span style={{ fontSize: '1.2rem' }}>{item.icon}</span> {item.label}
              {item.badge > 0 && <span style={{ marginLeft: 'auto', background: '#ef9f27', color: '#000', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>{item.badge}</span>}
            </button>
          ))}
        </div>
        
        <button onClick={onLogout} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', color: '#888', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
      </aside>

      {/* Main Content */}
      <main style={{ marginLeft: '280px', flex: 1, minWidth: 0, padding: '60px 80px' }}>
        
        {activeTab === 'overview' && (
          <div className="tab-content">
            <header style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Welcome back, <span style={{ color: '#ef9f27' }}>{profile.name || 'Partner'}</span></h2>
              <p style={{ color: '#666' }}>Your restaurant is currently {profile.isOpen ? 'accepting orders' : 'offline'}.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '64px' }}>
              {[
                { label: 'Today\'s Revenue', value: `₹${(stats?.todayRevenue || 0).toFixed(2)}`, color: '#10b981' },
                { label: 'Total Revenue', value: `₹${(stats?.totalRevenue || 0).toFixed(2)}`, color: '#00f3ff' },
                { label: 'Active Orders', value: stats?.activeOrdersCount || 0, color: '#ef9f27' },
                { label: 'Avg. Order Value', value: `₹${(stats?.averageOrderValue || 0).toFixed(2)}`, color: '#3b82f6' }
              ].map((s, i) => (
                <div key={i} className="glass" style={{ padding: '32px', borderRadius: '24px' }}>
                  <p style={{ color: '#666', fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px' }}>{s.label.toUpperCase()}</p>
                  <h3 style={{ fontSize: '2.2rem', fontWeight: '800', color: s.color }}>{s.value}</h3>
                </div>
              ))}
            </div>

            <div className="glass" style={{ padding: '40px', borderRadius: '32px' }}>
              <h4 style={{ marginBottom: '32px', fontWeight: '800' }}>Recent Revenue Performance</h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', height: '200px' }}>
                {stats.revenueChart.length > 0 ? stats.revenueChart.map((p, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '100%', background: 'linear-gradient(to top, #ef9f27, #f39c12)', borderRadius: '8px 8px 0 0', height: `${(p.amount / (Math.max(...stats.revenueChart.map(x => x.amount)) || 1)) * 100}%`, minHeight: '4px' }}></div>
                    <span style={{ fontSize: '0.7rem', color: '#666', fontWeight: '700' }}>{p.date}</span>
                  </div>
                )) : <p style={{ color: '#666' }}>No sales data available yet.</p>}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="tab-content">
             <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '40px' }}>Live Orders</h2>
             {orders.length === 0 ? (
               <div className="glass" style={{ padding: '80px', borderRadius: '32px', textAlign: 'center' }}>
                 <span style={{ fontSize: '4rem' }}>🛎️</span>
                 <h3 style={{ marginTop: '24px', color: '#666' }}>All caught up! No active orders.</h3>
               </div>
             ) : (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '32px' }}>
                 {orders.map(order => (
                   <div key={order.id} className="glass" style={{ padding: '32px', borderRadius: '32px', borderLeft: `4px solid ${order.status === 'Placed' ? '#ef9f27' : '#10b981'}` }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                       <div>
                         <h4 style={{ fontSize: '1.2rem', fontWeight: '800' }}>#{order.id.substring(0, 8)}</h4>
                         <p style={{ color: '#666', fontSize: '0.9rem' }}>{order.customerName}</p>
                       </div>
                       <span style={{ background: 'rgba(239, 159, 39, 0.1)', color: '#ef9f27', padding: '6px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800' }}>{order.status}</span>
                     </div>
                     <div style={{ marginBottom: '32px' }}>
                       {order.items.map((item, i) => (
                         <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                           <span>{item.quantity}x {item.dishName}</span>
                           <span style={{ color: '#666' }}>₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                         </div>
                       ))}
                     </div>
                     <div style={{ display: 'flex', gap: '12px' }}>
                        {order.status === 'Placed' ? (
                          <>
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'Accepted')} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>Accept</button>
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'Cancelled')} style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}>×</button>
                          </>
                        ) : order.status === 'Ready' ? (
                           <button disabled style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(239, 159, 39, 0.05)', border: '1px dashed rgba(239, 159, 39, 0.3)', color: '#ef9f27', fontWeight: '800', cursor: 'not-allowed' }}>
                             ⏳ Waiting for Driver Pickup
                           </button>
                        ) : order.status === 'Picked' ? (
                           <button disabled style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.05)', border: '1px dashed rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: '800', cursor: 'not-allowed' }}>
                             🛵 Out for Delivery
                           </button>
                        ) : (
                          <button onClick={() => {
                            const next = { 'Accepted': 'Preparing', 'Preparing': 'Ready' };
                            handleUpdateOrderStatus(order.id, next[order.status]);
                          }} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>
                            Next Stage →
                          </button>
                        )}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="tab-content">
             <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '40px' }}>Order History ({history.length})</h2>
             <div className="glass" style={{ padding: '36px', borderRadius: '32px', overflow: 'hidden' }}>
               <div style={{ overflowX: 'auto' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                   <thead>
                     <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <th style={{ padding: '20px 24px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Order ID</th>
                       <th style={{ padding: '20px 24px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Date</th>
                       <th style={{ padding: '20px 24px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Customer</th>
                       <th style={{ padding: '20px 24px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Amount</th>
                       <th style={{ padding: '20px 24px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                      {paginatedHistory.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '80px 40px', textAlign: 'center', color: '#666' }}>
                            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '16px' }}>📜</span>
                            <h3 style={{ fontWeight: '700', fontSize: '1.2rem', color: '#aaa' }}>No order history</h3>
                          </td>
                        </tr>
                      ) : (
                        paginatedHistory.map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '24px', fontWeight: '800', fontFamily: 'monospace', color: '#ef9f27', fontSize: '1rem' }}>#{o.id.substring(0, 8)}</td>
                            <td style={{ padding: '24px', color: '#aaa', fontSize: '0.95rem' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '24px', fontWeight: '700', color: '#fff' }}>{o.customerName}</td>
                            <td style={{ padding: '24px', fontWeight: '900', color: '#10b981', fontSize: '1.1rem' }}>₹{o.totalAmount.toFixed(2)}</td>
                            <td style={{ padding: '24px' }}>
                              <span style={{ padding: '6px 12px', borderRadius: '20px', background: o.status === 'Cancelled' ? 'rgba(255, 77, 77, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: o.status === 'Cancelled' ? '#ff4d4d' : '#10b981', fontWeight: '700', fontSize: '0.8rem' }}>
                                {o.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                 </table>
               </div>
               <Pagination currentPage={historyPage} totalPages={totalHistoryPages} onPageChange={setHistoryPage} />
             </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="tab-content">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Menu Editor</h2>
                <button onClick={() => { setEditingItem({}); setNewItem({ name: '', description: '', price: '', categoryName: '', isAvailable: true, isVeg: true }); setSelectedFile(null); setPreviewUrl(null); }} style={{ padding: '16px 32px', borderRadius: '16px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>+ Add Item</button>
             </div>
             
             {/* Categories Filter/Management Row */}
             {categories && categories.length > 0 && (
               <div style={{ marginBottom: '40px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                 <p style={{ color: '#888', fontSize: '0.85rem', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Custom Categories</p>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <button onClick={() => document.getElementById('category-scroll-container').scrollBy({ left: -250, behavior: 'smooth' })} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#888', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: '900' }}>{'<'}</button>
                   <div id="category-scroll-container" className="no-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '0', scrollBehavior: 'smooth', flex: 1, minWidth: 0 }}>
                     {categories.map(cat => (
                       <div key={cat.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(239, 159, 39, 0.1)', border: '1px solid rgba(239, 159, 39, 0.3)', borderRadius: '20px', padding: '8px 16px', gap: '10px' }}>
                         <span style={{ color: '#ef9f27', fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{cat.name}</span>
                         <button onClick={() => handleDeleteCategory(cat.id, cat.name)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', fontSize: '1rem', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 77, 77, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} title="Delete Category">
                           ×
                         </button>
                       </div>
                     ))}
                   </div>
                   <button onClick={() => document.getElementById('category-scroll-container').scrollBy({ left: 250, behavior: 'smooth' })} style={{ background: 'rgba(239, 159, 39, 0.1)', border: '1px solid rgba(239, 159, 39, 0.3)', color: '#ef9f27', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: '900' }}>{'>'}</button>
                 </div>
               </div>
             )}
             
             {loading ? <p>Loading menu...</p> : (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '32px' }}>
                 {menuItems.map(item => (
                   <div key={item.id} className="glass" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                      <div style={{ height: '180px', background: '#111' }}>
                         {item.imageUrl && <img src={`http://localhost:5070${item.imageUrl}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ padding: '24px' }}>
                         <span style={{ color: '#ef9f27', fontSize: '0.7rem', fontWeight: '800' }}>{item.categoryName}</span>
                         <h4 style={{ fontSize: '1.2rem', fontWeight: '800', marginTop: '4px' }}>{item.name}</h4>
                         <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>{item.description}</p>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>₹{item.price.toFixed(2)}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                               <button onClick={() => handleEditClick(item)} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }}>Edit</button>
                               <button onClick={() => handleDeleteItem(item.id)} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,0,0,0.1)', color: '#ff4d4d', border: 'none', cursor: 'pointer' }}>Delete</button>
                            </div>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px' }}>
                           <span style={{ fontSize: '1.2rem' }}>{item.isVeg ? '🥗' : '🥩'}</span>
                           <div style={{ flex: 1 }}>
                             <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: item.isVeg ? '#2ecc71' : '#e74c3c' }}>{item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}</h4>
                             <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>{item.isVeg ? 'Dietary tag' : 'Dietary tag'}</p>
                           </div>
                         </div>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-content">
             <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '40px' }}>Settings</h2>
             <div className="glass" style={{ padding: '40px', borderRadius: '32px', maxWidth: '600px' }}>
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                   <div>
                      <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Restaurant Name</label>
                      <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                   </div>
                   <div>
                      <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Description</label>
                      <textarea value={profile.description} onChange={e => setProfile({...profile, description: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', minHeight: '100px' }} />
                   </div>
                   
                   <div style={{ display: 'flex', gap: '20px' }}>
                     <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Contact Number</label>
                        <input value={profile.contactNumber || ''} placeholder="e.g. +1 234 567 890" onChange={e => setProfile({...profile, contactNumber: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                     </div>
                   </div>
                   
                   <div>
                      <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Full Physical Address</label>
                      <input value={profile.address || ''} placeholder="e.g. 123 Main St, City" onChange={e => setProfile({...profile, address: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                   </div>
                   
                   <div>
                      <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Location (Click on map to auto-fill address)</label>
                      <LocationPicker 
                        lat={profile.latitude} 
                        lng={profile.longitude} 
                        onLocationSelect={handleLocationSelect}
                      />
                   </div>
                   <div style={{ display: 'flex', gap: '20px' }}>
                     <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Latitude</label>
                        <input value={profile.latitude} placeholder="e.g. 11.1202° N" onChange={e => setProfile({...profile, latitude: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                     </div>
                     <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Longitude</label>
                        <input value={profile.longitude} placeholder="e.g. 76.1200° E" onChange={e => setProfile({...profile, longitude: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                     </div>
                   </div>
                   <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <input type="checkbox" checked={profile.isOpen} onChange={e => setProfile({...profile, isOpen: e.target.checked})} />
                      <label>Store is Open & Accepting Orders</label>
                   </div>

                   <div>
                     <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Restaurant Display Image</label>
                     
                     {(profilePreviewUrl || profile.imageUrl) && (
                       <div style={{ marginBottom: '16px', width: '100%', height: '220px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', background: '#000' }}>
                         <img 
                           src={profilePreviewUrl || `http://localhost:5070${profile.imageUrl}`} 
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                           alt="Restaurant Preview" 
                         />
                       </div>
                     )}
                     
                     <div style={{ position: 'relative' }}>
                       <input 
                         type="file" 
                         id="profileImageInput"
                         accept="image/*"
                         onChange={e => {
                           const file = e.target.files[0];
                           if (file && !file.type.startsWith('image/')) {
                             alert("Please select a valid image file.");
                             e.target.value = null;
                             setProfileImageFile(null);
                             setProfilePreviewUrl(null);
                             return;
                           }
                           setProfileImageFile(file);
                           if (file) {
                             setProfilePreviewUrl(URL.createObjectURL(file));
                           } else {
                             setProfilePreviewUrl(null);
                           }
                         }} 
                         style={{ display: 'none' }}
                       />
                       <label htmlFor="profileImageInput" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                         <span>📸</span> {profileImageFile ? 'Change Selected Image' : 'Upload Display Image'}
                       </label>
                     </div>
                   </div>
                   <button type="submit" disabled={isSavingProfile} style={{ padding: '18px', borderRadius: '16px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>
                     {isSavingProfile ? 'Saving...' : 'Save Settings'}
                   </button>
                </form>
             </div>
          </div>
        )}
        {activeTab === 'offers' && (
          <div className="tab-content">
            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>Offers & Coupons</h2>
            <p style={{ color: '#aaa', marginBottom: '40px' }}>Manage store-specific promo codes.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {showOfferForm ? (
                <div className="glass" style={{ padding: '32px', borderRadius: '24px', maxWidth: '800px', width: '100%' }}>
                  <h3 style={{ fontSize: '1.4rem', color: '#00f3ff', marginBottom: '24px', fontWeight: '800' }}>{newOffer.id ? 'Edit Offer' : 'Create New Offer'}</h3>
                  <form onSubmit={handleCreateOffer}>
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '0.9rem', fontWeight: '600' }}>Coupon Code</label>
                      <input 
                        type="text" 
                        value={newOffer.code}
                        onChange={e => setNewOffer({...newOffer, code: e.target.value.toUpperCase()})}
                        placeholder="e.g. SUMMER20"
                        style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '16px', textTransform: 'uppercase', fontSize: '1rem' }}
                      />
                    </div>
                    
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '0.9rem', fontWeight: '600' }}>Discount Amount</label>
                        <input 
                          type="number" 
                          value={newOffer.discountAmount}
                          onChange={e => {
                            let val = e.target.value;
                            if (newOffer.isPercentage && Number(val) > 100) val = '100';
                            if (!newOffer.isPercentage && Number(val) > 500) val = '500';
                            setNewOffer({...newOffer, discountAmount: val})
                          }}
                          placeholder={newOffer.isPercentage ? "%" : "₹"}
                          style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '16px', fontSize: '1rem' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '30px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#aaa', fontSize: '0.95rem', fontWeight: '600' }}>
                          <input 
                            type="checkbox" 
                            checked={newOffer.isPercentage}
                            onChange={e => setNewOffer({
                              ...newOffer, 
                              isPercentage: e.target.checked,
                              discountAmount: (e.target.checked && Number(newOffer.discountAmount) > 100) ? '100' : 
                                              (!e.target.checked && Number(newOffer.discountAmount) > 500) ? '500' : newOffer.discountAmount
                            })}
                            style={{ marginRight: '12px', transform: 'scale(1.2)' }}
                          />
                          Is Percentage?
                        </label>
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '0.9rem', fontWeight: '600' }}>Min Order Value (Optional)</label>
                      <input 
                        type="number" 
                        value={newOffer.minimumOrderValue}
                        onChange={e => setNewOffer({...newOffer, minimumOrderValue: e.target.value})}
                        placeholder="₹0.00"
                        style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '16px', fontSize: '1rem' }}
                      />
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#888', fontSize: '0.9rem', fontWeight: '600' }}>Expires At (Optional)</label>
                      <input 
                        type="date" 
                        value={newOffer.expiresAt}
                        onChange={e => setNewOffer({...newOffer, expiresAt: e.target.value})}
                        style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '16px', fontSize: '1rem', colorScheme: 'dark' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button type="submit" style={{ flex: 1, padding: '18px', borderRadius: '16px', background: 'rgba(0,243,255,0.15)', color: '#00f3ff', border: '1px solid rgba(0, 243, 255, 0.4)', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s' }}>
                        {newOffer.id ? 'SAVE CHANGES' : '+ CREATE OFFER'}
                      </button>
                      <button type="button" onClick={() => { setShowOfferForm(false); setNewOffer({ id: null, code: '', discountAmount: '', isPercentage: false, minimumOrderValue: '', expiresAt: '' }); }} style={{ flex: 1, padding: '18px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s' }}>
                        CANCEL
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.4rem', color: '#fff', margin: 0, fontWeight: '800' }}>Active Offers</h3>
                    <button 
                      onClick={() => { setNewOffer({ id: null, code: '', discountAmount: '', isPercentage: false, minimumOrderValue: '', expiresAt: '' }); setShowOfferForm(true); }}
                      style={{ padding: '12px 24px', borderRadius: '12px', background: '#00f3ff', color: '#000', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}>
                      + Add New Offer
                    </button>
                  </div>
                {offers.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '24px', textAlign: 'center', color: '#666', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    No offers created yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {offers.map(offer => (
                      <div key={offer.id} className="glass" style={{ padding: '24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${offer.isActive ? 'rgba(0,243,255,0.3)' : 'rgba(255,255,255,0.05)'}` }}>
                        <div>
                          <h4 style={{ color: '#fff', fontSize: '1.4rem', margin: '0 0 8px 0', letterSpacing: '1px', fontWeight: '900' }}>{offer.code}</h4>
                          <p style={{ color: '#aaa', margin: '0 0 6px 0', fontSize: '1rem' }}>
                            Discount: <span style={{ color: '#00f3ff', fontWeight: '800' }}>{offer.type === 0 ? `${offer.value}%` : `₹${offer.value}`}</span>
                          </p>
                          {offer.minOrderAmount > 0 && (
                            <p style={{ color: '#888', margin: 0, fontSize: '0.85rem', fontWeight: '600' }}>Min Order: ₹{offer.minOrderAmount}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button 
                            onClick={() => { setNewOffer({ id: offer.id, code: offer.code, discountAmount: offer.value, isPercentage: offer.type === 0, minimumOrderValue: offer.minOrderAmount || '', expiresAt: offer.expiryDate ? offer.expiryDate.split('T')[0] : '' }); setShowOfferForm(true); }}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => toggleOfferStatus(offer.id)}
                            style={{ background: offer.isActive ? 'rgba(0,243,255,0.15)' : 'rgba(255,255,255,0.05)', color: offer.isActive ? '#00f3ff' : '#aaa', border: offer.isActive ? '1px solid rgba(0,243,255,0.3)' : '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}
                          >
                            {offer.isActive ? 'Active' : 'Inactive'}
                          </button>
                          <button 
                            onClick={() => deleteOffer(offer.id)}
                            style={{ background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', border: '1px solid rgba(255,77,77,0.3)', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}
        
        {activeTab === 'wallet' && (
          <div className="tab-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '30px', color: '#fff', letterSpacing: '-1px' }}>Your Wallet</h2>
            <WalletView role="restaurant" />
          </div>
        )}
      </main>

      {/* Add/Edit Item Modal */}
      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
           <div className="glass card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', borderRadius: '32px', position: 'relative', border: '1px solid rgba(239, 159, 39, 0.3)' }}>
              <button onClick={() => setEditingItem(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: '#888', fontSize: '1.8rem', cursor: 'pointer', transition: 'color 0.2s' }}>✕</button>
              <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '32px', color: '#fff' }}>{editingItem.id ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
              
              <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 <div>
                   <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', fontWeight: '600', marginBottom: '8px' }}>Dish Name</label>
                   <input placeholder="e.g. Spicy Chicken Burger" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '1rem' }} />
                 </div>
                 
                 <div>
                   <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', fontWeight: '600', marginBottom: '8px' }}>Description</label>
                   <textarea placeholder="Briefly describe the dish, ingredients, and flavor profile..." value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', minHeight: '100px', resize: 'vertical', fontSize: '1rem' }} />
                 </div>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                   <div>
                     <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', fontWeight: '600', marginBottom: '8px' }}>Price (₹)</label>
                     <input placeholder="0.00" type="number" step="0.01" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '1rem' }} />
                   </div>
                   
                   <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', fontWeight: '600', marginBottom: '8px' }}>Category</label>
                      <select 
                        value={newItem.categoryName} 
                        onChange={e => setNewItem({...newItem, categoryName: e.target.value})} 
                        disabled={showNewCategoryInput}
                        style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: newItem.categoryName ? '#fff' : '#888', fontSize: '1rem', appearance: 'none', cursor: showNewCategoryInput ? 'not-allowed' : 'pointer', opacity: showNewCategoryInput ? 0.5 : 1 }}
                      >
                        <option value="" disabled>Select a category</option>
                        {Array.from(new Set([
                          ...categories.map(c => c.name),
                          "Pizza", "Burger", "Sushi", "Healthy", "Dessert", "Coffee", "Salad", "Beverages", "Chicken", "Pasta", "Indian", "Chinese"
                        ])).sort().map((catName, idx) => (
                          <option key={idx} value={catName} style={{ background: '#111', color: '#fff' }}>{catName}</option>
                        ))}
                      </select>
                      
                      <div style={{ marginTop: '8px', textAlign: 'right' }}>
                        <button type="button" onClick={() => { setShowNewCategoryInput(!showNewCategoryInput); setCustomCategoryName(''); }} style={{ background: 'none', border: 'none', color: '#ef9f27', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', padding: 0 }}>
                          {showNewCategoryInput ? 'Cancel' : '+ Add custom category'}
                        </button>
                      </div>
                   </div>

                   <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '20px' }}>
                     <span style={{ fontSize: '1.2rem' }}>{newItem.isVeg ? '🥗' : '🥩'}</span>
                     <div style={{ flex: 1 }}>
                       <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: newItem.isVeg ? '#2ecc71' : '#e74c3c' }}>{newItem.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}</h4>
                       <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Toggle to set dietary tag</p>
                     </div>
                     <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                       <input
                         type="checkbox"
                         checked={newItem.isVeg}
                         onChange={e => setNewItem({...newItem, isVeg: e.target.checked})}
                         style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                       />
                       <span style={{
                         position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                         backgroundColor: newItem.isVeg ? '#2ecc71' : '#e74c3c',
                         transition: '.4s', borderRadius: '34px', boxShadow: newItem.isVeg ? '0 0 10px rgba(46,204,113,0.5)' : '0 0 10px rgba(231,76,60,0.5)'
                       }}>
                         <span style={{
                           position: 'absolute', height: '18px', width: '18px', left: '4px', bottom: '4px',
                           backgroundColor: '#fff', transition: '.4s', borderRadius: '50%',
                           transform: newItem.isVeg ? 'translateX(24px)' : 'translateX(0)'
                         }}></span>
                       </span>
                     </label>
                   </div>
                   
                   <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', justifyContent: 'space-between', marginTop: '16px' }}>
                      <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: '600' }}>Item is currently available</span>
                      <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={newItem.isAvailable}
                          onChange={e => setNewItem({...newItem, isAvailable: e.target.checked})}
                          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                        />
                        <span style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: newItem.isAvailable ? '#00f3ff' : 'rgba(255,255,255,0.1)',
                          transition: '.4s', borderRadius: '34px', boxShadow: newItem.isAvailable ? '0 0 10px rgba(0,243,255,0.5)' : 'none'
                        }}></span>
                        <span style={{
                          position: 'absolute', height: '18px', width: '18px', left: '4px', bottom: '4px',
                          backgroundColor: newItem.isAvailable ? '#000' : '#888', transition: '.4s', borderRadius: '50%',
                          transform: newItem.isAvailable ? 'translateX(24px)' : 'translateX(0)'
                        }}></span>
                      </label>
                   </div>
                 </div>

                 {showNewCategoryInput && (
                   <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(239, 159, 39, 0.05)', border: '1px solid rgba(239, 159, 39, 0.2)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                     <input 
                       placeholder="e.g. Seafood, Vegan, Mexican" 
                       value={customCategoryName} 
                       onChange={e => setCustomCategoryName(e.target.value)} 
                       style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.95rem' }} 
                     />
                     <button type="button" onClick={handleAddCategory} disabled={isAddingCategory} style={{ padding: '12px 20px', borderRadius: '12px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                       {isAddingCategory ? 'Adding...' : 'Add Category'}
                     </button>
                   </div>
                 )}

                 <div>
                   <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', fontWeight: '600', marginBottom: '8px' }}>Dish Image</label>
                   
                   {(previewUrl || (editingItem && editingItem.imageUrl)) && (
                     <div style={{ marginBottom: '16px', width: '100%', height: '220px', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', background: '#000' }}>
                       <img 
                         src={previewUrl || `http://localhost:5070${editingItem.imageUrl}`} 
                         style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                         alt="Dish Preview" 
                       />
                     </div>
                   )}
                   
                   <div style={{ position: 'relative' }}>
                     <input 
                       type="file" 
                       id="dishImageInput"
                       accept="image/*"
                       onChange={e => {
                         const file = e.target.files[0];
                         if (file && !file.type.startsWith('image/')) {
                           alert("Please select a valid image file.");
                           e.target.value = null;
                           setSelectedFile(null);
                           setPreviewUrl(null);
                           return;
                         }
                         setSelectedFile(file);
                         if (file) {
                           setPreviewUrl(URL.createObjectURL(file));
                         } else {
                           setPreviewUrl(null);
                         }
                       }} 
                       style={{ display: 'none' }}
                     />
                     <label htmlFor="dishImageInput" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                       <span>📸</span> {selectedFile ? 'Change Selected Image' : 'Upload Image File'}
                     </label>
                   </div>
                 </div>
                 <button type="submit" style={{ padding: '18px', borderRadius: '16px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>{editingItem.id ? 'Save Changes' : 'Create Item'}</button>
              </form>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
           <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '40px', borderRadius: '32px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px', color: '#ff4d4d' }}>Confirm Delete</h3>
              <p style={{ color: '#aaa', marginBottom: '32px' }}>Are you sure you want to delete this item? This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: '16px' }}>
                 <button onClick={() => setItemToDelete(null)} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                 <button onClick={confirmDelete} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4d4d', fontWeight: '800', cursor: 'pointer' }}>Delete</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
