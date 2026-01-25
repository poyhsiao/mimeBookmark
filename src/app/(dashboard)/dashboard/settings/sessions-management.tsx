'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Smartphone, Monitor, MoreHorizontal, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Session {
  id: string;
  display_name: string | null;
  is_active: boolean;
  is_current?: boolean;
  last_active_at: string;
  created_at: string;
  device?: {
    id: string;
    device_name: string | null;
    device_type: string | null;
    platform: string | null;
    os: string | null;
  };
}

interface SessionDevice {
  id: string;
  device_name: string | null;
  device_type: string | null;
  platform: string | null;
  os: string | null;
  user_agent: string | null;
  created_at: string;
}

export function SessionsManagement() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const displayNameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (selectedSession) {
      setDisplayName(selectedSession.display_name || '');
    }
  }, [selectedSession]);

  useEffect(() => {
    fetchSessions();
  }, []);

  // Focus trap and keyboard accessibility for modal
  useEffect(() => {
    if (!selectedSession || !modalRef.current) return;

    // Save the previously focused element
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the modal
    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Move focus to the first focusable element
    firstFocusable?.focus();

    // Handle Escape key to close modal
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSession(null);
      }
    };

    // Handle Tab key for focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, move to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab: if focus is on last element, move to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    // Cleanup: restore focus and remove listeners
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
      previousActiveElementRef.current?.focus();
    };
  }, [selectedSession]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/me/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) {
      return;
    }

    try {
      const response = await fetch(`/api/me/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      const data = await response.json();
      if (data.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        toast({
          title: 'Session Revoked',
          description: 'Session has been successfully revoked',
        });
      } else {
        toast({
          title: 'Failed to revoke session',
          description: data.message || 'Unable to revoke session. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to revoke all other sessions? This will sign you out of all other devices.')) {
      return;
    }

    try {
      const response = await fetch('/api/me/sessions/revoke-all', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }

      const data = await response.json();
      if (data.success) {
        // Re-fetch sessions from server to get canonical state
        await fetchSessions();
        toast({
          title: 'Sessions Revoked',
          description: `Revoked ${data.revoked_count} sessions`,
        });
      } else {
        toast({
          title: 'Failed to revoke sessions',
          description: data.message || 'Unable to revoke sessions. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke sessions',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateDisplayName = async (sessionId: string, displayName: string) => {
    try {
      const response = await fetch(`/api/me/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ display_name: displayName }),
      });

      if (!response.ok) {
        throw new Error('Failed to update session');
      }

      const data = await response.json();
      if (data.success) {
        setSessions(prev =>
          prev.map(s =>
            s.id === sessionId ? { ...s, display_name: data.session.display_name } : s
          )
        );
        toast({
          title: 'Session Updated',
          description: 'Session name has been updated',
        });
      } else {
        toast({
          title: 'Failed to update session',
          description: data.message || 'Unable to update session. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating session:', error);
      toast({
        title: 'Error',
        description: 'Failed to update session',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  const getDeviceIcon = (device: Session['device'] | undefined) => {
    if (!device?.device_type) return <Monitor className="h-4 w-4" />;

    const type = device.device_type.toLowerCase();
    if (type.includes('mobile') || type.includes('android') || type.includes('ios')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (type.includes('desktop') || type.includes('laptop')) {
      return <Monitor className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="h-6 w-6 border-4 border-primary border-t-transparent animate-spin rounded-full" />
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              className={`p-4 border rounded-lg transition-all ${
                session.is_current
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card hover:bg-card-hover'
              }`}
              onClick={() => setSelectedSession(session)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedSession(session);
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {getDeviceIcon(session.device)}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{session.display_name || 'Unknown Device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.device?.device_name || session.device?.platform || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.is_current && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 rounded-full">
                      Current
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(session.last_active_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevokeSession(session.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {session.device && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSession(session);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleRevokeAll}
          disabled={sessions.filter(s => !s.is_current).length === 0}
        >
          Revoke All Other Sessions
        </Button>
      </div>

      {selectedSession && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedSession(null)}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-title"
            className="bg-card rounded-lg max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="session-title" className="text-lg font-semibold">Session Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSession(null)}
                aria-label="Close"
              >
                ×
              </Button>
            </div>

            <div className="space-y-3">
              {selectedSession.device && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Device Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device Name:</span>
                      <span>{selectedSession.device.device_name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>{selectedSession.device.device_type || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <span>{selectedSession.device.platform || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OS:</span>
                      <span>{selectedSession.device.os || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Active:</span>
                      <span>{formatDate(selectedSession.last_active_at)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium mb-2">Actions</h4>
                <div className="space-y-2">
                  <label htmlFor="display-name-input" className="sr-only">
                    Display name
                  </label>
                  <Input
                    id="display-name-input"
                    ref={displayNameInputRef}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                    className="mb-3"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        if (displayName.trim()) {
                          handleUpdateDisplayName(selectedSession.id, displayName.trim());
                        }
                      }}
                    >
                      Update Name
                    </Button>
                    {!selectedSession.is_current && (
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => {
                          const id = selectedSession.id;
                          setSelectedSession(null);
                          handleRevokeSession(id);
                        }}
                      >
                        Revoke Session
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
