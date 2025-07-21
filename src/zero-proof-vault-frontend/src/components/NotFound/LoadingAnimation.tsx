import React, { useState, useEffect } from "react";
import { Progress } from "antd";

const LoadingAnimation = () => {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const interval = 10; // ms between updates
    const increment = 1; // how much to increment each time

    const timer = setInterval(() => {
      setPercent((prevPercent) => {
        if (prevPercent >= 100) {
          return 0;
        }
        return prevPercent + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        padding: "30px",
        margin: "auto",
        height: "90vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Progress
        type="dashboard"
        percent={percent}
        status="active"
        showInfo={false}
        strokeColor={{
          "0%": "#108ee9",
          "100%": "#87d068",
        }}
      />
    </div>
  );
};

export default LoadingAnimation;
