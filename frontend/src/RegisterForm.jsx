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

// ── Password strength meter ──────────────────────────────
function PasswordStrength({ value }) {
  const getScore = (v) => {
    let s = 0;
    if (v.length >= 6) s++;
    if (v.length >= 10) s++;
    if (/[A-Z]/.test(v) && /[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  };
  const score = getScore(value);
  const colors = ["#E24B4A", "#EF9F27", "#97C459", "#1D9E75"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, height: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: 2,
              background: i < score ? colors[score - 1] : "rgba(255,255,255,0.1)",
              transition: "background .3s",
            }}
          />
        ))}
      </div>
      {value && (
        <p style={{ fontSize: 11, marginTop: 6, fontWeight: 500, color: score > 0 ? colors[score - 1] : "#aaa" }}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────
function TextField({ id, label, type = "text", placeholder, value, onChange }) {
  return (
    <div className="auth-form-group" style={{ marginBottom: '14px' }}>
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className="auth-input-wrapper">
        <input
          id={id} type={type} placeholder={placeholder} value={value} onChange={onChange}
          className="auth-input"
        />
      </div>
    </div>
  );
}

function PasswordField({ id, label, placeholder, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-form-group" style={{ marginBottom: '6px' }}>
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className="auth-input-wrapper">
        <input id={id} type={show ? "text" : "password"} placeholder={placeholder}
          value={value} onChange={onChange} className="auth-input" />
        <button type="button" className="auth-password-toggle" onClick={() => setShow((v) => !v)}>
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

// ── RegisterForm ─────────────────────────────────────────
export default function RegisterForm({ onSwitchToLogin, onGoogleLogin, onRegister }) {
  const [form, setForm] = useState({ fname: "", lname: "", email: "", password: "", terms: false });

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fname || !form.email || !form.password) {
      alert("Please fill in all required fields.");
      return;
    }
    if (!form.terms) {
      alert("Please accept the Terms of Service.");
      return;
    }
    if (onRegister) {
      onRegister(form);
    } else {
      alert(`Account created for ${form.fname}!`);
    }
  };

  const handleGoogle = () => {
    if (onGoogleLogin) {
      onGoogleLogin();
    } else {
      alert("Connect Google Identity Services (GIS) to enable Google sign-up.");
    }
  };

  return (
    <div>
      <h2 className="auth-title">Join DineDrop</h2>
      <p className="auth-subtitle">Create your free account and start ordering.</p>

      {/* Google */}
      <button
        type="button"
        className="auth-social-btn"
        onClick={handleGoogle}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Divider */}
      <div className="auth-divider">
        or
      </div>

      <form onSubmit={handleSubmit}>
        {/* Name row */}
        <div className="auth-row">
          <TextField id="r-fname" label="First name" placeholder="Arjun" value={form.fname} onChange={set("fname")} />
          <TextField id="r-lname" label="Last name" placeholder="Menon" value={form.lname} onChange={set("lname")} />
        </div>

        <TextField id="r-email" label="Email address" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} />

        <PasswordField id="r-pw" label="Password" placeholder="Create a strong password" value={form.password} onChange={set("password")} />
        <PasswordStrength value={form.password} />

        {/* Terms */}
        <label className="auth-terms-label">
          <input type="checkbox" checked={form.terms} onChange={set("terms")} className="auth-checkbox" />
          <span className="auth-terms-text">
            I agree to the{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            {" "}and{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          </span>
        </label>

        <button type="submit" className="auth-submit-btn">
          Create Account
        </button>
      </form>

      <p className="auth-switch-text">
        Already have an account?{" "}
        <span className="auth-switch-link" onClick={onSwitchToLogin}>
          Sign in &rarr;
        </span>
      </p>
    </div>
  );
}