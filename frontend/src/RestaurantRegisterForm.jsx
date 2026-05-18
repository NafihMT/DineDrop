import { useState } from 'react';
import LocationPicker from './LocationPicker';

const RestaurantRegisterForm = ({ onSwitchToLogin, onRegisterSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '',
    businessName: '', address: '', businessType: '', 
    registrationNumber: '', businessHours: '',
    description: '', latitude: '', longitude: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const parseCoordinate = (coord) => {
    if (!coord) return 0;
    const str = coord.toString();
    let val = parseFloat(str.replace(/[^0-9.-]/g, ''));
    if (str.toUpperCase().includes('S') || str.toUpperCase().includes('W')) {
      val = -Math.abs(val);
    }
    return val || 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        latitude: parseCoordinate(formData.latitude),
        longitude: parseCoordinate(formData.longitude)
      };

      const response = await fetch('http://localhost:5070/api/auth/register-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Registration successful! Please wait for admin approval.');
        onRegisterSuccess();
      } else {
        const err = await response.text();
        alert('Registration failed: ' + err);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ color: '#fff' }}>Step 1: Account Details</h3>
            <input type="text" name="name" value={formData.name || ''} placeholder="Full Name" onChange={handleChange} required className="auth-input" />
            <input type="email" name="email" value={formData.email || ''} placeholder="Email" onChange={handleChange} required className="auth-input" />
            <input type="text" name="phone" value={formData.phone || ''} placeholder="Phone" onChange={handleChange} required className="auth-input" />
            <input type="password" name="password" value={formData.password || ''} placeholder="Password" onChange={handleChange} required className="auth-input" />
            <button type="button" onClick={() => setStep(2)} className="auth-submit-btn">Next: Business Info</button>
          </div>
        );
      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ color: '#fff' }}>Step 2: Business Info</h3>
            <input type="text" name="businessName" value={formData.businessName || ''} placeholder="Business Name" onChange={handleChange} required className="auth-input" />
            <input type="text" name="address" value={formData.address || ''} placeholder="Address" onChange={handleChange} required className="auth-input" />
            <input type="text" name="businessType" value={formData.businessType || ''} placeholder="Type (e.g. Italian)" onChange={handleChange} required className="auth-input" />
            <input type="text" name="registrationNumber" value={formData.registrationNumber || ''} placeholder="Registration No." onChange={handleChange} required className="auth-input" />
            <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setStep(1)} className="auth-social-btn">Back</button>
                <button type="button" onClick={() => setStep(3)} className="auth-submit-btn">Next: Details</button>
            </div>
          </div>
        );
      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ color: '#fff' }}>Step 3: Final Details</h3>
            <textarea name="description" value={formData.description || ''} placeholder="Short Description" onChange={handleChange} className="auth-input" style={{ minHeight: '80px' }} />
            <input type="text" name="businessHours" value={formData.businessHours || ''} placeholder="Hours (e.g. 9AM-9PM)" onChange={handleChange} className="auth-input" />
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '-5px' }}>Click on the map to set your location</p>
            <LocationPicker 
              lat={formData.latitude} 
              lng={formData.longitude} 
              onLocationSelect={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" name="latitude" placeholder="Lat (e.g. 11.1202° N)" value={formData.latitude} onChange={handleChange} className="auth-input" />
              <input type="text" name="longitude" placeholder="Lon (e.g. 76.1200° E)" value={formData.longitude} onChange={handleChange} className="auth-input" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setStep(2)} className="auth-social-btn">Back</button>
                <button type="submit" className="auth-submit-btn">Finish Registration</button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="restaurant-register">
      <h2 className="auth-title">Partner with DineDrop</h2>
      <p className="auth-subtitle">Join thousands of restaurants grow their business.</p>
      
      <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
        {renderStep()}
      </form>

      <p className="auth-switch-text" style={{ marginTop: '20px' }}>
        Already registered?{" "}
        <span className="auth-switch-link" onClick={onSwitchToLogin}>
          Sign in &rarr;
        </span>
      </p>
    </div>
  );
};

export default RestaurantRegisterForm;
