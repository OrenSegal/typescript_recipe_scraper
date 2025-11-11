/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="dom" />
/// <reference lib="deno.window" />

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  [key: string]: any;
};

declare const console: Console;

declare interface Request extends globalThis.Request {}
declare interface Response extends globalThis.Response {}

declare module 'https://deno.land/std@0.192.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.39.0' {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): any;
}
