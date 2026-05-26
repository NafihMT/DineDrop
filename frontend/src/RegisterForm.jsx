import { useState } from "react";
import LocationPicker from "./LocationPicker";

// ── Password strength ─────────────────────────────────────
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
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: "flex", gap: 4, height: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, borderRadius: 2, background: i < score ? colors[score - 1] : "rgba(255,255,255,0.08)", transition: "background .3s" }} />
        ))}
      </div>
      {value && <p style={{ fontSize: 11, marginTop: 5, fontWeight: 600, color: score > 0 ? colors[score - 1] : "#aaa" }}>{labels[score]}</p>}
    </div>
  );
}

// ── Reusable field components ─────────────────────────────
function Field({ label, type = "text", placeholder, value, onChange, disabled }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#aaa", marginBottom: 6, letterSpacing: "0.3px" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={isPass ? (show ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="auth-input"
          style={{ paddingRight: isPass ? 44 : 16, opacity: disabled ? 0.4 : 1 }}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(v => !v)} className="auth-password-toggle">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {show ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#aaa", marginBottom: 6 }}>{label}</label>
      <select value={value} onChange={onChange} className="auth-input" style={{ cursor: "pointer" }}>
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map(o => <option key={o} value={o} style={{ background: "#111" }}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────
function RoleCard({ role, icon, title, subtitle, selected, onClick, accentColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: "18px 10px", borderRadius: 16, border: `2px solid ${selected ? accentColor : "rgba(255,255,255,0.07)"}`,
        background: selected ? `${accentColor}14` : "rgba(255,255,255,0.02)",
        cursor: "pointer", transition: "all 0.25s", textAlign: "center", position: "relative", overflow: "hidden"
      }}
    >
      <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: "0.9rem", fontWeight: 800, color: selected ? accentColor : "#ccc", margin: 0 }}>{title}</p>
      <p style={{ fontSize: "0.72rem", color: "#555", marginTop: 3, lineHeight: 1.3 }}>{subtitle}</p>
      {selected && <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: accentColor }} />}
    </button>
  );
}

// ── Progress Steps ─────────────────────────────────────────
function StepBar({ steps, current, accentColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28, gap: 0 }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "0.8rem", transition: "all 0.3s",
              background: i < current ? accentColor : i === current ? `${accentColor}22` : "rgba(255,255,255,0.05)",
              border: `2px solid ${i <= current ? accentColor : "rgba(255,255,255,0.1)"}`,
              color: i < current ? "#000" : i === current ? accentColor : "#555"
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: i <= current ? accentColor : "#444", whiteSpace: "nowrap" }}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? accentColor : "rgba(255,255,255,0.06)", margin: "0 6px", marginBottom: 18, transition: "background 0.3s" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── Main RegisterForm ─────────────────────────────────────
// ══════════════════════════════════════════════════════════
export default function RegisterForm({ onSwitchToLogin, onRegister, onRegisterRestaurant, onRegisterDriver }) {
  const [role, setRole] = useState(null);       // 'user' | 'restaurant' | 'driver'
  const [step, setStep] = useState(0);          // 0 = role picker, 1+ = form steps
  const [terms, setTerms] = useState(false);

  // User fields
  const [user, setUser] = useState({ name: "", email: "", phone: "", password: "" });

  // Restaurant fields
  const [rest, setRest] = useState({
    name: "", email: "", phone: "", password: "",
    businessName: "", businessType: "", address: "", registrationNumber: "",
    businessHours: "", description: "", latitude: 11.1202, longitude: 76.12
  });

  // Driver fields
  const [driver, setDriver] = useState({
    name: "", email: "", phone: "", password: "",
    vehicleType: "", licenseNumber: "", vehicleNumber: ""
  });

  const ROLES = [
    { id: "user",       icon: "🛒", title: "Customer",   subtitle: "Order food & track deliveries",  color: "#E8632A", steps: ["Account", "Done"] },
    { id: "restaurant", icon: "🍽️", title: "Restaurant", subtitle: "List your menu & accept orders",  color: "#00b894", steps: ["Account", "Business", "Location"] },
    { id: "driver",     icon: "🛵", title: "Driver",     subtitle: "Deliver orders & earn money",     color: "#0984e3", steps: ["Account", "Vehicle", "Done"] },
  ];

  const selected = ROLES.find(r => r.id === role);
  const accentColor = selected?.color ?? "#E8632A";
  const totalSteps = selected ? selected.steps.length : 1;

  const setU = k => e => setUser(f => ({ ...f, [k]: e.target.value }));
  const setR = k => e => setRest(f => ({ ...f, [k]: e.target.value }));
  const setD = k => e => setDriver(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!terms) { alert("Please accept the Terms of Service."); return; }
    if (role === "user") onRegister?.({ fname: user.name, lname: "", email: user.email, phone: user.phone, password: user.password });
    else if (role === "restaurant") onRegisterRestaurant?.(rest);
    else if (role === "driver") onRegisterDriver?.(driver);
  };

  // ── Step 0: Role Picker ───────────────────────────────
  if (step === 0) {
    return (
      <div>
        <h2 className="auth-title">Join DineDrop</h2>
        <p className="auth-subtitle">Choose how you'd like to get started.</p>

        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          {ROLES.map(r => (
            <RoleCard key={r.id} role={r.id} icon={r.icon} title={r.title} subtitle={r.subtitle}
              accentColor={r.color} selected={role === r.id} onClick={() => setRole(r.id)} />
          ))}
        </div>

        <button
          type="button"
          disabled={!role}
          onClick={() => setStep(1)}
          className="auth-submit-btn"
          style={{ background: role ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` : undefined, marginTop: 0 }}
        >
          Continue as {selected?.title ?? "..."} →
        </button>

        <p className="auth-switch-text">
          Already have an account?{" "}
          <span className="auth-switch-link" style={{ color: accentColor }} onClick={onSwitchToLogin}>Sign in →</span>
        </p>
      </div>
    );
  }

  // ── Form Steps ────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button type="button" onClick={() => { setStep(step > 1 ? step - 1 : 0); }}
          style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.3rem" }}>{selected?.icon}</span>
          <div>
            <h2 className="auth-title" style={{ fontSize: "1.6rem", margin: 0 }}>{selected?.title} Registration</h2>
            <p style={{ color: "#666", fontSize: "0.8rem", margin: 0 }}>Step {step} of {totalSteps - 1}</p>
          </div>
        </div>
      </div>

      <StepBar steps={selected?.steps ?? []} current={step} accentColor={accentColor} />

      <form onSubmit={handleSubmit}>
        {/* ─── USER FORM ─────────────────────────────── */}
        {role === "user" && step === 1 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Full Name" placeholder="Arjun Menon" value={user.name} onChange={setU("name")} />
              <Field label="Phone" placeholder="+91 98765 43210" value={user.phone} onChange={setU("phone")} />
            </div>
            <Field label="Email Address" type="email" placeholder="you@example.com" value={user.email} onChange={setU("email")} />
            <Field label="Password" type="password" placeholder="Create a strong password" value={user.password} onChange={setU("password")} />
            <PasswordStrength value={user.password} />
            <TermsCheck checked={terms} onChange={setTerms} color={accentColor} />
            <SubmitBtn label="Create Customer Account" color={accentColor} />
          </div>
        )}

        {/* ─── RESTAURANT FORM ─ Step 1: Account ──────── */}
        {role === "restaurant" && step === 1 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Owner Full Name" placeholder="Ravi Kumar" value={rest.name} onChange={setR("name")} />
              <Field label="Phone" placeholder="+91 98765 43210" value={rest.phone} onChange={setR("phone")} />
            </div>
            <Field label="Email Address" type="email" placeholder="restaurant@example.com" value={rest.email} onChange={setR("email")} />
            <Field label="Password" type="password" placeholder="Create a strong password" value={rest.password} onChange={setR("password")} />
            <PasswordStrength value={rest.password} />
            <NextBtn label="Next: Business Info →" color={accentColor} onClick={() => setStep(2)} />
          </div>
        )}

        {/* ─── RESTAURANT FORM ─ Step 2: Business ────── */}
        {role === "restaurant" && step === 2 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Business Name" placeholder="Spice Garden" value={rest.businessName} onChange={setR("businessName")} />
              <Field label="Cuisine Type" placeholder="South Indian" value={rest.businessType} onChange={setR("businessType")} />
            </div>
            <Field label="Street Address" placeholder="12 MG Road, Coimbatore" value={rest.address} onChange={setR("address")} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Registration No." placeholder="FSS-2023-001" value={rest.registrationNumber} onChange={setR("registrationNumber")} />
              <Field label="Business Hours" placeholder="9AM – 10PM" value={rest.businessHours} onChange={setR("businessHours")} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#aaa", marginBottom: 6 }}>Short Description</label>
              <textarea value={rest.description} onChange={setR("description")} placeholder="Authentic South Indian cuisine..." className="auth-input" style={{ minHeight: 72, resize: "vertical" }} />
            </div>
            <NextBtn label="Next: Set Location →" color={accentColor} onClick={() => setStep(3)} />
          </div>
        )}

        {/* ─── RESTAURANT FORM ─ Step 3: Location ────── */}
        {role === "restaurant" && step === 3 && (
          <div>
            <p style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: 10 }}>📍 Click on the map or search to pin your restaurant's exact location.</p>
            <LocationPicker lat={rest.latitude} lng={rest.longitude}
              onLocationSelect={(lat, lng) => setRest(f => ({ ...f, latitude: lat, longitude: lng }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <Field label="Latitude" placeholder="11.1202" value={rest.latitude} onChange={setR("latitude")} />
              <Field label="Longitude" placeholder="76.1200" value={rest.longitude} onChange={setR("longitude")} />
            </div>
            <TermsCheck checked={terms} onChange={setTerms} color={accentColor} />
            <SubmitBtn label="Submit Restaurant Application" color={accentColor} />
          </div>
        )}

        {/* ─── DRIVER FORM ─ Step 1: Account ─────────── */}
        {role === "driver" && step === 1 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Full Name" placeholder="Karthik S." value={driver.name} onChange={setD("name")} />
              <Field label="Phone" placeholder="+91 98765 43210" value={driver.phone} onChange={setD("phone")} />
            </div>
            <Field label="Email Address" type="email" placeholder="driver@example.com" value={driver.email} onChange={setD("email")} />
            <Field label="Password" type="password" placeholder="Create a strong password" value={driver.password} onChange={setD("password")} />
            <PasswordStrength value={driver.password} />
            <NextBtn label="Next: Vehicle Info →" color={accentColor} onClick={() => setStep(2)} />
          </div>
        )}

        {/* ─── DRIVER FORM ─ Step 2: Vehicle ──────────── */}
        {role === "driver" && step === 2 && (
          <div>
            <SelectField
              label="Vehicle Type"
              value={driver.vehicleType}
              onChange={setD("vehicleType")}
              options={["Bike", "Scooter", "Car", "Electric Bike", "Bicycle"]}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="License Number" placeholder="TN 0123456789" value={driver.licenseNumber} onChange={setD("licenseNumber")} />
              <Field label="Vehicle Number" placeholder="TN 38 AB 1234" value={driver.vehicleNumber} onChange={setD("vehicleNumber")} />
            </div>

            {/* Info Banner */}
            <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(9,132,227,0.08)", border: "1px solid rgba(9,132,227,0.2)", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.1rem" }}>ℹ️</span>
              <p style={{ color: "#aaa", fontSize: "0.82rem", lineHeight: 1.5, margin: 0 }}>
                Your account will be <strong style={{ color: "#fff" }}>reviewed by an admin</strong> before you can start accepting deliveries. This usually takes less than 24 hours.
              </p>
            </div>

            <TermsCheck checked={terms} onChange={setTerms} color={accentColor} />
            <SubmitBtn label="Submit Driver Application" color={accentColor} />
          </div>
        )}
      </form>

      <p className="auth-switch-text" style={{ marginTop: 16 }}>
        Already have an account?{" "}
        <span className="auth-switch-link" style={{ color: accentColor }} onClick={onSwitchToLogin}>Sign in →</span>
      </p>
    </div>
  );
}

// ── Tiny reusable helpers ─────────────────────────────────
function TermsCheck({ checked, onChange, color }) {
  return (
    <label className="auth-terms-label" style={{ marginBottom: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="auth-checkbox" />
      <span className="auth-terms-text">
        I agree to the <a href="#" onClick={e => e.preventDefault()} style={{ color }}>Terms of Service</a> and{" "}
        <a href="#" onClick={e => e.preventDefault()} style={{ color }}>Privacy Policy</a>
      </span>
    </label>
  );
}

function SubmitBtn({ label, color }) {
  return (
    <button type="submit" className="auth-submit-btn"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 6px 20px ${color}33`, marginTop: 8 }}>
      {label}
    </button>
  );
}

function NextBtn({ label, color, onClick }) {
  return (
    <button type="button" onClick={onClick} className="auth-submit-btn"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 6px 20px ${color}33`, marginTop: 8 }}>
      {label}
    </button>
  );
}