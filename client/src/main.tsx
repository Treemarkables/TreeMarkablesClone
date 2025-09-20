// Complete cache bypass test
const rootElement = document.getElementById("root")!;

// First show we can manipulate the DOM
rootElement.innerHTML = `
  <div style="padding: 20px; border: 2px solid green;">
    <h1>Direct DOM Test ✅</h1>
    <p>This works without any imports</p>
    <div id="test-react">Loading React test...</div>
  </div>
`;

// Force clear any service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
    console.log('Service workers cleared');
  });
}

// Test React with a slight delay to ensure everything is clear
setTimeout(() => {
  try {
    console.log('Attempting to import React...');
    
    import('react').then(React => {
      console.log('React imported successfully:', React);
      
      return import('react-dom/client');
    }).then(ReactDOM => {
      console.log('ReactDOM imported successfully:', ReactDOM);
      
      const testDiv = document.getElementById('test-react');
      if (testDiv && ReactDOM.createRoot) {
        testDiv.innerHTML = '<div style="color: green; font-weight: bold;">✅ React imports successful!</div>';
        
        // Try creating a simple component
        const SimpleComponent = React.createElement('div', {
          style: { padding: '10px', backgroundColor: '#e8f5e8', border: '1px solid green', margin: '10px 0' }
        }, 'React component rendered successfully! 🎉');
        
        const root = ReactDOM.createRoot(testDiv);
        root.render(SimpleComponent);
      }
    }).catch(error => {
      console.error('Import failed:', error);
      const testDiv = document.getElementById('test-react');
      if (testDiv) {
        testDiv.innerHTML = `<div style="color: red;">❌ Import Error: ${error.message}</div>`;
      }
    });
    
  } catch (error) {
    console.error('Failed to start React test:', error);
    const testDiv = document.getElementById('test-react');
    if (testDiv) {
      testDiv.innerHTML = `<div style="color: red;">❌ Error: ${error.message}</div>`;
    }
  }
}, 1000);
