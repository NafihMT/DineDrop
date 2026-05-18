import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';

createRoot(document.getElementById('root')).render(

  <GoogleOAuthProvider clientId="463884300601-fd4j454v3n25l53q9n12u66thknbkc6f.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
)
