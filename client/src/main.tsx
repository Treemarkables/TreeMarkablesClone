import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service worker registration - v11 dispatch fix
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ [v11] Service Worker registered:', registration.scope);
        
        // Check for updates every 5 minutes
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);
      })
      .catch(error => {
        console.error('❌ [v11] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <App />
);
