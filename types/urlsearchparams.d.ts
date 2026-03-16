// Fix: unify URLSearchParams iterator signature between DOM and Node types
// This augments the global interface to ensure [Symbol.iterator] has a consistent
// signature and prevents conflicting-declaration diagnostics.
interface URLSearchParams {
  [Symbol.iterator](): IterableIterator<[string, string]>;
}
export {};
