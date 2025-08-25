import {toast} from "../toast";

export async function copyToClipboard(v: string) {
  try {
    await navigator.clipboard.writeText(v);
    toast.success("Password copied");
  } catch {
    toast.error("Could not copy");
  }
}