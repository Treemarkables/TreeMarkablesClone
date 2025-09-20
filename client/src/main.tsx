import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Work around Replit plugin conflicts by ensuring proper initialization order
const initializeApp = () => {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element not found");
    }

    // Clear any service workers that might interfere
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister());
      });
    }

    const root = createRoot(rootElement);
    
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    
    console.log("✅ App initialized successfully");
    
  } catch (error) {
    console.error("❌ App initialization failed:", error);
    
    // Fallback: show error message directly
    const rootElement = document.getElementById("root");
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 20px; color: red; font-family: Arial, sans-serif;">
          <h2>Application Error</h2>
          <p>Failed to initialize React app: ${error.message}</p>
          <p>Please refresh the page to try again.</p>
        </div>
      `;
    }
  }
};

// Initialize immediately
initializeApp();
