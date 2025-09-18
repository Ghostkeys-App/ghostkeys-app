import { useEffect } from "react";
import { initBridge } from "./bridge";

export default function App() {
  useEffect(() => { initBridge(); }, []);
  return (
    <div style={{padding:12,fontFamily:"Inter,system-ui"}}>
      <strong>GhostKeys Embed</strong>
      <div style={{opacity:.7}}>Waiting for parent…</div>
    </div>
  );
}
