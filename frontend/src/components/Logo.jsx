import React from "react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_mindmap-studio-5/artifacts/whhcz93v_m-logo.jpeg";

export const Logo = ({ size = 56, glow = true }) => {
  return (
    <div
      data-testid="brand-logo"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#030714",
        border: "1.5px solid rgba(0,240,255,0.55)",
        boxShadow: glow
          ? `0 0 14px rgba(0,240,255,0.55), inset 0 0 10px rgba(0,240,255,0.2)`
          : "none",
        flexShrink: 0,
      }}
    >
      <img
        src={LOGO_URL}
        alt="Marvex Studio logo — AI mind mapping app for PDFs and research"
        width={size}
        height={size}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
};

export default Logo;
