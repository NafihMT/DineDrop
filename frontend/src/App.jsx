import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import AuthContainer from './AuthContainer'
import HomePage from './HomePage'
import AdminDashboard from './AdminDashboard'
import RestaurantDashboard from './RestaurantDashboard'
import DriverDashboard from './DriverDashboard'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('http://localhost:5070/api/auth/verify', {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          setIsLoggedIn(true);
          setUserRole(result.role);
        } else {
          // If verify fails, try to refresh
          const refreshRes = await fetch('http://localhost:5070/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          });

          if (refreshRes.ok) {
            const refreshResult = await refreshRes.json();
            setIsLoggedIn(true);
            setUserRole(refreshResult.role);
          } else {
            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };
    
    verifySession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5070/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error("Logout failed", err);
    }
    setIsLoggedIn(false);
    setUserRole(null);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: 'Outfit, sans-serif' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div className="spinner" style={{ width: '50px', height: '50px', border: '5px solid rgba(239, 159, 39, 0.1)', borderTop: '5px solid #ef9f27', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            <h3 style={{ fontWeight: '800', letterSpacing: '1px' }}>LOADING DINEDROP...</h3>
          </div>
        </div>
      );
    }

    if (!isLoggedIn) {
      return <AuthContainer onLoginSuccess={() => window.location.reload()} />;
    }

    const currentRole = userRole || Cookies.get('userRole');

    switch (currentRole) {
      case 'Admin':
        return <AdminDashboard onLogout={handleLogout} />;
      case 'Restaurant':
        return <RestaurantDashboard onLogout={handleLogout} />;
      case 'Driver':
        return <DriverDashboard onLogout={handleLogout} />;
      default:
        return <HomePage onLogout={handleLogout} />;
    }
  };

  return (
    <>
      {renderContent()}
    </>
  )
}

export default App


