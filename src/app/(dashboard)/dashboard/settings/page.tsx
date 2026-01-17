'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, Download, FileJson, FileText, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<'json' | 'html'>('json');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
    tagsCreated: number;
  } | null>(null);

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
      // Delay cleanup to ensure download starts on slow systems
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

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('overwrite', overwriteExisting.toString());

      const response = await fetch('/api/bookmarks/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      setImportResult(result);
      toast({
        title: 'Import complete',
        description: `Imported ${result.imported} bookmarks, skipped ${result.skipped}`,
      });

      // Refresh the page data
      router.refresh();
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and data
        </p>
      </div>

      <div className="space-y-6">
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
            <div className="flex gap-4">
              <Button
                variant={exportFormat === 'json' ? 'default' : 'outline'}
                onClick={() => setExportFormat('json')}
                className="flex-1"
              >
                <FileJson className="mr-2 h-4 w-4" />
                JSON
              </Button>
              <Button
                variant={exportFormat === 'html' ? 'default' : 'outline'}
                onClick={() => setExportFormat('html')}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                HTML
              </Button>
            </div>
            
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
              Import bookmarks from JSON or HTML files
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
                accept=".json,.html,.htm"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImportFile(file);
                  setImportResult(null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: JSON (MimeBookmark), HTML (Netscape)
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

            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Bookmarks
                </>
              )}
            </Button>

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
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Manage your account information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Account settings coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
