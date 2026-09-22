/**
 * The interaction keyboard map: one table, one action per key, no duplicates.
 *
 * Keys the render pipeline's navigation controller already owns — arrows, WASD,
 * `+`/`-`, `M` for the camera mode and `R` to reset — are deliberately *not*
 * repeated here. The interaction map covers the features this layer adds:
 * camera modes, the five viewpoints, the tour, closing an inspection, stepping
 * the timeline, cycling quality and muting the soundscape. A unit check asserts
 * the two maps are disjoint, so "no duplicate bindings" is a property of the
 * data rather than a promise in a comment.
 *
 * The table is also the source of the controls document: {@link shortcutRows}
 * renders it as a Markdown table and the unit suite asserts every row appears in
 * `docs/controls.md`, which is what keeps the documentation honest.
 */

import type { CameraMode } from '../scene'

/** Families the shortcut map documents, in the order the help lists them. */
export const SHORTCUT_GROUPS = [
  'camera',
  'viewpoints',
  'tour',
  'inspection',
  'era',
  'quality',
  'audio',
] as const

export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number]

/** Heading shown for each family in the controls document and the legend. */
export const SHORTCUT_GROUP_LABELS: Readonly<Record<ShortcutGroup, string>> = {
  camera: 'Camera modes',
  viewpoints: 'Viewpoints',
  tour: 'Cinematic tour',
  inspection: 'Object inspection',
  era: 'Stepping through time',
  quality: 'Quality',
  audio: 'Sound',
}

/** What a bound key does. */
export type ShortcutAction =
  | 'camera.orbit'
  | 'camera.street'
  | 'tour.toggle'
  | 'inspection.close'
  | 'era.previous'
  | 'era.next'
  | 'quality.cycle'
  | 'audio.mute'
  | `viewpoint.${string}`

/** One documented key binding. */
export interface ShortcutEntry {
  /** Stable id; also the React key and the document anchor. */
  readonly id: string
  readonly group: ShortcutGroup
  /** Key as the viewer sees it, e.g. `T` or `[`. */
  readonly keys: string
  /** `KeyboardEvent.code` values that trigger it. */
  readonly codes: readonly string[]
  readonly description: string
  readonly action: ShortcutAction
}

/** The interaction keyboard map: the single source of the help copy. */
export const INTERACTION_SHORTCUTS: readonly ShortcutEntry[] = [
  {
    id: 'camera-orbit',
    group: 'camera',
    keys: 'O',
    codes: ['KeyO'],
    description: 'Switch to the orbit camera (circle and look at the block).',
    action: 'camera.orbit',
  },
  {
    id: 'camera-street',
    group: 'camera',
    keys: 'C',
    codes: ['KeyC'],
    description: 'Switch to the street camera (walk and look around at eye level).',
    action: 'camera.street',
  },
  {
    id: 'viewpoint-street-corner',
    group: 'viewpoints',
    keys: '1',
    codes: ['Digit1'],
    description: 'Go to the street-corner viewpoint.',
    action: 'viewpoint.street-corner',
  },
  {
    id: 'viewpoint-curb-crossing',
    group: 'viewpoints',
    keys: '2',
    codes: ['Digit2'],
    description: 'Go to the curb-level crossing viewpoint.',
    action: 'viewpoint.curb-crossing',
  },
  {
    id: 'viewpoint-storefront-closeup',
    group: 'viewpoints',
    keys: '3',
    codes: ['Digit3'],
    description: 'Go to the storefront close-up viewpoint.',
    action: 'viewpoint.storefront-closeup',
  },
  {
    id: 'viewpoint-rooftop',
    group: 'viewpoints',
    keys: '4',
    codes: ['Digit4'],
    description: 'Go to the rooftop viewpoint.',
    action: 'viewpoint.rooftop',
  },
  {
    id: 'viewpoint-aerial',
    group: 'viewpoints',
    keys: '5',
    codes: ['Digit5'],
    description: 'Go to the aerial establishing shot.',
    action: 'viewpoint.aerial',
  },
  {
    id: 'tour-toggle',
    group: 'tour',
    keys: 'T',
    codes: ['KeyT'],
    description: 'Start or stop the cinematic tour of the block.',
    action: 'tour.toggle',
  },
  {
    id: 'inspection-close',
    group: 'inspection',
    keys: 'Esc',
    codes: ['Escape'],
    description: 'Release the focused object (or stop the tour) and return the camera.',
    action: 'inspection.close',
  },
  {
    id: 'era-previous',
    group: 'era',
    keys: '[',
    codes: ['BracketLeft'],
    description: 'Step one era older.',
    action: 'era.previous',
  },
  {
    id: 'era-next',
    group: 'era',
    keys: ']',
    codes: ['BracketRight'],
    description: 'Step one era newer.',
    action: 'era.next',
  },
  {
    id: 'quality-cycle',
    group: 'quality',
    keys: 'Q',
    codes: ['KeyQ'],
    description: 'Cycle High → Medium → Low; choosing by hand stops automatic quality.',
    action: 'quality.cycle',
  },
  {
    id: 'audio-mute',
    group: 'audio',
    keys: 'N',
    codes: ['KeyN'],
    description: 'Mute or restore the soundscape (Enable sound is still the first step).',
    action: 'audio.mute',
  },
]

/** `code` → action, built once from the table. */
export const SHORTCUT_BINDINGS: Readonly<Record<string, ShortcutAction>> = Object.freeze(
  INTERACTION_SHORTCUTS.reduce<Record<string, ShortcutAction>>((bindings, entry) => {
    for (const code of entry.codes) {
      bindings[code] = entry.action
    }
    return bindings
  }, {}),
)

/** Every `code` in the map, in table order, including any duplicates. */
export function shortcutCodes(
  entries: readonly ShortcutEntry[] = INTERACTION_SHORTCUTS,
): readonly string[] {
  return entries.flatMap((entry) => entry.codes)
}

/** Codes bound more than once across the community of entries. */
export function duplicateBindings(
  entries: readonly ShortcutEntry[] = INTERACTION_SHORTCUTS,
): readonly string[] {
  const counts = new Map<string, number>()
  for (const code of shortcutCodes(entries)) {
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  const duplicates: string[] = []
  for (const [code, count] of counts) {
    if (count > 1) {
      duplicates.push(code)
    }
  }
  return duplicates.sort()
}

/** Throws when the map binds a key twice; used by the unit suite and callers. */
export function assertNoDuplicateBindings(
  entries: readonly ShortcutEntry[] = INTERACTION_SHORTCUTS,
): void {
  const duplicates = duplicateBindings(entries)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate shortcut bindings: ${duplicates.join(', ')}`)
  }
}

/** Key events the matcher needs; a DOM `KeyboardEvent` satisfies it. */
export interface ShortcutKeyEvent {
  readonly code: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
  readonly shiftKey?: boolean
  readonly target?: EventTarget | null
}

/**
 * True when a key event came from a form control.
 *
 * Typing in a field must never drive the scene, which is why the pipeline's own
 * key handler checks the same thing.
 */
export function isFormTarget(target: EventTarget | null | undefined): boolean {
  if (target === null || target === undefined || typeof target !== 'object') {
    return false
  }
  const element = target as {
    readonly tagName?: unknown
    readonly isContentEditable?: unknown
    readonly getAttribute?: (name: string) => string | null
  }
  if (element.isContentEditable === true) {
    return true
  }
  const tag = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') {
    return true
  }
  if (typeof element.getAttribute === 'function') {
    const role = element.getAttribute('role')
    if (role === 'textbox' || role === 'slider' || role === 'spinbutton') {
      return true
    }
  }
  return false
}

/**
 * Resolves a key event to an action, or `null` when the map does not own it.
 *
 * Modified keystrokes (Ctrl/Cmd/Alt) and keystrokes from form controls are left
 * alone so browser and overlay shortcuts keep working.
 */
export function matchShortcut(event: ShortcutKeyEvent): ShortcutAction | null {
  if (event.ctrlKey === true || event.metaKey === true || event.altKey === true) {
    return null
  }
  if (isFormTarget(event.target)) {
    return null
  }
  return SHORTCUT_BINDINGS[event.code] ?? null
}

/** KeyboardAction the shortcut intends for camera mode switches, if any. */
export function cameraModeForAction(action: ShortcutAction): CameraMode | null {
  if (action === 'camera.orbit') {
    return 'orbit'
  }
  if (action === 'camera.street') {
    return 'street'
  }
  return null
}

/** Viewpoint id an action selects, or `null` when it is not a viewpoint action. */
export function viewpointForAction(action: ShortcutAction): string | null {
  return action.startsWith('viewpoint.') ? action.slice('viewpoint.'.length) : null
}

/** Markdown rows of the map, used in `docs/controls.md` and by its check. */
export function shortcutRows(entries: readonly ShortcutEntry[] = INTERACTION_SHORTCUTS): readonly string[] {
  return entries.map((entry) => `| ${entry.keys} | ${entry.description} |`)
}

/** Entries of one group, in table order. */
export function shortcutsInGroup(
  group: ShortcutGroup,
  entries: readonly ShortcutEntry[] = INTERACTION_SHORTCUTS,
): readonly ShortcutEntry[] {
  return entries.filter((entry) => entry.group === group)
}

/** Comma-separated list of the keys one group uses, for the help copy. */
export function groupKeys(
  group: ShortcutGroup,
  entries: readonly ShortcutEntry[] = INTERACTION_SHORTCUTS,
): string {
  return shortcutsInGroup(group, entries)
    .map((entry) => entry.keys)
    .join(', ')
}
