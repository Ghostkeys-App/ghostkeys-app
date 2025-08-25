import {toast} from "../toast";

export async function copyToClipboard(v: string) {
  try {
    await navigator.clipboard.writeText(v);
    toast.success("Secret Coppied");
  } catch {
    toast.error("Couldn't copy");
  }
}