import {TemplateKey} from "../../components/sidebar";

export const ROUTES: Record<TemplateKey, string> = {
  logins: "/website-logins",
  notes: "/security-notes",
  grid: "/spreadsheet",
};

export const pathToKey = (p: string): TemplateKey =>
    p.startsWith("/security-notes") ? "notes" :
        p.startsWith("/spreadsheet")   ? "grid"   : "logins";