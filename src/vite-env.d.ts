/// <reference types="vite/client" />

declare module "*.svg?url" {
  const src: string;
  export default src;
}

declare module "@zumer/snapdom" {
  export const snapdom: {
    toCanvas: (element: HTMLElement, options?: { fast?: boolean }) => Promise<HTMLCanvasElement>;
  };
}
