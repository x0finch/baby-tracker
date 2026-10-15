interface ImportMetaEnv {
  /** Short commit the app was built from, or `dev` for local builds. */
  readonly APP_BUILD: string
  /** When the app was built, in milliseconds since the epoch. */
  readonly APP_BUILT_AT: number
}
