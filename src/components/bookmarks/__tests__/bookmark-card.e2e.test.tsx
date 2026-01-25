import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookmarkCard } from '../bookmark-card';

// Mock bookmark data
const mockBookmarks = [
  {
    id: '1',
    url: 'https://example.com/bookmark-1',
    title: 'Example Bookmark 1',
    description: 'An example bookmark description',
    domain: 'example.com',
    favicon_url: null,
    og_image: 'https://example.com/image1.png',
    og_title: 'Example Bookmark 1',
    og_description: 'This is an example bookmark for testing',
    is_favorite: false,
    is_archived: false,
    is_read_later: false,
    source: 'web',
    clicks: 0,
    last_opened_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
    user_notes: null,
    user_rating: null,
    tags: [{ id: 't1', name: 'Tech', color: '#ff0000', usage_count: 0, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), user_id: 'u1', deleted_at: null }],
    collection_id: 'c1',
  },
  {
    id: '2',
    url: 'https://example.com/bookmark-2',
    title: 'Example Bookmark 2 (Archived)',
    description: 'An archived bookmark',
    domain: 'example.com',
    favicon_url: null,
    og_image: null,
    og_title: null,
    og_description: null,
    is_favorite: true,
    is_archived: true,
    is_read_later: false,
    source: 'web',
    clicks: 3,
    last_opened_at: new Date(Date.now() - 1209600000).toISOString(),
    created_at: new Date(Date.now() - 120960000).toISOString(),
    updated_at: new Date(Date.now() - 120960000).toISOString(),
    user_notes: null,
    user_rating: 5,
    tags: [{ id: 't2', name: 'Work', color: '#3b82f6', usage_count: 0, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), user_id: 'u1', deleted_at: null }],
    collection_id: 'c2',
  },
];

describe('E2E: Bookmark Card Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup fresh fetch mock for each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders bookmark with all information', () => {
    const bookmark = mockBookmarks[0];
    const mockOnDelete = vi.fn().mockResolvedValue(true);
    const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);

    render(
      <BookmarkCard
        bookmark={bookmark}
        onDelete={mockOnDelete}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    expect(screen.getByText('Example Bookmark 1')).toBeInTheDocument();
    expect(screen.getByText('An example bookmark description')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  test('renders archived bookmark with correct styling', () => {
    const bookmark = mockBookmarks[1];
    const mockOnDelete = vi.fn().mockResolvedValue(true);
    const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);

    const { container } = render(
      <BookmarkCard
        bookmark={bookmark}
        onDelete={mockOnDelete}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    expect(screen.getByText('Example Bookmark 2 (Archived)')).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-card')).toHaveClass('opacity-50');
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  test('renders favorite bookmark with star icon', () => {
    const bookmark = { ...mockBookmarks[1], is_favorite: true };
    const mockOnDelete = vi.fn().mockResolvedValue(true);
    const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);

    const { container } = render(
      <BookmarkCard
        bookmark={bookmark}
        onDelete={mockOnDelete}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    // Check for the fill-yellow-500 class used by the component
    const starIcon = container.querySelector('.fill-yellow-500');
    expect(starIcon).toBeInTheDocument();
  });

  test('displays menu on button click', async () => {
    const bookmark = mockBookmarks[0];
    const mockOnDelete = vi.fn().mockResolvedValue(true);
    const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);

    render(
      <BookmarkCard
        bookmark={bookmark}
        onDelete={mockOnDelete}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    // Target the "more" button by its accessible label
    const moreButton = screen.getByLabelText('Open menu');
    fireEvent.click(moreButton);

    // Wait for dropdown to appear with "Copy URL" option
    await waitFor(() => expect(screen.getByText('Copy URL')).toBeInTheDocument());

    // Verify backdrop exists and has correct label for closing
    await waitFor(() => expect(screen.getByLabelText('Close menu')).toBeInTheDocument());
  });

  test('handles toggle favorite', async () => {
    const bookmark = { ...mockBookmarks[0], is_favorite: false };
    const mockOnDelete = vi.fn().mockResolvedValue(true);
    const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);

    const { container } = render(
      <BookmarkCard
        bookmark={bookmark}
        onDelete={mockOnDelete}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    // Find the star button by looking for the button containing the Star icon
    const buttons = container.querySelectorAll('button');
    const starButton = Array.from(buttons).find(btn =>
      btn.querySelector('svg')?.classList.contains('text-muted-foreground')
    );

    if (!starButton) {
      throw new Error('Star button not found');
    }

    // Click the toggle button
    fireEvent.click(starButton);

    // Verify onToggleFavorite was called with bookmark id
    await waitFor(() => expect(mockOnToggleFavorite).toHaveBeenCalledWith(bookmark.id));
  });

  test('supports custom notes and rating', () => {
    const bookmark = {
      ...mockBookmarks[0],
      user_notes: 'My personal note about this bookmark',
      user_rating: 4,
    };
    const mockOnDelete = vi.fn().mockResolvedValue(true);
    const mockOnToggleFavorite = vi.fn().mockResolvedValue(true);

    render(
      <BookmarkCard
        bookmark={bookmark}
        onDelete={mockOnDelete}
        onToggleFavorite={mockOnToggleFavorite}
      />
    );

    expect(screen.getByText('Note: My personal note about this bookmark')).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
  });
});
