declare module 'ldapjs' {
  export function createClient(opts: { url: string }): any;
  export type Client = any;
}
