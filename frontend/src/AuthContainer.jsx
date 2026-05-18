import { useState } from "react";
import { useGoogleLogin } from '@react-oauth/google';
import Cookies from 'js-cookie';
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import RestaurantRegisterForm from "./RestaurantRegisterForm";
import "./Auth.css";
import heroImg from "./assets/dinedrop_hero.png";

export default function AuthContainer({ onLoginSuccess }) {
  const [view, setView] = useState("login"); // 'login', 'register', 'restaurant-register'
  const [animating, setAnimating] = useState(false);

  const switchView = (newView) => {
    setAnimating(true);
    setTimeout(() => {
      setView(newView);
      setAnimating(false);
    }, 400);
  };

  const handleLogin = async (data) => {
    try {
      const response = await fetch("http://localhost:5070/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (response.ok) {
        localStorage.clear(); // Cleanup old storage
        if (onLoginSuccess) onLoginSuccess();
      } else {
        const error = await response.text();
        alert("Login failed: " + error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleRegister = async (data) => {
    try {
      const response = await fetch("http://localhost:5070/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${data.fname} ${data.lname}`,
          email: data.email,
          password: data.password,
          phone: "0000000000",
        }),
        credentials: 'include'
      });
      if (response.ok) {
        alert("Registration successful! Please login.");
        switchView("login");
      } else {
        const error = await response.text();
        alert("Registration failed: " + error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch('http://localhost:5070/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token }),
          credentials: 'include'
        });
        if (response.ok) {
          localStorage.clear();
          if (onLoginSuccess) onLoginSuccess();
        }
      } catch (err) {
        console.error(err);
      }
    }
  });

  return (
    <div className="auth-wrapper">
      <div className="auth-image-side">
        <img src={heroImg} alt="DineDrop Premium Food" />
        <div className="auth-image-overlay">
          <h1>DineDrop</h1>
          <p>Experience gourmet dining delivered directly to your door. Fresh, fast, and unforgettable.</p>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className={`form-content-wrapper ${animating ? 'fade-exit-active' : 'fade-enter-active'}`}>
            {view === "login" && (
              <LoginForm
                onSwitchToRegister={() => switchView("register")}
                onLogin={handleLogin}
                onGoogleLogin={() => googleLogin()}
              />
            )}
            {view === "register" && (
              <>
                <RegisterForm
                  onSwitchToLogin={() => switchView("login")}
                  onRegister={handleRegister}
                  onGoogleLogin={() => googleLogin()}
                />
                <p className="auth-switch-text" style={{ marginTop: '10px', fontSize: '0.85rem', textAlign: 'center' }}>
                    Want to sell on DineDrop?{" "}
                    <span className="auth-switch-link" onClick={() => switchView("restaurant-register")}>
                        Register Restaurant &rarr;
                    </span>
                </p>
              </>
            )}
            {view === "restaurant-register" && (
               <RestaurantRegisterForm 
                onSwitchToLogin={() => switchView("login")}
                onRegisterSuccess={() => switchView("login")}
               />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
