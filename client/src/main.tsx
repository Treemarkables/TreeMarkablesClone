console.log("Starting React app...");
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("React:", React);
console.log("createRoot:", createRoot);

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

try {
  const root = createRoot(rootElement!);
  console.log("Root created:", root);
  root.render(<App />);
  console.log("App rendered successfully");
} catch (error) {
  console.error("Error creating/rendering app:", error);
}
