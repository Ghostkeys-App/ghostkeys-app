import {WebsiteLogin} from "../../utility/vault-provider/types";
import React from "react";

export function siteIconFor(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  if (n.includes("google")) return "/google.png";
  if (n.includes("github")) return "/github.jpeg";
  if (n === "x" || n.includes("twitter")) return "/twitter.png";
  if (n.includes("aws")) return "/aws.png";
  if (n.includes("facebook")) return "/facebook.png";
  if (n.includes("dropbox")) return "/dropbox.png";
  return undefined;
}

export function exportJson(websiteLogins: WebsiteLogin[]) {
  const blob = new Blob([JSON.stringify(websiteLogins, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "website-logins.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function IconButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (<button className={"website-logins-icon-button"} onClick={onClick}>{children}</button>);
}