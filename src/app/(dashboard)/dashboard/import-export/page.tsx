'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Upload, Download, FileJson, FileText, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';

interface ImportResult {
  imported: number;
  skipped: number;
  duplicate_urls?: string[];
  errors: string[];
  tagsCreated?: number;
}

export default function ImportExportPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Refs for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Export state
  const [exportFormat, setExportFormat] = useState<'json' | 'html' | 'csv'>('json');
  const [includeTags, setIncludeTags] = useState(true);
  const [includeCollections, setIncludeCollections] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        format: exportFormat,
        include_tags: includeTags.toString(),
        include_collections: includeCollections.toString(),
      });
      
      const response = await fetch(`/api/bookmarks/export?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Improved Content-Disposition parsing
      // 1. Check for filename* (RFC5987 - UTF-8 percent-decoded)
      // 2. Fall back to quoted filename
      // 3. Handle unquoted filename
      // 4. Use fallback
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `mimebookmark-export.${exportFormat}`;

      if (contentDisposition) {
        // RFC5987: filename*=UTF-8''encoded_filename
        const filenameStarMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i);
        if (filenameStarMatch?.[1]) {
          const rfc5987Match = /^(.*?)''(.+)$/.exec(filenameStarMatch[1]);
          if (rfc5987Match) {
            const [, encoding, encodedFilename] = rfc5987Match;
            if (encoding && encodedFilename) {
              try {
                filename = decodeURIComponent(encodedFilename);
              } catch {
                // If decoding fails, continue to fallback
              }
            }
          }
        }

        // Quoted filename: filename="name.ext"
        if (filename === `mimebookmark-export.${exportFormat}`) {
          const quotedMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
          if (quotedMatch?.[1]) {
            filename = quotedMatch[1];
          }
        }

        // Unquoted filename: filename=name.ext
        if (filename === `mimebookmark-export.${exportFormat}`) {
          const unquotedMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
          if (unquotedMatch?.[1]) {
            filename = unquotedMatch[1].trim();
          }
        }
      }

      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Export complete',
        description: `Downloaded ${filename}`,
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
  }, [exportFormat, includeTags, includeCollections, toast]);

  const handleImport = useCallback(async () => {
    if (!importFile) {
      setImportError('No file selected');
      return;
    }
    
    setIsImporting(true);
    setImportResult(null);
    setImportError(null);
    setImportProgress(0);
    setImportStatus('Preparing...');
    
    try {
      setImportProgress(10);
      setImportStatus('Reading file...');
      
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('overwrite', overwriteExisting.toString());
      
      setImportProgress(30);
      setImportStatus('Processing...');
      
      const response = await fetch('/api/bookmarks/import', {
        method: 'POST',
        body: formData,
      });
      
      setImportProgress(70);
      setImportStatus('Saving...');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Import failed (${response.status})`);
      }
      
      const result = await response.json();
      setImportResult(result);
      setImportProgress(100);
      setImportStatus('Complete');
      
      router.refresh();
      
      toast({
        title: 'Import complete',
        description: `Imported ${result.imported} bookmarks, skipped ${result.skipped}`,
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed');
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsImporting(false);
          setImportProgress(0);
          setImportStatus('');
        }
      }, 2000);
    }
  }, [importFile, overwriteExisting, router, toast]);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">Import & Export</h1>
      <p className="text-muted-foreground mb-8">
        Import bookmarks from other services or export your collection
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Import Section */}
        <section aria-labelledby="import-heading">
          <div className="border rounded-lg p-6 space-y-4">
            <h2 id="import-heading" className="text-xl font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import
            </h2>
            
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
                  setImportError(null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: HTML, JSON, CSV
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="overwrite"
                checked={overwriteExisting}
                onCheckedChange={(checked) => setOverwriteExisting(checked === true)}
              />
              <label htmlFor="overwrite" className="text-sm">
                Overwrite existing bookmarks with same URL
              </label>
            </div>
            
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {importStatus}
                  </span>
                  <span>{importProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${importProgress}%` }}
                    role="progressbar"
                    aria-valuenow={importProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}
            
            {importError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {importError}
              </div>
            )}
            
            {importResult && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Import Complete
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{importResult.imported} bookmarks imported</p>
                  <p>{importResult.skipped} duplicates skipped</p>
                  {importResult.duplicate_urls && importResult.duplicate_urls.length > 0 && (
                    <p>{importResult.duplicate_urls.length} duplicate URLs found</p>
                  )}
                </div>
              </div>
            )}
            
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
          </div>
        </section>

        {/* Export Section */}
        <section aria-labelledby="export-heading">
          <div className="border rounded-lg p-6 space-y-4">
            <h2 id="export-heading" className="text-xl font-semibold flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export
            </h2>
            
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium mb-2">Options</legend>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-tags"
                  checked={includeTags}
                  onCheckedChange={(checked) => setIncludeTags(checked === true)}
                />
                <label htmlFor="include-tags" className="text-sm">
                  Include tags
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-collections"
                  checked={includeCollections}
                  onCheckedChange={(checked) => setIncludeCollections(checked === true)}
                />
                <label htmlFor="include-collections" className="text-sm">
                  Include collections
                </label>
              </div>
            </fieldset>
            
            <div>
              <label htmlFor="format" className="text-sm font-medium mb-2 block">
                Format
              </label>
              <select
                id="format"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'json' | 'html' | 'csv')}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="html">HTML</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
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
                  Export Bookmarks
                </>
              )}
            </Button>
          </div>
        </section>
      </div>

      {/* Supported Formats Info */}
      <div className="mt-8 border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Supported Formats</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              HTML
            </h4>
            <p className="text-sm text-muted-foreground">
              Netscape bookmark file format. Compatible with most browsers and bookmark managers.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              JSON
            </h4>
            <p className="text-sm text-muted-foreground">
              MimeBookmark native format. Preserves all metadata including tags and collections.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV
            </h4>
            <p className="text-sm text-muted-foreground">
              Comma-separated values. URL, title, and description columns required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
