import React, { useEffect } from "react";
import { initBridge } from "./bridge";

export default function App() {
  useEffect(() => { initBridge(); }, []);
  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>GhostKeys – Embed</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Waiting for parent app…</p>
      </div>
    </div>
  );
}
