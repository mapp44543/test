import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTheme } from "./theme";

// Initialize theme (applies `.dark` class based on system preference or saved preference)
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
