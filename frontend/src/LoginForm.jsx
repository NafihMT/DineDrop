import { useState } from "react";

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginForm({ onSwitchToRegister, onGoogleLogin, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !password) return alert("Please fill in all fields.");
    if (onLogin) {
      onLogin({ email, password });
    } else {
      alert(`Signed in as ${email}`);
    }
  };

  const handleGoogle = () => {
    if (onGoogleLogin) {
      onGoogleLogin();
    } else {
      alert("Connect Google Identity Services (GIS) to enable Google login.");
    }
  };

  return (
    <div>
      <h2 className="auth-title">Welcome back</h2>
      <p className="auth-subtitle">Sign in to continue your food journey.</p>

      {/* Google */}
      <button
        type="button"
        className="auth-social-btn"
        onClick={handleGoogle}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="auth-divider">
        or
      </div>

      <form onSubmit={handleSubmit}>
        {/* Email */}
        <div className="auth-form-group">
          <label htmlFor="login-email" className="auth-label">Email address</label>
          <div className="auth-input-wrapper">
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </div>
        </div>

        {/* Password */}
        <div className="auth-form-group" style={{ marginBottom: '8px' }}>
          <label htmlFor="login-pw" className="auth-label">Password</label>
          <div className="auth-input-wrapper">
            <input
              id="login-pw"
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
            />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPw((v) => !v)}>
              <EyeIcon open={showPw} />
            </button>
          </div>
        </div>

        <a href="#" onClick={(e) => e.preventDefault()} className="auth-forgot-link">Forgot password?</a>

        <button type="submit" className="auth-submit-btn">
          Sign In
        </button>
      </form>

      <p className="auth-switch-text">
        Don't have an account?{" "}
        <span className="auth-switch-link" onClick={onSwitchToRegister}>
          Create one &rarr;
        </span>
      </p>
    </div>
  );
}