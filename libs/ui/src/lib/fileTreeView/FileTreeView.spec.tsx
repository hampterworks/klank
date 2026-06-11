import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { FileTreeView } from './FileTreeView.js'
import type { FileEntry } from '@klank/platform-api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeEntry = (artist: string, song: string, path?: string): FileEntry => ({
  name: `${artist} - ${song}`,
  path: path ?? `/tabs/${artist} - ${song}.tab.txt`,
  artist,
  song,
})

const DEFAULT_PROPS = {
  currentTabPath: '',
  setTabPath: vi.fn(),
  searchFilter: '',
}

/**
 * Render FileTreeView and return the song button for the given path.
 * Song buttons contain the song name as visible text inside a <span>.
 */
const getSongButton = (song: string) =>
  screen.getByRole('button', { name: new RegExp(song, 'i') })

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FileTreeView — context menu absent when onDeleteTab is omitted', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no context menu opens on right-click when onDeleteTab is not provided', () => {
    // Given: FileTreeView rendered WITHOUT the onDeleteTab prop
    // When: the user right-clicks a song button
    // Then: no role="menu" element appears in the document
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} />)

    const button = getSongButton('Creep')
    fireEvent.contextMenu(button)

    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('no Delete keydown opens a menu when onDeleteTab is not provided', () => {
    // Given: FileTreeView rendered WITHOUT onDeleteTab
    // When: Delete is pressed on a song button
    // Then: no role="menu" appears
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} />)

    const button = getSongButton('Creep')
    fireEvent.keyDown(button, { key: 'Delete' })

    expect(document.querySelector('[role="menu"]')).toBeNull()
  })
})

describe('FileTreeView — context menu with onDeleteTab', () => {
  beforeEach(() => vi.clearAllMocks())

  it('right-clicking a song opens the context menu', () => {
    // Given: FileTreeView with onDeleteTab provided
    // When: right-click on a song button
    // Then: a role="menu" element appears with a Delete menuitem
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    const onDeleteTab = vi.fn()
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} onDeleteTab={onDeleteTab} />)

    const button = getSongButton('Creep')
    fireEvent.contextMenu(button)

    expect(document.querySelector('[role="menu"]')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeTruthy()
  })

  it('clicking the Delete menuitem calls onDeleteTab with the correct path and does NOT call setTabPath', () => {
    // Given: the context menu is open for a specific song path
    // When: the user clicks the Delete menuitem
    // Then: onDeleteTab is called with that path; setTabPath is not called
    const entry = makeEntry('Radiohead', 'Creep')
    const onDeleteTab = vi.fn()
    const setTabPath = vi.fn()
    render(
      <FileTreeView
        tree={[entry]}
        currentTabPath=""
        setTabPath={setTabPath}
        searchFilter=""
        onDeleteTab={onDeleteTab}
      />
    )

    const button = getSongButton('Creep')
    fireEvent.contextMenu(button)

    const deleteItem = screen.getByRole('menuitem', { name: /delete/i })
    fireEvent.click(deleteItem)

    expect(onDeleteTab).toHaveBeenCalledWith(entry.path)
    expect(setTabPath).not.toHaveBeenCalled()
  })

  it('pressing Delete key on a focused song button opens the context menu', () => {
    // Given: onDeleteTab is provided
    // When: the Delete key is pressed while a song button is focused
    // Then: a role="menu" element appears
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    const onDeleteTab = vi.fn()
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} onDeleteTab={onDeleteTab} />)

    const button = getSongButton('Creep')
    fireEvent.keyDown(button, { key: 'Delete' })

    expect(document.querySelector('[role="menu"]')).toBeTruthy()
  })

  it('pressing Backspace key on a focused song button opens the context menu', () => {
    // Given: onDeleteTab is provided
    // When: Backspace is pressed on a song button
    // Then: a role="menu" element appears
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    const onDeleteTab = vi.fn()
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} onDeleteTab={onDeleteTab} />)

    const button = getSongButton('Creep')
    fireEvent.keyDown(button, { key: 'Backspace' })

    expect(document.querySelector('[role="menu"]')).toBeTruthy()
  })

  it('pressing Escape closes the context menu', () => {
    // Given: the context menu is open
    // When: Escape is pressed on the document
    // Then: the menu disappears
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    const onDeleteTab = vi.fn()
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} onDeleteTab={onDeleteTab} />)

    const button = getSongButton('Creep')
    fireEvent.contextMenu(button)
    expect(document.querySelector('[role="menu"]')).toBeTruthy()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('clicking outside the context menu closes it', () => {
    // Given: the context menu is open
    // When: a click event fires on the document
    // Then: the menu closes
    const tree: FileEntry[] = [makeEntry('Radiohead', 'Creep')]
    const onDeleteTab = vi.fn()
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} onDeleteTab={onDeleteTab} />)

    const button = getSongButton('Creep')
    fireEvent.contextMenu(button)
    expect(document.querySelector('[role="menu"]')).toBeTruthy()

    act(() => {
      fireEvent.click(document.body)
    })

    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('clicking the song button calls setTabPath but not onDeleteTab', () => {
    // Given: onDeleteTab is provided
    // When: a song button is clicked (not via context menu)
    // Then: setTabPath is called, onDeleteTab is not
    const entry = makeEntry('Radiohead', 'Creep')
    const setTabPath = vi.fn()
    const onDeleteTab = vi.fn()
    render(
      <FileTreeView
        tree={[entry]}
        currentTabPath=""
        setTabPath={setTabPath}
        searchFilter=""
        onDeleteTab={onDeleteTab}
      />
    )

    fireEvent.click(getSongButton('Creep'))

    expect(setTabPath).toHaveBeenCalledWith(entry.path)
    expect(onDeleteTab).not.toHaveBeenCalled()
  })
})

describe('FileTreeView — issue #5: no empty artist group rendered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('issue #5: does not render an artist group header when the tree has no songs for that artist', () => {
    // Given: a tree that has entries only for "Radiohead", not "Pink Floyd"
    // When: FileTreeView renders
    // Then: no button for "Pink Floyd" appears (no empty group header)
    const tree: FileEntry[] = [
      makeEntry('Radiohead', 'Creep'),
      makeEntry('Radiohead', 'Karma Police'),
    ]
    render(<FileTreeView tree={tree} {...DEFAULT_PROPS} />)

    // Only the one artist header that's present in the tree should exist
    const artistButtons = screen.getAllByRole('button', {
      name: /radiohead/i,
    })
    expect(artistButtons.length).toBeGreaterThanOrEqual(1)

    // Pink Floyd was never in the tree — no button for it
    expect(screen.queryByRole('button', { name: /pink floyd/i })).toBeNull()
  })

  it('issue #5: rendering a tree without an artist shows no group header for the absent artist', () => {
    // Given: a tree with only one artist
    // When: the component renders
    // Then: exactly one artist group is shown (no phantom empty group)
    const tree: FileEntry[] = [makeEntry('Nirvana', 'Smells Like Teen Spirit')]
    const { container } = render(<FileTreeView tree={tree} {...DEFAULT_PROPS} />)

    // Count how many artist-name buttons appear (one per group header)
    const artistButtons = Array.from(container.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.trim().toLowerCase() !== 'smells like teen spirit'
        && !btn.textContent?.trim().toLowerCase().includes('delete')
        && !btn.textContent?.trim().toLowerCase().includes('+')
    )
    // There should be exactly 1 (the Nirvana header) — not 2 or more
    expect(artistButtons.length).toBe(1)
  })

  it('renders a no-items message when the tree is empty', () => {
    // Given: an empty tree
    // When: FileTreeView renders
    // Then: a "no files found" message appears
    render(<FileTreeView tree={[]} {...DEFAULT_PROPS} />)
    expect(screen.getByText(/no files found/i)).toBeTruthy()
  })
})
