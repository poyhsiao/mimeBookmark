'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2, Upload, Download, FileJson, FileText, CheckCircle,
  User, Palette, Globe, Bell, Trash2, LogOut
} from 'lucide-react';
import { SessionsManagement } from './sessions-management';

interface UserSettings {
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string;
  subscriptionTier: string;
  bookmarksLimit: number;
  collectionsLimit: number;
  tagsLimit: number;
  preferences: {
    theme?: 'light' | 'dark' | 'system';
    language?: string;
    email_notifications?: boolean;
  };
}

interface UserStats {
  totalBookmarks: number;
  archivedBookmarks: number;
  favoriteBookmarks: number;
  readLaterBookmarks: number;
  totalCollections: number;
  totalTags: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<'json' | 'html'>('json');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    tagsCreated: number;
  } | null>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/me/settings');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to fetch settings';
        setSettingsError(errorMessage);
        toast({
          title: 'Error loading settings',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }
      const data = await response.json();
      setSettings(data.settings);
      setDisplayName(data.settings.displayName || '');
      setTheme(data.settings.preferences?.theme || 'system');
      setLanguage(data.settings.preferences?.language || 'en');
      setTimezone(data.settings.timezone || 'UTC');
      setEmailNotifications(data.settings.preferences?.email_notifications ?? true);
      setSettingsError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch settings';
      setSettingsError(errorMessage);
      toast({
        title: 'Error loading settings',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSettings(false);
    }
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/me/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, [fetchSettings, fetchStats]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const response = await fetch('/api/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      toast({
        title: 'Profile updated',
        description: 'Your display name has been saved',
      });
    } catch (error) {
      toast({
        title: 'Failed to save profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPreferences(true);
    try {
      const response = await fetch('/api/me/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, language, timezone, email_notifications: emailNotifications }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      toast({
        title: 'Preferences updated',
        description: 'Your settings have been saved',
      });
    } catch (error) {
      toast({
        title: 'Failed to save preferences',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPEG, PNG, GIF, or WebP image',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/me/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      setSettings(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);

      toast({
        title: 'Avatar uploaded',
        description: 'Your profile picture has been updated',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (isRemovingAvatar) return;

    setIsRemovingAvatar(true);
    try {
      const response = await fetch('/api/me/avatar', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove avatar');
      }

      setSettings(prev => prev ? { ...prev, avatarUrl: null } : null);

      toast({
        title: 'Avatar removed',
        description: 'Your profile picture has been removed',
      });
    } catch (error) {
      toast({
        title: 'Failed to remove avatar',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/bookmarks/export?format=${exportFormat}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] ||
        `mimebookmark-export.${exportFormat}`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 1000);

      toast({
        title: 'Export complete',
        description: `Downloaded ${fileName}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a file to import',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setImportProgress(0);
    setImportStatus('Preparing import...');

     try {
      setImportStatus('Reading file...');

      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('overwrite', overwriteExisting.toString());

      setImportProgress(10);
      setImportStatus('Processing bookmarks...');

      const response = await fetch('/api/bookmarks/import', {
        method: 'POST',
        body: formData,
      });

      setImportProgress(70);
      setImportStatus('Saving to database...');

      if (!response.ok) {
        let errorMessage = `Import failed (status ${response.status})`;
        try {
          const errorText = await response.text();
          if (errorText) errorMessage += `: ${errorText}`;
        } catch {}
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setImportResult(result);
      setImportProgress(100);
      setImportStatus('Import complete!');
      fetchStats();
      router.refresh();

      toast({
        title: 'Import complete',
        description: `Imported ${result.imported} bookmarks, skipped ${result.skipped}`,
      });
    } catch (error) {
      setImportProgress(0);
      setImportStatus('');
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
      }, 1500);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (settingsError || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-destructive text-lg font-medium">
          {settingsError || 'Failed to load settings'}
        </p>
        <Button onClick={() => {
          setIsLoadingSettings(true);
          setSettingsError(null);
          fetchSettings();
          fetchStats();
        }}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Update your profile information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={settings?.avatarUrl || undefined} alt="Profile picture" />
                <AvatarFallback className="text-2xl">
                  {displayName?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Photo
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  {settings?.avatarUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={isRemovingAvatar}
                    >
                      {isRemovingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, GIF or WebP. Max 5MB.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="displayName" className="text-sm font-medium">
                Display Name
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the app looks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-3 block">Theme</label>
              <ToggleGroup
                type="single"
                value={theme}
                onValueChange={(value) => value && setTheme(value as 'light' | 'dark' | 'system')}
                className="w-full"
              >
                <ToggleGroupItem value="light" className="flex-1" aria-label="Light">
                  <span className="mr-2">☀️</span>
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" className="flex-1" aria-label="Dark">
                  <span className="mr-2">🌙</span>
                  Dark
                </ToggleGroupItem>
                <ToggleGroupItem value="system" className="flex-1" aria-label="System">
                  <span className="mr-2">💻</span>
                  System
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSavePreferences}
                disabled={isSavingPreferences}
              >
                {isSavingPreferences ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preferences'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language & Region
            </CardTitle>
            <CardDescription>
              Set your language and timezone preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="language" className="text-sm font-medium">
                Language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </div>

            <div>
              <label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              >
                <option value="UTC">UTC</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Asia/Taipei">Taipei</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="notifications"
                checked={emailNotifications}
                onCheckedChange={(checked) => setEmailNotifications(checked === true)}
              />
              <label htmlFor="notifications" className="text-sm">
                Receive email notifications
              </label>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSavePreferences}
                disabled={isSavingPreferences}
              >
                {isSavingPreferences ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preferences'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Stats</CardTitle>
            <CardDescription>
              Your current usage and limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Bookmarks</p>
                <p className="text-2xl font-bold">
                  {stats?.totalBookmarks || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {settings?.bookmarksLimit || 500}
                  </span>
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Collections</p>
                <p className="text-2xl font-bold">
                  {stats?.totalCollections || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {settings?.collectionsLimit || 10}
                  </span>
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Tags</p>
                <p className="text-2xl font-bold">
                  {stats?.totalTags || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {settings?.tagsLimit || 50}
                  </span>
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="text-2xl font-bold capitalize">
                  {settings?.subscriptionTier || 'free'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Bookmarks
            </CardTitle>
            <CardDescription>
              Download all your bookmarks in JSON or HTML format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleGroup
              type="single"
              value={exportFormat}
              onValueChange={(value) => {
                if (value) setExportFormat(value as 'json' | 'html');
              }}
              className="w-full"
            >
              <ToggleGroupItem value="json" aria-label="Export as JSON">
                <FileJson className="mr-2 h-4 w-4" />
                JSON
              </ToggleGroupItem>
              <ToggleGroupItem value="html" aria-label="Export as HTML">
                <FileText className="mr-2 h-4 w-4" />
                HTML
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export All Bookmarks
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Bookmarks
            </CardTitle>
            <CardDescription>
              Import bookmarks from JSON, HTML, or CSV files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="import-file" className="text-sm font-medium mb-2 block">
                Select File
              </label>
              <Input
                id="import-file"
                type="file"
                accept=".json,.html,.htm,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImportFile(file);
                  setImportResult(null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: JSON (MimeBookmark), HTML (Netscape), CSV
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="overwrite"
                checked={overwriteExisting}
                onCheckedChange={setOverwriteExisting}
              />
              <label htmlFor="overwrite" className="text-sm">
                Overwrite existing bookmarks with same URL
              </label>
            </div>

            {isImporting ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {importStatus}
                  </span>
                  <span className="text-muted-foreground">{importProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Please wait while your bookmarks are being imported...
                </p>
              </div>
            ) : (
              <Button
                onClick={handleImport}
                disabled={!importFile}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Bookmarks
              </Button>
            )}

            {importResult && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Import Complete</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Imported: {importResult.imported}</p>
                  <p>Skipped: {importResult.skipped}</p>
                  <p>Tags created: {importResult.tagsCreated}</p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-destructive">Errors:</p>
                      {importResult.errors.slice(0, 5).map((error, idx) => (
                        <p key={`error-${idx}`} className="text-xs text-destructive">
                          • {error}
                        </p>
                      ))}
                      {importResult.errors.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ...and {importResult.errors.length - 5} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Extension Sessions
            </CardTitle>
            <CardDescription>
              Manage your active extension sessions and devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionsManagement />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
