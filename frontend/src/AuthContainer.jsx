import { useState } from "react";
import { useGoogleLogin } from '@react-oauth/google';
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import "./Auth.css";
import heroImg from "./assets/dinedrop_hero.png";

export default function AuthContainer({ onLoginSuccess }) {
  const [view, setView] = useState("login"); // 'login' | 'register'
  const [animating, setAnimating] = useState(false);

  const switchView = (newView) => {
    setAnimating(true);
    setTimeout(() => {
      setView(newView);
      setAnimating(false);
    }, 350);
  };

  // ── Login ──────────────────────────────────────────────
  const handleLogin = async (data) => {
    try {
      const response = await fetch("http://localhost:5070/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (response.ok) {
        localStorage.clear();
        if (onLoginSuccess) onLoginSuccess();
      } else {
        const error = await response.text();
        alert("Login failed: " + error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ── Customer Register ───────────────────────────────────
  const handleRegister = async (data) => {
    try {
      const response = await fetch("http://localhost:5070/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.fname,
          email: data.email,
          phone: data.phone || "0000000000",
          password: data.password,
        }),
        credentials: 'include'
      });
      if (response.ok) {
        alert("Account created! Please login.");
        switchView("login");
      } else {
        const error = await response.text();
        alert("Registration failed: " + error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ── Restaurant Register ─────────────────────────────────
  const handleRegisterRestaurant = async (data) => {
    try {
      const payload = {
        ...data,
        latitude: parseFloat(data.latitude) || 0,
        longitude: parseFloat(data.longitude) || 0,
      };
      const response = await fetch("http://localhost:5070/api/auth/register-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        alert("Restaurant application submitted! Please wait for admin approval.");
        switchView("login");
      } else {
        const error = await response.text();
        alert("Registration failed: " + error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ── Driver Register ─────────────────────────────────────
  const handleRegisterDriver = async (data) => {
    try {
      const response = await fetch("http://localhost:5070/api/auth/register-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          password: data.password,
          vehicleType: data.vehicleType,
          licenseNumber: data.licenseNumber,
          vehicleNumber: data.vehicleNumber || "",
        }),
      });
      if (response.ok) {
        alert("Driver application submitted! Please wait for admin approval.");
        switchView("login");
      } else {
        const error = await response.text();
        alert("Registration failed: " + error);
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ── Google Login ────────────────────────────────────────
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
        <div className="auth-form-container" style={{ maxWidth: view === "register" ? 500 : 440 }}>
          <div className={`form-content-wrapper ${animating ? 'fade-exit-active' : 'fade-enter-active'}`}>
            {view === "login" && (
              <LoginForm
                onSwitchToRegister={() => switchView("register")}
                onLogin={handleLogin}
                onGoogleLogin={() => googleLogin()}
              />
            )}
            {view === "register" && (
              <RegisterForm
                onSwitchToLogin={() => switchView("login")}
                onRegister={handleRegister}
                onRegisterRestaurant={handleRegisterRestaurant}
                onRegisterDriver={handleRegisterDriver}
                onGoogleLogin={() => googleLogin()}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
