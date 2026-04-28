import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Code2, Copy, Check } from 'lucide-react';

interface SqlEntry {
  label: string;
  sql: string;
}

function SqlPreviewDialog({
  open,
  onOpenChange,
  queries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queries: SqlEntry[];
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (sql: string, index: number) => {
    navigator.clipboard.writeText(sql.trim());
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            คำสั่ง SQL ที่ใช้
          </DialogTitle>
          <DialogDescription>
            แสดงคำสั่ง SQL ที่ใช้เรียกข้อมูลในหน้านี้
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {queries.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                <span className="text-xs font-semibold">{entry.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => handleCopy(entry.sql, i)}
                >
                  {copiedIndex === i ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <pre className="p-3 m-0 text-xs font-mono whitespace-pre-wrap break-all bg-muted/10 overflow-x-auto leading-relaxed">
                {entry.sql.trim()}
              </pre>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SqlPreviewDialog;
