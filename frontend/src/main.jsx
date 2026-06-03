import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';

// Override global alert (Toast Notification)
window.alert = (message) => {
  let toastContainer = document.getElementById('dd-global-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'dd-global-toast-container';
    Object.assign(toastContainer.style, {
      position: 'fixed',
      bottom: '24px', right: '24px',
      display: 'flex', flexDirection: 'column', gap: '12px',
      zIndex: '999999',
      pointerEvents: 'none' // Allow clicking through empty space
    });
    document.body.appendChild(toastContainer);
  }

  const toastBox = document.createElement('div');
  const isError = /error|fail|required|already exists|invalid/i.test(message);
  
  Object.assign(toastBox.style, {
    background: 'rgba(10, 10, 10, 0.85)',
    backdropFilter: 'blur(12px)',
    border: isError ? '1px solid rgba(255, 77, 77, 0.3)' : '1px solid rgba(0, 243, 255, 0.3)',
    borderLeft: isError ? '4px solid #ff4d4d' : '4px solid #00f3ff',
    borderRadius: '12px',
    padding: '16px 20px',
    minWidth: '300px',
    maxWidth: '400px',
    boxShadow: isError ? '0 10px 30px rgba(255,0,0,0.15)' : '0 10px 30px rgba(0,243,255,0.1)',
    color: '#fff',
    fontFamily: 'Outfit, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transform: 'translateX(120%)',
    opacity: '0',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    pointerEvents: 'auto',
    cursor: 'pointer' // Click to dismiss early
  });

  const icon = document.createElement('div');
  icon.innerHTML = isError ? '⚠️' : '✨';
  Object.assign(icon.style, {
    fontSize: '1.4rem',
    flexShrink: '0',
    textShadow: isError ? '0 0 10px rgba(255,77,77,0.5)' : '0 0 10px rgba(0,243,255,0.5)'
  });
  toastBox.appendChild(icon);

  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  Object.assign(messageEl.style, {
    fontSize: '0.95rem', lineHeight: '1.4', margin: '0', fontWeight: '500', color: '#eaeaea'
  });
  toastBox.appendChild(messageEl);

  toastContainer.appendChild(toastBox);

  // Animate in
  requestAnimationFrame(() => {
    toastBox.style.transform = 'translateX(0)';
    toastBox.style.opacity = '1';
  });

  // Function to dismiss
  let dismissed = false;
  const dismissToast = () => {
    if (dismissed) return;
    dismissed = true;
    toastBox.style.transform = 'translateX(120%)';
    toastBox.style.opacity = '0';
    setTimeout(() => {
      toastBox.remove();
      if (toastContainer.childNodes.length === 0) {
        toastContainer.remove();
      }
    }, 400);
  };

  // Click to dismiss early
  toastBox.onclick = dismissToast;

  // Auto-dismiss after 3.5 seconds
  setTimeout(dismissToast, 3500);
};

// Override global confirm (async)
window.confirm = (message) => {
  return new Promise((resolve) => {
    let alertContainer = document.getElementById('dd-global-alert-container');
    if (!alertContainer) {
      alertContainer = document.createElement('div');
      alertContainer.id = 'dd-global-alert-container';
      Object.assign(alertContainer.style, {
        position: 'fixed',
        top: '0', left: '0', right: '0', bottom: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        zIndex: '999999',
        background: 'rgba(5, 5, 5, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: '20px',
        opacity: '0',
        transition: 'opacity 0.3s ease'
      });
      document.body.appendChild(alertContainer);
      void alertContainer.offsetWidth;
      alertContainer.style.opacity = '1';
    }

    const alertBox = document.createElement('div');
    Object.assign(alertBox.style, {
      background: 'linear-gradient(145deg, #111, #1a1a1a)',
      border: '1px solid rgba(239, 159, 39, 0.2)',
      borderRadius: '24px',
      padding: '32px',
      maxWidth: '420px',
      width: '100%',
      boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(239, 159, 39, 0.05)',
      color: '#fff',
      fontFamily: 'Outfit, sans-serif',
      textAlign: 'center',
      transform: 'translateY(20px) scale(0.95)',
      opacity: '0',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: '0'
    });

    const glowBar = document.createElement('div');
    Object.assign(glowBar.style, {
      position: 'absolute', top: '0', left: '0', right: '0', height: '4px',
      background: 'linear-gradient(90deg, #ef9f27, #ff6b00)'
    });
    alertBox.appendChild(glowBar);

    const icon = document.createElement('div');
    icon.innerHTML = '❓';
    Object.assign(icon.style, {
      fontSize: '2.5rem', marginBottom: '16px', textShadow: '0 0 20px rgba(239, 159, 39, 0.5)'
    });
    alertBox.appendChild(icon);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    Object.assign(messageEl.style, {
      fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '28px', fontWeight: '500', color: '#e0e0e0'
    });
    alertBox.appendChild(messageEl);

    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
      display: 'flex', gap: '12px'
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      flex: 1,
      background: 'rgba(255,255,255,0.05)',
      color: '#aaa',
      border: '1px solid rgba(255,255,255,0.1)',
      padding: '14px',
      borderRadius: '16px',
      fontSize: '1rem',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'all 0.2s'
    });
    cancelBtn.onmouseover = () => { cancelBtn.style.background = 'rgba(255,255,255,0.1)'; cancelBtn.style.color = '#fff'; };
    cancelBtn.onmouseout = () => { cancelBtn.style.background = 'rgba(255,255,255,0.05)'; cancelBtn.style.color = '#aaa'; };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    Object.assign(confirmBtn.style, {
      flex: 1,
      background: 'linear-gradient(135deg, #ef9f27, #ff6b00)',
      color: '#000',
      border: 'none',
      padding: '14px',
      borderRadius: '16px',
      fontSize: '1rem',
      fontWeight: '800',
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(239, 159, 39, 0.3)',
      transition: 'transform 0.2s, box-shadow 0.2s'
    });
    confirmBtn.onmouseover = () => { confirmBtn.style.transform = 'translateY(-2px)'; confirmBtn.style.boxShadow = '0 12px 25px rgba(239, 159, 39, 0.4)'; };
    confirmBtn.onmouseout = () => { confirmBtn.style.transform = 'translateY(0)'; confirmBtn.style.boxShadow = '0 8px 20px rgba(239, 159, 39, 0.3)'; };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    alertBox.appendChild(btnContainer);
    alertContainer.appendChild(alertBox);

    requestAnimationFrame(() => {
      alertBox.style.transform = 'translateY(0) scale(1)';
      alertBox.style.opacity = '1';
    });

    const closeAlert = (result) => {
      alertBox.style.transform = 'translateY(-10px) scale(0.95)';
      alertBox.style.opacity = '0';
      setTimeout(() => {
        alertBox.remove();
        if (alertContainer.childNodes.length === 0) {
          alertContainer.style.opacity = '0';
          setTimeout(() => alertContainer.remove(), 300);
        }
        resolve(result);
      }, 300);
    };

    cancelBtn.onclick = () => closeAlert(false);
    confirmBtn.onclick = () => closeAlert(true);
  });
};

// Override global prompt (async)
window.prompt = (message, defaultValue = '', options = null) => {
  return new Promise((resolve) => {
    let alertContainer = document.getElementById('dd-global-alert-container');
    if (!alertContainer) {
      alertContainer = document.createElement('div');
      alertContainer.id = 'dd-global-alert-container';
      Object.assign(alertContainer.style, {
        position: 'fixed',
        top: '0', left: '0', right: '0', bottom: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        zIndex: '999999',
        background: 'rgba(5, 5, 5, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: '20px',
        opacity: '0',
        transition: 'opacity 0.3s ease'
      });
      document.body.appendChild(alertContainer);
      void alertContainer.offsetWidth;
      alertContainer.style.opacity = '1';
    }

    const alertBox = document.createElement('div');
    Object.assign(alertBox.style, {
      background: 'linear-gradient(145deg, #111, #1a1a1a)',
      border: '1px solid rgba(0, 243, 255, 0.2)',
      borderRadius: '24px',
      padding: '32px',
      maxWidth: '420px',
      width: '100%',
      boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(0, 243, 255, 0.05)',
      color: '#fff',
      fontFamily: 'Outfit, sans-serif',
      textAlign: 'center',
      transform: 'translateY(20px) scale(0.95)',
      opacity: '0',
      transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: '0'
    });

    const glowBar = document.createElement('div');
    Object.assign(glowBar.style, {
      position: 'absolute', top: '0', left: '0', right: '0', height: '4px',
      background: 'linear-gradient(90deg, #00f3ff, #0066ff)'
    });
    alertBox.appendChild(glowBar);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    Object.assign(messageEl.style, {
      fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '20px', fontWeight: '500', color: '#e0e0e0'
    });
    alertBox.appendChild(messageEl);

    let inputEl;
    if (options && Array.isArray(options)) {
      inputEl = document.createElement('select');
      Object.assign(inputEl.style, {
        width: '100%', padding: '12px 16px', marginBottom: '28px', borderRadius: '12px', boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
        fontSize: '1rem', fontFamily: 'Outfit, sans-serif', outline: 'none', appearance: 'none', cursor: 'pointer'
      });
      options.forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt;
        optionEl.textContent = opt;
        optionEl.style.background = '#111';
        optionEl.style.color = '#fff';
        if (opt === defaultValue) optionEl.selected = true;
        inputEl.appendChild(optionEl);
      });
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.value = defaultValue;
      Object.assign(inputEl.style, {
        width: '100%', padding: '12px 16px', marginBottom: '28px', borderRadius: '12px', boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
        fontSize: '1rem', fontFamily: 'Outfit, sans-serif', outline: 'none'
      });
    }

    inputEl.onfocus = () => { inputEl.style.borderColor = '#00f3ff'; };
    inputEl.onblur = () => { inputEl.style.borderColor = 'rgba(255,255,255,0.2)'; };
    alertBox.appendChild(inputEl);

    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, { display: 'flex', gap: '12px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      flex: 1, background: 'rgba(255,255,255,0.05)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)',
      padding: '14px', borderRadius: '16px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s'
    });
    cancelBtn.onmouseover = () => { cancelBtn.style.background = 'rgba(255,255,255,0.1)'; cancelBtn.style.color = '#fff'; };
    cancelBtn.onmouseout = () => { cancelBtn.style.background = 'rgba(255,255,255,0.05)'; cancelBtn.style.color = '#aaa'; };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Confirm';
    Object.assign(confirmBtn.style, {
      flex: 1, background: 'linear-gradient(135deg, #00f3ff, #0066ff)', color: '#000', border: 'none',
      padding: '14px', borderRadius: '16px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(0, 102, 255, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s'
    });
    confirmBtn.onmouseover = () => { confirmBtn.style.transform = 'translateY(-2px)'; confirmBtn.style.boxShadow = '0 12px 25px rgba(0, 102, 255, 0.4)'; };
    confirmBtn.onmouseout = () => { confirmBtn.style.transform = 'translateY(0)'; confirmBtn.style.boxShadow = '0 8px 20px rgba(0, 102, 255, 0.3)'; };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    alertBox.appendChild(btnContainer);
    alertContainer.appendChild(alertBox);

    requestAnimationFrame(() => {
      alertBox.style.transform = 'translateY(0) scale(1)';
      alertBox.style.opacity = '1';
      inputEl.focus();
    });

    const closeAlert = (result) => {
      alertBox.style.transform = 'translateY(-10px) scale(0.95)';
      alertBox.style.opacity = '0';
      setTimeout(() => {
        alertBox.remove();
        if (alertContainer.childNodes.length === 0) {
          alertContainer.style.opacity = '0';
          setTimeout(() => alertContainer.remove(), 300);
        }
        resolve(result);
      }, 300);
    };

    cancelBtn.onclick = () => closeAlert(null);
    confirmBtn.onclick = () => closeAlert(inputEl.value);
  });
};

createRoot(document.getElementById('root')).render(

  <GoogleOAuthProvider clientId="463884300601-fd4j454v3n25l53q9n12u66thknbkc6f.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
)
