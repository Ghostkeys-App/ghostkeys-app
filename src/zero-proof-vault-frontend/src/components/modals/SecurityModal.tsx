import React, { useState, useEffect } from "react";
import GKModal from "../new-design/GKModal.tsx";
import {toast} from "../../utility/toast";

const STAGING_PASSWORD = "You_shall_not_pasS12345";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");

  useEffect(() => {
    setOpen(true);
  }, []);

  const handleSubmit = () => {
    if (input === STAGING_PASSWORD) {
      setOpen(false);
    } else {
      toast.error('Incorrect Password', {idiotProof: true});
    }
  };

  return (
      <>
        <GKModal
            open={open}
            onClose={() => {}}
            title="Enter the password"
            description="The access to beta staging is secured with a password"
            actions={
              <>
                <button className="gk-btn ghost" type="button" onClick={handleSubmit}>Unlock</button>
              </>
            }
        >
          <form className="gk-form">
            <label className="gk-field">
              <span>The password: </span>
              <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="border p-2 rounded"
                  placeholder="Password"
                  autoFocus
              />
            </label>
          </form>
        </GKModal>

        {!open && children}
      </>
  );
}