export function safeLocalStorage(): Pick<typeof localStorage, "getItem" | "setItem" | "removeItem"> {
  if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
    return localStorage as Pick<typeof localStorage, "getItem" | "setItem" | "removeItem">;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}
