/// <reference types="vite/client" />

// Allow importing CSS as side-effect modules
declare module '*.css' {
  const content: string;
  export default content;
}
