import { Link, type LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { m } from '../paraglide/messages.js'
import { PageHeader } from './PageHeader'
import { Card } from './ui/Card'
import { Chevron } from './ui/Chevron'

/** A link back to the settings index, for pages opened from it. */
export function BackLink() {
  return (
    <Link
      to="/settings"
      className="flex min-h-touch items-center gap-1 self-start font-bold text-fg-muted"
    >
      <Chevron direction="left" />
      {m.actionBack()}
    </Link>
  )
}

/** A settings sub-page: back link, title and the page's cards. */
export function SettingsPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col">
        <BackLink />
        <PageHeader title={title} />
      </div>
      {children}
    </section>
  )
}

/** A titled card of rows on the settings index. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {title && <h2 className="m-0 px-1 text-caption font-bold text-fg-muted">{title}</h2>}
      <Card className="py-1">
        <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
      </Card>
    </div>
  )
}

/** One entry of a settings list: a title (with an optional pill), a one-line status and a chevron. */
export function SettingsRow({
  link,
  title,
  badge,
  summary,
}: {
  /** Where the row leads, as `Link` takes it (`to`, and `params` for a path like a family's). */
  link: LinkProps
  title: string
  badge?: ReactNode
  summary: string
}) {
  return (
    <li className="border-b-2 border-border last:border-b-0">
      <Link {...link} className="flex min-h-touch items-center gap-3 py-3 active:bg-surface">
        <span className="flex min-w-0 flex-1 flex-col">
          {badge ? (
            <span className="flex items-center gap-2">
              <span className="truncate font-extrabold">{title}</span>
              {badge}
            </span>
          ) : (
            <span className="truncate font-extrabold">{title}</span>
          )}
          <span className="truncate text-caption text-fg-muted">{summary}</span>
        </span>
        <Chevron />
      </Link>
    </li>
  )
}
