import setEyeIcon from "../../public/setEye.svg"
import unSetEyeIcon from "../../public/unSetEye.svg"
import { useState, useEffect } from "react";

interface VaultCellProps {
  type: "text" | "password";
  value: string;
  onChange: (value: string) => void;
}

export default function VaultCell({ type, value, onChange }: VaultCellProps) {
  const [revealed, setRevealed] = useState(false);
  const [hasData, setHasData] = useState(false);
  const isSecret = type === "password";

  useEffect(() => {
    setHasData(value.length > 0);
  }, [value]);

  const handleChange = (newValue: string) => {
    setHasData(newValue.length > 0);
    onChange(newValue);
  };

  return (
    <div className="vault-cell-wrapper">
      <input
        type={isSecret && !revealed ? "password" : "text"}
        defaultValue={value}
        onBlur={(e) => handleChange(e.target.value)}
        className="vault-input"
      />
      {isSecret && hasData && (
        <img
          src={revealed ? unSetEyeIcon : setEyeIcon}
          alt={revealed ? "Hide" : "Show"}
          className="eye-toggle-icon"
          onClick={() => setRevealed(!revealed)}
        />
      )}
    </div>
  );
}

