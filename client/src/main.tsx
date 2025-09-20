// Bypass Vite HMR system that's causing the RefreshRuntime error
console.log("🚀 Starting app initialization...");

// Clear service workers immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
    console.log("Service workers cleared");
  });
}

// Delay imports to avoid plugin conflicts
setTimeout(async () => {
  try {
    console.log("Loading React modules...");
    
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const AppModule = await import('./App');
    
    // Import CSS after React to avoid conflicts
    await import('./index.css');
    
    console.log("✅ All modules loaded successfully");
    
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element not found");
    }

    const root = createRoot(rootElement);
    
    // Use React.createElement to avoid JSX compilation issues with plugins
    root.render(
      React.createElement(React.StrictMode, null,
        React.createElement(AppModule.default)
      )
    );
    
    console.log("✅ App rendered successfully");
    
  } catch (error) {
    console.error("❌ App initialization failed:", error);
    
    const rootElement = document.getElementById("root");
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 40px; text-align: center; font-family: Arial, sans-serif; background: #f8fafc; min-height: 100vh;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #dc2626; margin-bottom: 20px;">🌲 Application Loading Issue</h1>
            <p style="color: #374151; margin-bottom: 20px;">The tree removal dashboard is experiencing a temporary loading issue.</p>
            <div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="color: #991b1b; font-family: monospace; font-size: 14px;">${error instanceof Error ? error.message : String(error)}</p>
            </div>
            <p style="color: #6b7280;">Please try:</p>
            <ul style="text-align: left; color: #6b7280; margin: 20px 0;">
              <li>Refreshing the page (Ctrl+F5 or Cmd+Shift+R)</li>
              <li>Clearing browser cache and cookies</li>
              <li>Opening in a new incognito/private window</li>
            </ul>
            <button onclick="window.location.reload()" style="background: #2563eb; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
              Refresh Page
            </button>
          </div>
        </div>
      `;
    }
  }
}, 500); // Small delay to let the page settle
