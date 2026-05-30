import { useState, useEffect } from 'react';

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('admin_active_tab') || 'Dashboard';
  });

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
  }, [activeTab]);
  const [stats, setStats] = useState({ totalRestaurants: 0, pendingRequests: 0, totalUsers: 0, activeOrders: 0, totalRevenue: 0, totalDrivers: 0, pendingDrivers: 0 });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState('All');

  // Pagination states
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [driverPage, setDriverPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setSearchQuery('');
    setRestaurantPage(1);
    setUserPage(1);
    setOrderPage(1);
    setDriverPage(1);
    setDriverStatusFilter('All');
    if (activeTab === 'Dashboard') {
      fetchStats();
      fetchPendingRequests();
    } else if (activeTab === 'Restaurants') {
      fetchRestaurants();
    } else if (activeTab === 'Users') {
      fetchUsers();
    } else if (activeTab === 'Orders') {
      fetchOrders();
    } else if (activeTab === 'Drivers') {
      fetchDrivers();
    }
  }, [activeTab]);

  useEffect(() => {
    setRestaurantPage(1);
    setUserPage(1);
    setOrderPage(1);
    setDriverPage(1);
  }, [searchQuery]);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5070/api/admin/stats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchPendingRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/admin/pending-restaurants', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/admin/restaurants', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/admin/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/admin/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5070/api/admin/drivers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (userId, isApproved) => {
    try {
      const res = await fetch('http://localhost:5070/api/admin/approve-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isApproved }),
        credentials: 'include'
      });
      if (res.ok) {
        if (activeTab === 'Dashboard') { fetchPendingRequests(); fetchStats(); }
        else if (activeTab === 'Restaurants') fetchRestaurants();
      } else {
        const err = await res.text();
        alert("Action failed: " + err);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleDriverApproval = async (userId, isApproved) => {
    try {
      const res = await fetch('http://localhost:5070/api/admin/approve-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isApproved }),
        credentials: 'include'
      });
      if (res.ok) { fetchDrivers(); fetchStats(); }
      else alert("Action failed: " + await res.text());
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleToggleDriverBlock = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5070/api/admin/drivers/${userId}/toggle-block`, {
        method: 'POST', credentials: 'include'
      });
      if (res.ok) fetchDrivers();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleToggleBlock = async (userId, type = 'user') => {
    try {
      const res = await fetch(`http://localhost:5070/api/admin/users/${userId}/toggle-block`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        if (type === 'restaurant') {
          fetchRestaurants();
        } else {
          fetchUsers();
        }
      }
    } catch (err) {
      alert("Error updating status: " + err.message);
    }
  };

  const StatCard = ({ title, value, icon, color }) => (
    <div className="glass" style={{ padding: '24px', flex: 1, minWidth: '200px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)' }}>
      <div style={{ color: color, marginBottom: '12px', fontSize: '1.8rem' }}>{icon}</div>
      <p style={{ fontSize: '0.875rem', color: '#888', fontWeight: '600' }}>{title}</p>
      <h3 style={{ fontSize: '2rem', fontWeight: '800', marginTop: '6px', color: '#fff' }}>{value}</h3>
    </div>
  );

  const getStatusBadge = (r) => {
    if (r.isBlocked) return <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d', fontSize: '0.8rem', fontWeight: '700' }}>Blocked</span>;
    switch (r.approvalStatus) {
      case 'Approved': return <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', fontSize: '0.8rem', fontWeight: '700' }}>Approved</span>;
      case 'Pending': return <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(239, 159, 39, 0.15)', color: '#EF9F27', fontSize: '0.8rem', fontWeight: '700' }}>Pending</span>;
      case 'Rejected': return <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(226, 75, 74, 0.15)', color: '#e24b4a', fontSize: '0.8rem', fontWeight: '700' }}>Rejected</span>;
      default: return <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.1)', color: '#aaa', fontSize: '0.8rem', fontWeight: '700' }}>{r.approvalStatus}</span>;
    }
  };

  const filteredRestaurants = restaurants.filter(r => 
    r.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalRestaurantPages = Math.ceil(filteredRestaurants.length / itemsPerPage);
  const paginatedRestaurants = filteredRestaurants.slice((restaurantPage - 1) * itemsPerPage, restaurantPage * itemsPerPage);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalUserPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage);

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.restaurantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalOrderPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * itemsPerPage, orderPage * itemsPerPage);

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '280px', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '40px', background: '#0a0a0a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '12px' }}>
          <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, #00f3ff, #0066ff)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#000', fontSize: '1.4rem' }}>D</div>
          <span style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px' }}>DineDrop <span style={{ color: '#00f3ff' }}>Admin</span></span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
                    { id: 'Dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'Restaurants', icon: '🍽️', label: 'Restaurants' },
            { id: 'Users', icon: '👥', label: 'Users' },
            { id: 'Orders', icon: '📦', label: 'Orders' },
            { id: 'Drivers', icon: '🛵', label: 'Drivers', badge: stats.pendingDrivers },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 20px',
                borderRadius: '16px',
                background: activeTab === item.id ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
                color: activeTab === item.id ? '#00f3ff' : '#888',
                border: activeTab === item.id ? '1px solid rgba(0, 243, 255, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '1.05rem',
                transition: 'all 0.2s',
                textAlign: 'left',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '1.3rem' }}>{item.icon}</span> {item.label}
              </span>
              {item.badge > 0 && (
                <span style={{ background: '#f39c12', color: '#000', borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: '900' }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={onLogout} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'rgba(226, 75, 74, 0.1)', color: '#ff4d4d', border: '1px solid rgba(226, 75, 74, 0.2)', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', transition: 'all 0.2s' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '50px 70px', overflowY: 'auto' }}>
        <header style={{ marginBottom: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ color: '#00f3ff', fontWeight: '800', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>PLATFORM MANAGEMENT</span>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginTop: '6px', letterSpacing: '-0.5px' }}>{activeTab} Overview</h1>
          </div>
          {activeTab !== 'Dashboard' && (
            <input 
              type="text" 
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '14px 24px', width: '320px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.95rem' }}
            />
          )}
        </header>

        {activeTab === 'Dashboard' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            {/* Stats Grid */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '48px', flexWrap: 'wrap' }}>
              <StatCard title="Total Restaurants" value={stats.totalRestaurants} color="#00f3ff" icon="🏪" />
              <StatCard title="Pending Restaurants" value={stats.pendingRequests} color="#EF9F27" icon="⏳" />
              <StatCard title="Total Users" value={stats.totalUsers} color="#9b59b6" icon="👤" />
              <StatCard title="Active Orders" value={stats.activeOrders} color="#3B82F6" icon="🚚" />
              <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toFixed(2)}`} color="#2ecc71" icon="💵" />
              <StatCard title="Active Drivers" value={stats.totalDrivers} color="#f39c12" icon="🛵" />
              <StatCard title="Pending Drivers" value={stats.pendingDrivers} color="#e17055" icon="🔔" />
            </div>

            {/* Pending Requests Table */}
            <div className="glass" style={{ padding: '36px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>⏳</span> Pending Partner Applications
                </h2>
                <button onClick={() => setActiveTab('Restaurants')} style={{ color: '#00f3ff', background: 'transparent', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.95rem' }}>View All Restaurants &rarr;</button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontWeight: '600' }}>Loading pending applications...</div>
              ) : pendingRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 40px', color: '#666', background: 'rgba(255,255,255,0.01)', borderRadius: '24px' }}>
                  <span style={{ fontSize: '3rem' }}>✨</span>
                  <h3 style={{ marginTop: '16px', color: '#aaa', fontWeight: '700' }}>All Caught Up!</h3>
                  <p style={{ marginTop: '4px', fontSize: '0.95rem' }}>There are no pending restaurant approval requests.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Restaurant</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Owner Details</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Applied Date</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((req) => (
                        <tr key={req.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#fff' }}>{req.businessName}</div>
                            <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: '600', marginTop: '2px' }}>{req.businessType}</div>
                          </td>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ fontWeight: '600', color: '#ddd' }}>{req.name}</div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '2px' }}>{req.email} • {req.phone}</div>
                          </td>
                          <td style={{ padding: '24px 20px', color: '#aaa', fontSize: '0.95rem' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <button onClick={() => handleApproval(req.userId, true)} style={{ padding: '10px 20px', borderRadius: '12px', background: '#2ecc71', color: '#000', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)' }}>Approve</button>
                              <button onClick={() => handleApproval(req.userId, false)} style={{ padding: '10px 20px', borderRadius: '12px', background: 'rgba(226, 75, 74, 0.1)', color: '#ff4d4d', border: '1px solid rgba(226, 75, 74, 0.3)', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Restaurants' && (
          <div className="glass" style={{ padding: '36px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', animation: 'fadeIn 0.4s ease-out' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '28px' }}>All Partner Restaurants ({filteredRestaurants.length})</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontWeight: '600' }}>Loading restaurants...</div>
            ) : filteredRestaurants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>No restaurants matching search query.</div>
            ) : (
              <div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Business Name</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Owner Details</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Location</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRestaurants.map(r => (
                        <tr key={r.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {r.businessName}
                              {r.approvalStatus === 'Approved' && !r.isBlocked && (
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.isOpen ? '#2ecc71' : '#888', display: 'inline-block' }} title={r.isOpen ? "Open" : "Closed"} />
                              )}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#00f3ff', fontWeight: '600', marginTop: '2px' }}>{r.businessType}</div>
                          </td>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ fontWeight: '600', color: '#ddd' }}>{r.name}</div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '2px' }}>{r.email} • {r.phone}</div>
                          </td>
                          <td style={{ padding: '24px 20px', color: '#aaa', fontSize: '0.95rem' }}>{r.address || 'N/A'}</td>
                          <td style={{ padding: '24px 20px' }}>{getStatusBadge(r)}</td>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {r.approvalStatus === 'Pending' && (
                                <>
                                  <button onClick={() => handleApproval(r.userId, true)} style={{ padding: '8px 16px', borderRadius: '10px', background: '#2ecc71', color: '#000', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem' }}>Approve</button>
                                  <button onClick={() => handleApproval(r.userId, false)} style={{ padding: '8px 16px', borderRadius: '10px', background: 'rgba(226, 75, 74, 0.1)', color: '#ff4d4d', border: '1px solid rgba(226, 75, 74, 0.3)', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>Reject</button>
                                </>
                              )}
                              {r.approvalStatus === 'Approved' && (
                                <button 
                                  onClick={() => handleToggleBlock(r.userId, 'restaurant')}
                                  style={{ 
                                    padding: '8px 16px', 
                                    borderRadius: '10px', 
                                    background: r.isBlocked ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 77, 77, 0.15)', 
                                    color: r.isBlocked ? '#2ecc71' : '#ff4d4d', 
                                    border: `1px solid ${r.isBlocked ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 77, 77, 0.3)'}`,
                                    cursor: 'pointer', 
                                    fontWeight: '700', 
                                    fontSize: '0.85rem' 
                                  }}
                                >
                                  {r.isBlocked ? 'Unblock Partner' : 'Block Partner'}
                                </button>
                              )}
                              {r.approvalStatus === 'Rejected' && (
                                <span style={{ color: '#666', fontSize: '0.9rem' }}>No action available</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={restaurantPage} totalPages={totalRestaurantPages} onPageChange={setRestaurantPage} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="glass" style={{ padding: '36px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', animation: 'fadeIn 0.4s ease-out' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '28px' }}>Platform Users ({filteredUsers.length})</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontWeight: '600' }}>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>No users matching search query.</div>
            ) : (
              <div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Name</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Email & Phone</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Role</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Joined Date</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '24px 20px', fontWeight: '800', fontSize: '1.05rem', color: '#fff' }}>{u.name}</td>
                          <td style={{ padding: '24px 20px' }}>
                            <div style={{ color: '#ddd', fontWeight: '600' }}>{u.email}</div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '2px' }}>{u.phone}</div>
                          </td>
                          <td style={{ padding: '24px 20px' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '16px', background: 'rgba(155, 89, 182, 0.1)', color: '#9b59b6', fontWeight: '700', fontSize: '0.85rem' }}>{u.role}</span>
                          </td>
                          <td style={{ padding: '24px 20px', color: '#aaa', fontSize: '0.95rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td style={{ padding: '24px 20px' }}>
                            {u.isBlocked ? (
                              <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d', fontSize: '0.8rem', fontWeight: '700' }}>Blocked</span>
                            ) : (
                              <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', fontSize: '0.8rem', fontWeight: '700' }}>Active</span>
                            )}
                          </td>
                          <td style={{ padding: '24px 20px' }}>
                            <button 
                              onClick={() => handleToggleBlock(u.id, 'user')}
                              style={{ 
                                padding: '8px 16px', 
                                borderRadius: '12px', 
                                background: u.isBlocked ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 77, 77, 0.15)', 
                                color: u.isBlocked ? '#2ecc71' : '#ff4d4d', 
                                border: `1px solid ${u.isBlocked ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 77, 77, 0.3)'}`,
                                cursor: 'pointer', 
                                fontWeight: '700', 
                                fontSize: '0.85rem' 
                              }}
                            >
                              {u.isBlocked ? 'Unblock User' : 'Block User'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={userPage} totalPages={totalUserPages} onPageChange={setUserPage} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'Orders' && (
          <div className="glass" style={{ padding: '36px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', animation: 'fadeIn 0.4s ease-out' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '28px' }}>Platform Order Ledger ({filteredOrders.length})</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontWeight: '600' }}>Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>No orders found.</div>
            ) : (
              <div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Order ID</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Customer</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Restaurant</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Amount</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '24px 20px', fontWeight: '800', fontFamily: 'monospace', color: '#00f3ff', fontSize: '1rem' }}>#{o.id.substring(0, 8)}</td>
                          <td style={{ padding: '24px 20px', fontWeight: '700', color: '#fff' }}>{o.customerName}</td>
                          <td style={{ padding: '24px 20px', color: '#ddd', fontWeight: '600' }}>{o.restaurantName}</td>
                          <td style={{ padding: '24px 20px', fontWeight: '900', color: '#2ecc71', fontSize: '1.1rem' }}>₹{o.totalAmount.toFixed(2)}</td>
                          <td style={{ padding: '24px 20px' }}>
                            <span style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem', fontWeight: '700' }}>{o.status}</span>
                          </td>
                          <td style={{ padding: '24px 20px', color: '#aaa', fontSize: '0.95rem' }}>{new Date(o.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={orderPage} totalPages={totalOrderPages} onPageChange={setOrderPage} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'Drivers' && (() => {
          const filteredDrivers = drivers.filter(d =>
            (d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
             d.phone.includes(searchQuery)) &&
            (driverStatusFilter === 'All' || d.approvalStatus === driverStatusFilter)
          );
          const totalDriverPages = Math.ceil(filteredDrivers.length / itemsPerPage);
          const paginatedDrivers = filteredDrivers.slice((driverPage - 1) * itemsPerPage, driverPage * itemsPerPage);
          const pending = drivers.filter(d => d.approvalStatus === 'Pending').length;
          const approved = drivers.filter(d => d.approvalStatus === 'Approved').length;
          const rejected = drivers.filter(d => d.approvalStatus === 'Rejected').length;

          return (
            <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
              {/* Summary Chips */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '28px' }}>
                {[
                  { label: 'All', count: drivers.length, color: '#00f3ff' },
                  { label: 'Pending', count: pending, color: '#f39c12' },
                  { label: 'Approved', count: approved, color: '#2ecc71' },
                  { label: 'Rejected', count: rejected, color: '#ff4d4d' },
                ].map(chip => (
                  <button key={chip.label} onClick={() => { setDriverStatusFilter(chip.label); setDriverPage(1); }}
                    style={{ padding: '8px 18px', borderRadius: '20px', border: `1px solid ${driverStatusFilter === chip.label ? chip.color : 'rgba(255,255,255,0.08)'}`, background: driverStatusFilter === chip.label ? `${chip.color}18` : 'transparent', color: driverStatusFilter === chip.label ? chip.color : '#666', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit, sans-serif' }}>
                    {chip.label}
                    <span style={{ background: driverStatusFilter === chip.label ? chip.color : 'rgba(255,255,255,0.06)', color: driverStatusFilter === chip.label ? '#000' : '#555', borderRadius: '10px', padding: '1px 7px', fontSize: '0.75rem', fontWeight: '900' }}>{chip.count}</span>
                  </button>
                ))}
              </div>

              <div className="glass" style={{ padding: '36px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '28px' }}>Driver Management ({filteredDrivers.length})</h2>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#888', fontWeight: '600' }}>Loading drivers...</div>
                ) : filteredDrivers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '80px 40px', color: '#666' }}>
                    <span style={{ fontSize: '3rem' }}>🛵</span>
                    <h3 style={{ marginTop: '16px', color: '#aaa', fontWeight: '700' }}>No Drivers Found</h3>
                    <p style={{ marginTop: '4px' }}>No drivers match the current filter.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                            <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Driver</th>
                            <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Contact</th>
                            <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Applied</th>
                            <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Availability</th>
                            <th style={{ padding: '16px 20px', color: '#888', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedDrivers.map(d => (
                            <tr key={d.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '20px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(243,156,18,0.2), rgba(243,156,18,0.05))', border: '1px solid rgba(243,156,18,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.1rem', color: '#f39c12', flexShrink: 0 }}>
                                    {d.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: '800', fontSize: '1rem', color: '#fff' }}>{d.name}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#555', marginTop: '2px', fontFamily: 'monospace' }}>#{d.userId.substring(0, 8)}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '20px 20px' }}>
                                <div style={{ fontWeight: '600', color: '#ddd', fontSize: '0.9rem' }}>{d.email}</div>
                                <div style={{ fontSize: '0.82rem', color: '#666', marginTop: '2px' }}>{d.phone || '—'}</div>
                              </td>
                              <td style={{ padding: '20px 20px', color: '#aaa', fontSize: '0.9rem' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                              <td style={{ padding: '20px 20px' }}>
                                {d.isBlocked ? (
                                  <span style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(255,77,77,0.12)', color: '#ff4d4d', fontSize: '0.8rem', fontWeight: '700' }}>Blocked</span>
                                ) : d.approvalStatus === 'Approved' ? (
                                  <span style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(46,204,113,0.12)', color: '#2ecc71', fontSize: '0.8rem', fontWeight: '700' }}>Approved</span>
                                ) : d.approvalStatus === 'Pending' ? (
                                  <span style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(243,156,18,0.12)', color: '#f39c12', fontSize: '0.8rem', fontWeight: '700' }}>⏳ Pending</span>
                                ) : (
                                  <span style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(255,77,77,0.08)', color: '#ff4d4d', fontSize: '0.8rem', fontWeight: '700' }}>Rejected</span>
                                )}
                              </td>
                              <td style={{ padding: '20px 20px' }}>
                                {d.approvalStatus === 'Approved' && !d.isBlocked ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: d.isAvailable ? '#2ecc71' : '#888', fontWeight: '700', fontSize: '0.85rem' }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.isAvailable ? '#2ecc71' : '#555', display: 'inline-block' }} />
                                    {d.isAvailable ? 'Online' : 'Offline'}
                                  </span>
                                ) : (
                                  <span style={{ color: '#444', fontSize: '0.85rem' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '20px 20px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {d.approvalStatus === 'Pending' && (
                                    <>
                                      <button onClick={() => handleDriverApproval(d.userId, true)}
                                        style={{ padding: '7px 14px', borderRadius: '10px', background: '#2ecc71', color: '#000', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.82rem' }}>✓ Approve</button>
                                      <button onClick={() => handleDriverApproval(d.userId, false)}
                                        style={{ padding: '7px 14px', borderRadius: '10px', background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', border: '1px solid rgba(255,77,77,0.25)', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}>✗ Reject</button>
                                    </>
                                  )}
                                  {d.approvalStatus === 'Approved' && (
                                    <button onClick={() => handleToggleDriverBlock(d.userId)}
                                      style={{ padding: '7px 14px', borderRadius: '10px', background: d.isBlocked ? 'rgba(46,204,113,0.1)' : 'rgba(255,77,77,0.1)', color: d.isBlocked ? '#2ecc71' : '#ff4d4d', border: `1px solid ${d.isBlocked ? 'rgba(46,204,113,0.25)' : 'rgba(255,77,77,0.25)'}`, cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}>
                                      {d.isBlocked ? 'Unblock' : 'Block'}
                                    </button>
                                  )}
                                  {d.approvalStatus === 'Rejected' && (
                                    <button onClick={() => handleDriverApproval(d.userId, true)}
                                      style={{ padding: '7px 14px', borderRadius: '10px', background: 'rgba(0,243,255,0.08)', color: '#00f3ff', border: '1px solid rgba(0,243,255,0.2)', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}>Re-approve</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination currentPage={driverPage} totalPages={totalDriverPages} onPageChange={setDriverPage} />
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
};

export default AdminDashboard;
