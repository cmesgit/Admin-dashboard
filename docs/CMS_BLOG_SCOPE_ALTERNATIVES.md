# Blog CMS: scope alternatives not taken

When the media library and i18n features were built (2026-08-14), the user
was offered a smaller-scope option for each and chose the bigger one both
times. This file records what the smaller option would have looked like, so
a future session can reconsider without re-deriving the tradeoffs from
scratch — nothing here needs to be built; it's a reference for "what if we
rolled part of this back" or "how would a lighter version of this look."

## Media library: smaller option was "list + reuse + alt-text only"

**What shipped**: a full media library — browsable/searchable past uploads,
an alt-text field on insert, AND client-side cropping with a focal-point
picker (`react-easy-crop`, a new `crop` modal state, `focal_x`/`focal_y`
stored on `ContentImage`).

**The smaller option**: everything above except cropping/focal-point. That
would have meant:
- Skipping the `crop` state in `MediaLibraryModal.jsx` entirely — the
  modal's state machine collapses to just `browse → review → insert`.
- No `react-easy-crop` dependency.
- `ContentImage` would still gain `alt_text`/`title`/`width`/`height` (those
  serve the library grid and search regardless of cropping), but NOT
  `focal_x`/`focal_y` — those two columns exist purely to back the cropping
  UI's focal-point picker, which wouldn't exist in this scope.
- What you'd save: the crop UI is real interaction-design surface (drag a
  crop box, click-to-set a focal point, canvas-to-Blob plumbing) — cutting
  it removes most of the net-new UI complexity in this feature. What you'd
  lose: an author can't reframe/crop an image without leaving the editor to
  do it in an external tool first.

## i18n: smaller option was "skip it entirely for now"

**What shipped**: full English/Hindi support on `BlogPost` — a `locale` +
`translation_group` field pair (two full rows per translated post, not a
shared-identity/child-translation-table design), `/blogs/hi/...` public
routes, an English-fallback-with-banner instead of a 404 for untranslated
content, and admin tooling (`duplicate-translation` action, locale badge,
locale tab strip in the editor).

**The smaller option**: don't build this yet. The reasoning offered at the
time for defaulting to "skip" was that zero i18n infrastructure existed
anywhere in the 3 CMS repos, and it was a much bigger, more architecturally
invasive lift than the other items being tackled alongside it (media
library, bulk actions, tag autocomplete, accessibility pass, device
preview) — the kind of thing that usually deserves its own dedicated pass
rather than being bundled into a broader "polish the CMS" session.

If this ever needs to be rolled back or the model reconsidered:
- The chosen design (`locale` + `translation_group` on the same model,
  two full rows) was picked specifically because it reuses the *entire*
  existing publish/schedule/CRUD/cache pipeline unchanged — a Hindi post is
  "just another `BlogPost` row." The two alternatives considered and
  rejected were a shared-identity/child-translation-table model (parler-
  style — correct in the abstract, but would've meant moving `status`/
  `publish_at`/`view_count` onto a child table since those are genuinely
  independent per locale in practice, touching nearly every serializer/view
  in the app) and parallel `_en`/`_hi` columns on the same row
  (modeltranslation-style — doesn't scale past 2-3 locales, a new migration
  per locale added).
- Only `BlogPost` was migrated. The pattern generalizes cleanly to
  `CurrentAffair` (same `PublishableModel` shape) and to `FAQItem`/
  `Announcement`/`ShowcaseCourse` (no publish-workflow complication to
  worry about) if a future session wants to extend it — the homepage
  content blocks (`HomeContentBlock`/`HomeListItem`/`HomeFloater`) are
  positionally-ordered singletons per slot, which would need its own design
  pass for how ordering interacts with locale, not a direct copy of the
  `BlogPost` pattern.
- Target languages: `en` (default, unprefixed) + `hi` only. The signal for
  Hindi specifically came from a *separate* repo (`shikshacom_app`, the
  Flutter mobile app), which has its own planned `en`/`hi` locale pair
  documented in `docs/ARCHITECTURE.md` there — not from anything in these
  3 CMS repos. Worth checking that file again before deciding whether a
  3rd locale is actually warranted, rather than guessing.
