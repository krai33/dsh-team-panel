/** Ambient module declarations for the extracted rc.1 dependency sources.
 *
 * The typecheck pulls ui-primitives/ui-workspace sources through tsconfig
 * `paths`; their dev-only imports (CSS modules, clsx, markdown/shiki stack)
 * have no local installs. They are irrelevant to this plugin's own surface —
 * declarations silence only those lookups.
 */
declare module 'clsx' {
  export function clsx(...parts: unknown[]): string
  const _default: typeof clsx
  export default _default
}
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
declare module '*?inline' {
  const text: string
  export default text
}
declare module 'simple-icons' {
  export const si: Record<string, { path: string }>
}
