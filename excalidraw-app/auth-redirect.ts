export const getSafeAuthDestination = (redirect: string | null) => {
  if (!redirect?.startsWith("/") || redirect.startsWith("//")) {
    return "/";
  }

  const destination = new URL(redirect, "https://excalidraw.local");

  // The cross-domain auth callback adds this short-lived token while it
  // establishes the browser session. It is transport state, not part of the
  // page the user originally asked to visit.
  destination.searchParams.delete("ott");

  return `${destination.pathname}${destination.search}${destination.hash}`;
};
