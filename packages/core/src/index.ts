export const greet = (name: string): string => {
  return `Hello, ${name}!`;
};

export const sum = (a: number, b: number): number => {
  return a + b;
};

// Expose the polynomial utilities as part of the public API
export * from "./poly";
export * from "./circle";
export * from "./fields";

// Export CPU backend lookups
export * from "./backend/cpu/lookups";
