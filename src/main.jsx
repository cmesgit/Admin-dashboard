import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./css/index.css";

const RouteError = () => <main className="login-container"><section className="login-form" role="alert">
  <h2>This page couldn’t be opened</h2>
  <p>Your saved content is still available. Try reloading this page.</p>
  <button type="button" className="login-submit-btn" onClick={() => window.location.reload()}>Reload page</button>
  <a href="/">Back to the dashboard</a>
</section></main>;
const router = createBrowserRouter([{ path: "*", element: <AuthProvider><App /></AuthProvider>, errorElement: <RouteError /> }]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
