import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Custom Map Panner to smoothly center coordinates when they shift
const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [center, map]);
  return null;
};

// Premium glowing SVG DivIcon factories
const createHomeIcon = () => L.divIcon({
  className: 'custom-map-marker home-marker',
  html: `
    <div style="
      width: 40px; height: 40px; 
      border-radius: 50%; 
      background: rgba(255, 77, 77, 0.2); 
      border: 2px solid #ff4d4d;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 15px #ff4d4d;
      animation: pulse 2s infinite;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const createRestaurantIcon = () => L.divIcon({
  className: 'custom-map-marker restaurant-marker',
  html: `
    <div style="
      width: 40px; height: 40px; 
      border-radius: 50%; 
      background: rgba(255, 170, 0, 0.2); 
      border: 2px solid #ffa000;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 15px #ffa000;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffa000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const createDriverIcon = () => L.divIcon({
  className: 'custom-map-marker driver-marker',
  html: `
    <div style="
      width: 46px; height: 46px; 
      border-radius: 50%; 
      background: rgba(46, 204, 113, 0.25); 
      border: 2.5px solid #2ecc71;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px #2ecc71;
      animation: bounce 1s infinite alternate;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      </svg>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23]
});

const OrderTrackingMap = ({ customerCoords, restaurantCoords, driverCoords, orderStatus }) => {
  const [center, setCenter] = useState([11.1202, 76.1200]);
  
  // Real street coordinates fetched from OpenStreetMap OSRM
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  
  const hasCustomer = customerCoords && customerCoords.lat && customerCoords.lng;
  const hasRestaurant = restaurantCoords && restaurantCoords.lat && restaurantCoords.lng;
  const hasRealDriver = driverCoords && driverCoords.lat && driverCoords.lng;

  // Fetch actual road coordinates from OpenStreetMap OSRM Routing API
  useEffect(() => {
    if (hasRestaurant && hasCustomer) {
      const fetchRoadRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${restaurantCoords.lng},${restaurantCoords.lat};${customerCoords.lng},${customerCoords.lat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0]) {
              // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng] format
              const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              setRouteCoordinates(coords);
            }
          }
        } catch (e) {
          console.error("Failed to query OSRM road routing engine:", e);
          setRouteCoordinates([]);
        }
      };
      fetchRoadRoute();
    } else {
      setRouteCoordinates([]);
    }
  }, [customerCoords, restaurantCoords, hasCustomer, hasRestaurant]);

  // Determine active driver coordinates priority (real-time stream only)
  const activeDriverCoords = orderStatus === 'Delivered' 
    ? null 
    : (hasRealDriver ? { lat: driverCoords.lat, lng: driverCoords.lng } : null);

  // Center on coordinates on load or when active driver coordinates shift
  useEffect(() => {
    if (activeDriverCoords && activeDriverCoords.lat && activeDriverCoords.lng) {
      setCenter([activeDriverCoords.lat, activeDriverCoords.lng]);
    } else if (customerCoords && customerCoords.lat && customerCoords.lng) {
      setCenter([customerCoords.lat, customerCoords.lng]);
    }
  }, [customerCoords, activeDriverCoords]);

  // Split routing coordinates array into past and future based on driver's current position
  const pastRoute = [];
  const futureRoute = [];

  if (orderStatus !== 'Delivered' && routeCoordinates.length > 0) {
    if (activeDriverCoords) {
      // Find closest node on street path to current driver location to split route visually
      let closestIndex = 0;
      let minDistance = Infinity;

      routeCoordinates.forEach((pt, idx) => {
        const dist = Math.pow(pt[0] - activeDriverCoords.lat, 2) + Math.pow(pt[1] - activeDriverCoords.lng, 2);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = idx;
        }
      });

      // Split the road geometry array
      pastRoute.push(...routeCoordinates.slice(0, closestIndex + 1));
      
      // Inject current position at boundaries for smooth connector lines
      pastRoute.push([activeDriverCoords.lat, activeDriverCoords.lng]);
      futureRoute.push([activeDriverCoords.lat, activeDriverCoords.lng]);
      
      futureRoute.push(...routeCoordinates.slice(closestIndex + 1));
    } else {
      // No driver active yet: full path is the future route
      futureRoute.push(...routeCoordinates);
    }
  } else {
    // No line segment fallback
  }



  return (
    <div style={{ height: '380px', width: '100%', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
      
      {/* Dynamic Key Overlay */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
        background: 'rgba(10, 10, 10, 0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px',
        padding: '12px 16px', fontSize: '0.75rem', color: '#fff',
        display: 'flex', flexDirection: 'column', gap: '8px',
        fontFamily: 'Outfit,sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff4d4d', boxShadow: '0 0 6px #ff4d4d' }}></span>
          <span style={{ fontWeight: '600' }}>Your Location</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ffa000', boxShadow: '0 0 6px #ffa000' }}></span>
          <span style={{ fontWeight: '600' }}>Restaurant</span>
        </div>
        {activeDriverCoords && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></span>
            <span style={{ fontWeight: '600', color: '#2ecc71' }}>
              Driver (Live)
            </span>
          </div>
        )}
      </div>

      <MapContainer 
        center={center} 
        zoom={14} 
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Home Marker */}
        {hasCustomer && (
          <Marker position={[customerCoords.lat, customerCoords.lng]} icon={createHomeIcon()} />
        )}

        {/* Restaurant Marker */}
        {hasRestaurant && (
          <Marker position={[restaurantCoords.lat, restaurantCoords.lng]} icon={createRestaurantIcon()} />
        )}

        {/* Driver Marker */}
        {activeDriverCoords && (
          <Marker position={[activeDriverCoords.lat, activeDriverCoords.lng]} icon={createDriverIcon()} />
        )}

        {/* Past Route Dotted Trail (Restaurant ➔ Driver) */}
        {pastRoute.length > 1 && (
          <Polyline 
            positions={pastRoute} 
            pathOptions={{ color: '#555555', weight: 2.5, dashArray: '5, 5', lineCap: 'round', lineJoin: 'round' }} 
          />
        )}

        {/* Future Route Glowing Neon Route (Driver ➔ Home) */}
        {futureRoute.length > 1 && (
          <>
            {/* Glowing neon backer line */}
            <Polyline 
              positions={futureRoute} 
              pathOptions={{ color: '#00f3ff', weight: 7, opacity: 0.15, lineCap: 'round', lineJoin: 'round' }} 
            />
            {/* Glowing active center routing line */}
            <Polyline 
              positions={futureRoute} 
              pathOptions={{ color: '#00f3ff', weight: 3.5, dashArray: '10, 8', lineCap: 'round', lineJoin: 'round' }} 
            />
          </>
        )}

        {/* Smooth Map Controller */}
        <MapController center={center} />
      </MapContainer>

      {/* Global CSS Inject for Animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.7); }
          77% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 77, 77, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 77, 77, 0); }
        }
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-4px); }
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .custom-map-marker {
          background: none !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
};

export default OrderTrackingMap;
