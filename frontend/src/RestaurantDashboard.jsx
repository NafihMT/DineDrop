import { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import * as signalR from "@microsoft/signalr";
import LocationPicker from './LocationPicker';

const RestaurantDashboard = ({ onLogout }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Profile state
  const [profile, setProfile] = useState({ name: '', description: '', address: '', businessType: '', businessHours: '', isOpen: true, latitude: '', longitude: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const signalrConnection = useRef(null);

  // Pagination state for history
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 8;

  // Stats state
  const [stats, setStats] = useState({ todayRevenue: 0, activeOrdersCount: 0, totalOrdersCount: 0, averageOrderValue: 0, revenueChart: [] });

  // Form states
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', categoryName: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // Edit/Delete states
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    fetchActiveOrders();
    fetchHistory();
    fetchStats();
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

    try {
      await connection.start();
      console.log("SignalR Connected (Restaurant)");
      await connection.invoke("JoinRestaurantGroup", restaurantId);
      signalrConnection.current = connection;
    } catch (err) {
      console.error("SignalR Connection Error:", err);
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
        alert("Profile updated successfully!");
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
      categoryName: newItem.categoryName
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

        setNewItem({ name: '', description: '', price: '', categoryName: '' });
        setSelectedFile(null);
        setPreviewUrl(null);
        setEditingItem(null);
        fetchItems();
      }
    } catch (err) {
      console.error("Failed to save menu item:", err);
    }
  };

  const handleEditClick = (item) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      description: item.description,
      price: item.price,
      categoryName: item.categoryName
    });
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
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
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
      <main style={{ marginLeft: '280px', flex: 1, padding: '60px 80px' }}>
        
        {activeTab === 'overview' && (
          <div className="tab-content">
            <header style={{ marginBottom: '48px' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Welcome back, <span style={{ color: '#ef9f27' }}>{profile.name || 'Partner'}</span></h2>
              <p style={{ color: '#666' }}>Your restaurant is currently {profile.isOpen ? 'accepting orders' : 'offline'}.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '64px' }}>
              {[
                { label: 'Today\'s Revenue', value: `$${(stats?.todayRevenue || 0).toFixed(2)}`, color: '#10b981' },
                { label: 'Total Revenue', value: `$${(stats?.totalRevenue || 0).toFixed(2)}`, color: '#00f3ff' },
                { label: 'Active Orders', value: stats?.activeOrdersCount || 0, color: '#ef9f27' },
                { label: 'Avg. Order Value', value: `$${(stats?.averageOrderValue || 0).toFixed(2)}`, color: '#3b82f6' }
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
                           <span style={{ color: '#666' }}>${(item.quantity * item.unitPrice).toFixed(2)}</span>
                         </div>
                       ))}
                     </div>
                     <div style={{ display: 'flex', gap: '12px' }}>
                        {order.status === 'Placed' ? (
                          <>
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'Accepted')} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>Accept</button>
                            <button onClick={() => handleUpdateOrderStatus(order.id, 'Cancelled')} style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}>×</button>
                          </>
                        ) : (
                          <button onClick={() => {
                            const next = { 'Accepted': 'Preparing', 'Preparing': 'Ready', 'Ready': 'Picked', 'Picked': 'Delivered' };
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
                            <td style={{ padding: '24px', fontWeight: '900', color: '#10b981', fontSize: '1.1rem' }}>${o.totalAmount.toFixed(2)}</td>
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
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '800' }}>Menu Editor</h2>
                <button onClick={() => setEditingItem({})} style={{ padding: '16px 32px', borderRadius: '16px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>+ Add Item</button>
             </div>
             
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
                            <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>${item.price.toFixed(2)}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                               <button onClick={() => handleEditClick(item)} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }}>Edit</button>
                               <button onClick={() => handleDeleteItem(item.id)} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(255,0,0,0.1)', color: '#ff4d4d', border: 'none', cursor: 'pointer' }}>Delete</button>
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
                   <div>
                      <label style={{ display: 'block', color: '#666', fontSize: '0.9rem', marginBottom: '8px' }}>Location (Click on map to update)</label>
                      <LocationPicker 
                        lat={profile.latitude} 
                        lng={profile.longitude} 
                        onLocationSelect={(lat, lng) => setProfile({...profile, latitude: lat, longitude: lng})}
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
                   <button type="submit" disabled={isSavingProfile} style={{ padding: '18px', borderRadius: '16px', background: '#ef9f27', border: 'none', color: '#000', fontWeight: '800', cursor: 'pointer' }}>
                     {isSavingProfile ? 'Saving...' : 'Save Settings'}
                   </button>
                </form>
             </div>
          </div>
        )}
      </main>

      {/* Add/Edit Item Modal */}
      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
           <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '32px', position: 'relative' }}>
              <button onClick={() => setEditingItem(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', color: '#666', fontSize: '2rem', cursor: 'pointer' }}>×</button>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '32px' }}>{editingItem.id ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
              <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <input placeholder="Item Name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                 <textarea placeholder="Description" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                 <input placeholder="Price ($)" type="number" step="0.01" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                 <input placeholder="Category" value={newItem.categoryName} onChange={e => setNewItem({...newItem, categoryName: e.target.value})} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }} />
                 <input type="file" onChange={e => setSelectedFile(e.target.files[0])} style={{ color: '#666' }} />
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
