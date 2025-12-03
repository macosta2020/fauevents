import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Imports your main UI component

// Get the root element from index.html
const rootElement = document.getElementById('root');

if (rootElement) {
  // Create a React root and render the main App component
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element to mount the React application.");
}