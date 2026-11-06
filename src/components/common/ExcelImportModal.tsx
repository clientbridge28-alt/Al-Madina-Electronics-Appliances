import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, AlertCircle, 
  CheckCircle2, X, RefreshCw, FileUp
} from 'lucide-react';
import { Modal } from './Modal';

export interface ExcelValidationError {
  row: number;
  column: string;
  message: string;
  rawValue?: any;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  onDownloadTemplate: () => void;
  onProcessFile: (buffer: ArrayBuffer) => {
    success: boolean;
    validRows: any[];
    errors: ExcelValidationError[];
    totalRows: number;
  };
  onCommitImport: (validRows: any[]) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  entityName,
  onDownloadTemplate,
  onProcessFile,
  onCommitImport
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    totalRows: number;
    validRows: any[];
    errors: ExcelValidationError[];
  } | null>(null);
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setResult(null);
    setImported(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setAnalyzing(true);
    setResult(null);
    setImported(false);

    try {
      const buffer = await selected.arrayBuffer();
      const parseResult = onProcessFile(buffer);
      setResult(parseResult);
    } catch (err: any) {
      setResult({
        totalRows: 0,
        validRows: [],
        errors: [{ row: 0, column: 'File', message: `Could not parse .xlsx workbook: ${err.message}` }]
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!result || result.validRows.length === 0) return;
    onCommitImport(result.validRows);
    setImported(true);
    setTimeout(() => {
      onClose();
      resetState();
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { onClose(); resetState(); }}
      title={`Import ${entityName} from Excel (.xlsx)`}
      subtitle={`Upload native Microsoft Excel spreadsheets, validate data integrity, and commit records directly.`}
      maxWidth="4xl"
    >
      <div className="space-y-5 text-xs">
        {/* Step 1: Download Template */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Step 1: Download Standard Excel Template</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Pre-formatted headers, data types, and required validation rules.
              </p>
            </div>
          </div>
          <button
            onClick={onDownloadTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-bold text-slate-700 shadow-2xs transition active:scale-98"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Download .xlsx Template</span>
          </button>
        </div>

        {/* Step 2: File Dropzone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 hover:bg-blue-50/20"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <FileUp className="h-6 w-6" />
            </div>
            <p className="font-bold text-slate-800 text-sm">
              {file ? file.name : `Select or Drop your completed ${entityName} .xlsx file here`}
            </p>
            <p className="text-[11px] text-slate-400">
              Supports native Microsoft Excel 2007+ (.xlsx) and Excel 97-2003 (.xls)
            </p>
          </div>
        </div>

        {/* Analyzing Spinner */}
        {analyzing && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-600 font-semibold">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span>Parsing Excel workbook & validating row columns...</span>
          </div>
        )}

        {/* Success Alert */}
        {imported && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5 font-bold animate-in fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>Successfully imported {result?.validRows.length} {entityName}! Updating ERP database...</span>
          </div>
        )}

        {/* Step 3: Validation Results */}
        {result && !imported && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-200">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Total Scanned Rows</span>
                  <p className="text-base font-black text-slate-900 font-mono">{result.totalRows}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Valid & Clean</span>
                  <p className="text-base font-black text-emerald-700 font-mono">{result.validRows.length}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-600">Rows With Errors</span>
                  <p className="text-base font-black text-rose-700 font-mono">{result.errors.length}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold"
                >
                  Choose Different File
                </button>
                <button
                  disabled={result.validRows.length === 0}
                  onClick={handleConfirmImport}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Commit {result.validRows.length} Valid Records</span>
                </button>
              </div>
            </div>

            {/* Error table if errors exist */}
            {result.errors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Validation Warnings ({result.errors.length})</span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-rose-100 text-[11px]">
                  {result.errors.map((err, i) => (
                    <div key={i} className="py-1.5 flex items-start justify-between text-rose-900">
                      <div>
                        <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-rose-200 mr-2">
                          Row {err.row}
                        </span>
                        <strong className="text-rose-700">[{err.column}]</strong> {err.message}
                      </div>
                      {err.rawValue !== undefined && (
                        <span className="text-slate-500 font-mono text-[10px]">Value: "{String(err.rawValue)}"</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
