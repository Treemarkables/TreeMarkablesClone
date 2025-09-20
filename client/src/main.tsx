import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root")!;

// Test with minimal HTML
rootElement.innerHTML = `
  <div style="padding: 20px;">
    <h1>Basic HTML Test</h1>
    <p>If you see this, the basic loading works.</p>
    <p>Now loading React...</p>
  </div>
`;

// Try to create React root
try {
  const MinimalComponent = () => {
    return (
      <div style={{ padding: '20px' }}>
        <h1>React is Working!</h1>
        <p>This is rendered by React without any hooks.</p>
      </div>
    );
  };
  
  const root = createRoot(rootElement);
  root.render(<MinimalComponent />);
} catch (error) {
  console.error("Error with React:", error);
  rootElement.innerHTML += `<p style="color: red;">React Error: ${error}</p>`;
}
