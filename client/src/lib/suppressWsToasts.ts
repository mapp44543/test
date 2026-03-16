let suppressed = false;

export function setSuppressWsToasts(v: boolean) {
  suppressed = v;
}

export function getSuppressWsToasts() {
  return suppressed;
}
