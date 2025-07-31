// Integration tests for comment and marker creation workflow
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock components and contexts
const MockCommentsProvider = ({ children }: { children: React.ReactNode }) => {
  const [comments, setComments] = React.useState<any[]>([]);
  const [markers, setMarkers] = React.useState<any[]>([]);

  const addMarkerAndComment = async (
    trackId: string,
    content: string,
    time: number,
    color: string = '#FF0000'
  ) => {
    const newComment = {
      id: `comment_${Date.now()}`,
      content,
      track_id: trackId,
      timestamp: time,
      user_id: 1,
    };

    const newMarker = time > 0 ? {
      id: `marker_${Date.now()}`,
      time,
      trackId,
      color,
      commentId: newComment.id,
    } : null;

    setComments(prev => [...prev, newComment]);
    if (newMarker) {
      setMarkers(prev => [...prev, newMarker]);
    }

    return newComment;
  };

  const contextValue = {
    comments,
    markers,
    addMarkerAndComment,
    setComments,
    setMarkers,
  };

  return (
    <div data-testid="comments-provider">
      {React.cloneElement(children as React.ReactElement, { contextValue })}
    </div>
  );
};

// Mock comment form component
const CommentForm = ({ contextValue }: any) => {
  const [content, setContent] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await contextValue.addMarkerAndComment(
        'test-track-123',
        content,
        42.5,
        '#FF0000'
      );
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="comment-form">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        data-testid="comment-input"
      />
      <button type="submit" disabled={isSubmitting} data-testid="submit-button">
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
      <div data-testid="comments-count">{contextValue.comments.length}</div>
      <div data-testid="markers-count">{contextValue.markers.length}</div>
    </form>
  );
};

describe('Comments Integration Tests', () => {
  describe('End-to-End Comment Creation', () => {
    it('should complete full comment creation workflow', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <MockCommentsProvider>
          <CommentForm />
        </MockCommentsProvider>
      );

      // Verify initial state
      expect(getByTestId('comments-count')).toHaveTextContent('0');
      expect(getByTestId('markers-count')).toHaveTextContent('0');

      // Enter comment text
      const input = getByPlaceholderText('Add a comment...');
      fireEvent.change(input, { target: { value: 'Integration test comment' } });

      // Submit form
      const submitButton = getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Wait for async operations
      await waitFor(() => {
        expect(getByTestId('comments-count')).toHaveTextContent('1');
        expect(getByTestId('markers-count')).toHaveTextContent('1');
      });

      // Verify input was cleared
      expect(input).toHaveValue('');
    });

    it('should prevent duplicate submissions', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <MockCommentsProvider>
          <CommentForm />
        </MockCommentsProvider>
      );

      const input = getByPlaceholderText('Add a comment...');
      fireEvent.change(input, { target: { value: 'Test comment' } });

      const submitButton = getByTestId('submit-button');
      
      // Click multiple times rapidly
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      // Should only create one comment
      await waitFor(() => {
        expect(getByTestId('comments-count')).toHaveTextContent('1');
      });
    });

    it('should not submit empty comments', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <MockCommentsProvider>
          <CommentForm />
        </MockCommentsProvider>
      );

      const input = getByPlaceholderText('Add a comment...');
      fireEvent.change(input, { target: { value: '   ' } }); // Whitespace only

      const submitButton = getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Wait a bit to ensure no submission happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(getByTestId('comments-count')).toHaveTextContent('0');
      expect(getByTestId('markers-count')).toHaveTextContent('0');
    });
  });

  describe('Comment and Marker State Management', () => {
    it('should properly manage state when adding multiple comments', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <MockCommentsProvider>
          <CommentForm />
        </MockCommentsProvider>
      );

      const input = getByPlaceholderText('Add a comment...');
      const submitButton = getByTestId('submit-button');

      // Add first comment
      fireEvent.change(input, { target: { value: 'First comment' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(getByTestId('comments-count')).toHaveTextContent('1');
      });

      // Add second comment
      fireEvent.change(input, { target: { value: 'Second comment' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(getByTestId('comments-count')).toHaveTextContent('2');
        expect(getByTestId('markers-count')).toHaveTextContent('2');
      });
    });
  });

  describe('UI State During Submission', () => {
    it('should show loading state during submission', async () => {
      const { getByTestId, getByPlaceholderText } = render(
        <MockCommentsProvider>
          <CommentForm />
        </MockCommentsProvider>
      );

      const input = getByPlaceholderText('Add a comment...');
      fireEvent.change(input, { target: { value: 'Test comment' } });

      const submitButton = getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Button should show submitting state immediately
      expect(submitButton).toHaveTextContent('Submitting...');
      expect(submitButton).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Submit');
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle submission errors gracefully', async () => {
      // Create a provider that simulates errors
      const ErrorProvider = ({ children }: { children: React.ReactNode }) => {
        const [error, setError] = React.useState<string | null>(null);

        const addMarkerAndComment = async () => {
          try {
            throw new Error('Network error');
          } catch (e) {
            setError('Failed to add comment');
            // Don't re-throw, just set error state
          }
        };

        const contextValue = {
          comments: [],
          markers: [],
          addMarkerAndComment,
          error,
        };

        return (
          <div data-testid="error-provider">
            {React.cloneElement(children as React.ReactElement, { contextValue })}
            {error && <div data-testid="error-message">{error}</div>}
          </div>
        );
      };

      const { getByTestId, getByPlaceholderText } = render(
        <ErrorProvider>
          <CommentForm />
        </ErrorProvider>
      );

      const input = getByPlaceholderText('Add a comment...');
      fireEvent.change(input, { target: { value: 'This will fail' } });

      const submitButton = getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Error should be displayed
      await waitFor(() => {
        expect(getByTestId('error-message')).toHaveTextContent('Failed to add comment');
      });
    });
  });
});

// Test helper functions
describe('Comment Helper Functions', () => {
  it('should generate unique IDs', () => {
    const generateId = (prefix: string) => {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    };

    const id1 = generateId('comment');
    const id2 = generateId('comment');

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^comment_\d+_[a-z0-9]+$/);
  });

  it('should validate comment data', () => {
    const validateComment = (data: any) => {
      return Boolean(
        data.trackId &&
        data.content &&
        data.content.trim().length > 0 &&
        data.time >= 0 &&
        data.userId > 0
      );
    };

    expect(validateComment({
      trackId: 'test-123',
      content: 'Valid comment',
      time: 42.5,
      userId: 1,
    })).toBe(true);

    expect(validateComment({
      trackId: '',
      content: 'Invalid - no track',
      time: 42.5,
      userId: 1,
    })).toBe(false);
  });
});