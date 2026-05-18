import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import AuthContainer from './AuthContainer'
import HomePage from './HomePage'
import AdminDashboard from './AdminDashboard'
import RestaurantDashboard from './RestaurantDashboard'
import './App.css'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);

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
    if (!isLoggedIn) {
      return <AuthContainer onLoginSuccess={() => window.location.reload()} />;
    }

    const currentRole = userRole || Cookies.get('userRole');

    switch (currentRole) {
      case 'Admin':
        return <AdminDashboard onLogout={handleLogout} />;
      case 'Restaurant':
        return <RestaurantDashboard onLogout={handleLogout} />;
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


