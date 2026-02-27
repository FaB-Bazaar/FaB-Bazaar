'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export function ImportArticleDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setPreview(null);

    try {
      const text = await selectedFile.text();
      const json = JSON.parse(text);

      // Validate basic structure
      if (!json.title || !json.slug || !json.contentType || !Array.isArray(json.sections)) {
        throw new Error('Invalid article format. Missing required fields: title, slug, contentType, or sections.');
      }

      setPreview(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON file');
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    try {
      setIsImporting(true);
      setError(null);

      const response = await fetch('/api/articles/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preview),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      toast({
        title: 'Import successful',
        description: `Article "${result.article.title}" has been imported`,
      });

      // Reset and close dialog
      setOpen(false);
      setFile(null);
      setPreview(null);

      // Refresh the page to show new article
      window.location.reload();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import article');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setPreview(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import Article
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Article</DialogTitle>
          <DialogDescription>
            Upload an exported article JSON file to import it into this environment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="article-file">Article JSON File</Label>
            <Input
              id="article-file"
              type="file"
              accept=".json"
              onChange={handleFileChange}
              disabled={isImporting}
            />
            <p className="text-sm text-muted-foreground">
              Select a JSON file exported from another environment
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview && !error && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Ready to Import</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Title:</strong> {preview.title}
                  </div>
                  {preview.subtitle && (
                    <div>
                      <strong>Subtitle:</strong> {preview.subtitle}
                    </div>
                  )}
                  <div>
                    <strong>Slug:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">{preview.slug}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>Type:</strong>
                    <Badge variant={preview.contentType === 'hero' ? 'default' : 'secondary'}>
                      {preview.contentType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>Status:</strong>
                    <Badge variant={preview.status === 'published' ? 'outline' : 'destructive'}>
                      {preview.status || 'draft'}
                    </Badge>
                  </div>
                  <div>
                    <strong>Sections:</strong> {preview.sections?.length || 0} sections
                  </div>
                  {preview._metadata && (
                    <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                      <div><strong>Exported from:</strong> {preview._metadata.exportedFrom}</div>
                      <div><strong>Exported at:</strong> {new Date(preview._metadata.exportedAt).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview || isImporting || !!error}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Confirm Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
