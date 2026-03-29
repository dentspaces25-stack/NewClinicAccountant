"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Upload,
  Crop,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Save,
  Loader2,
  ImageIcon,
  PenLine,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Edit2,
  X,
  Receipt,
} from "lucide-react";
import { PatientSearch } from "@/components/transactions/patient-search";

interface Clinic {
  id: string;
  name: string;
}

interface Patient {
  id: string;
  name: string;
}

interface CustomColumn {
  id: string;
  name: string;
  type: string;
}

interface TransactionRow {
  id?: string;
  patientName: string;
  patientId?: string;
  paid: string;
  notes: string;
  extra: string;
  paidFromExtra: string;
  customColumns: Record<string, string>;
}

interface SavedTransaction {
  id: string;
  date: string;
  patientName: string;
  paid: string;
  notes: string | null;
  extra: string;
  paidFromExtra: string;
  source: string;
  customColumns: Record<string, string> | null;
  patient: { id: string; name: string } | null;
  createdAt: string;
}

export default function TransactionsPage() {
  const t = useTranslations("transactions");
  const tc = useTranslations("common");

  // Clinic selection
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Add dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTab, setAddTab] = useState<"scan" | "manual">("manual");

  // Scan state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [extractedRows, setExtractedRows] = useState<TransactionRow[]>([]);
  const [extracting, setExtracting] = useState(false);

  // Manual state
  const [manualRows, setManualRows] = useState<TransactionRow[]>([createEmptyRow()]);

  // Common
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Transaction history
  const [savedTransactions, setSavedTransactions] = useState<SavedTransaction[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<TransactionRow | null>(null);
  const pageSize = 15;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function createEmptyRow(): TransactionRow {
    return { patientName: "", paid: "0", notes: "", extra: "0", paidFromExtra: "0", customColumns: {} };
  }

  // Fetch clinics
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clinics");
        if (res.ok) {
          const data = await res.json();
          setClinics(data.map((c: Clinic) => ({ id: c.id, name: c.name })));
          if (data.length === 1) setSelectedClinicId(data[0].id);
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  // Fetch patients + columns when clinic changes
  useEffect(() => {
    if (!selectedClinicId) { setCustomColumns([]); setPatients([]); return; }
    (async () => {
      try {
        const [colRes, patRes] = await Promise.all([
          fetch(`/api/clinics/${selectedClinicId}/columns`),
          fetch(`/api/clinics/${selectedClinicId}/patients`),
        ]);
        if (colRes.ok) setCustomColumns(await colRes.json());
        if (patRes.ok) {
          const d = await patRes.json();
          setPatients(d.map((p: Patient) => ({ id: p.id, name: p.name })));
        }
      } catch { /* ignore */ }
    })();
  }, [selectedClinicId]);

  // Fetch transaction history
  const loadTransactions = useCallback(async () => {
    if (!selectedClinicId) { setSavedTransactions([]); setHistoryTotal(0); return; }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(historyPage), pageSize: String(pageSize) });
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);
      const res = await fetch(`/api/clinics/${selectedClinicId}/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSavedTransactions(data.transactions || []);
        setHistoryTotal(data.pagination?.total || 0);
      }
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, [selectedClinicId, historyPage, filterStartDate, filterEndDate]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // ─── Add form handlers ───

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setExtractedRows([]);
    setCropStart(null); setCropEnd(null); setIsCropping(false);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleCropMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isCropping) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCropStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setCropEnd(null);
  }, [isCropping]);

  const handleCropMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isCropping || !cropStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCropEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [isCropping, cropStart]);

  const handleCropMouseUp = useCallback(() => {
    if (!isCropping || !cropStart || !cropEnd || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const sx = Math.min(cropStart.x, cropEnd.x) * scaleX;
    const sy = Math.min(cropStart.y, cropEnd.y) * scaleY;
    const sw = Math.abs(cropEnd.x - cropStart.x) * scaleX;
    const sh = Math.abs(cropEnd.y - cropStart.y) * scaleY;
    if (sw < 10 || sh < 10) return;
    canvas.width = sw; canvas.height = sh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setSelectedFile(new File([blob], "cropped.jpg", { type: "image/jpeg" }));
      setImagePreview(canvas.toDataURL("image/jpeg"));
      setIsCropping(false); setCropStart(null); setCropEnd(null);
    }, "image/jpeg");
  }, [isCropping, cropStart, cropEnd]);

  const handleExtract = useCallback(async () => {
    if (!selectedFile || !selectedClinicId) return;
    setExtracting(true); setMessage(null);
    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      const res = await fetch(`/api/clinics/${selectedClinicId}/transactions/scan`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const rows: TransactionRow[] = (data.rows || []).map((row: Record<string, string>) => ({
        patientName: row.name || "", paid: row.paid || "0", notes: row.notes || "",
        extra: row.extra || "0", paidFromExtra: row.paidFromExtra || "0", customColumns: {},
      }));
      setExtractedRows(rows);
      setMessage({ type: "success", text: t("extracted", { count: rows.length }) });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Error" });
    } finally { setExtracting(false); }
  }, [selectedFile, selectedClinicId, t]);

  const handleSaveRows = useCallback(async (rows: TransactionRow[]) => {
    if (!selectedClinicId || rows.length === 0) return;
    setSaving(true); setMessage(null);
    try {
      const results = await Promise.all(
        rows.map((row) =>
          fetch(`/api/clinics/${selectedClinicId}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: transactionDate, patientName: row.patientName, patientId: row.patientId || undefined,
              paid: row.paid, notes: row.notes, extra: row.extra, paidFromExtra: row.paidFromExtra,
              customColumns: Object.keys(row.customColumns).length > 0 ? row.customColumns : undefined,
              source: addTab === "scan" ? "scan" : "manual",
            }),
          })
        )
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setMessage({ type: "error", text: `${failed}/${rows.length} failed` });
      } else {
        setMessage({ type: "success", text: tc("success") });
        if (addTab === "scan") { setExtractedRows([]); } else { setManualRows([createEmptyRow()]); }
        setShowAddDialog(false);
        loadTransactions();
      }
    } catch { setMessage({ type: "error", text: tc("error") }); } finally { setSaving(false); }
  }, [selectedClinicId, transactionDate, addTab, tc, loadTransactions]);

  // ─── History handlers ───

  const handleDeleteTransaction = useCallback(async (txId: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/clinics/${selectedClinicId}/transactions/${txId}`, { method: "DELETE" });
      if (res.ok) loadTransactions();
    } catch { /* ignore */ }
  }, [selectedClinicId, loadTransactions, t]);

  const handleStartEdit = useCallback((tx: SavedTransaction) => {
    setEditingId(tx.id);
    setEditRow({
      id: tx.id, patientName: tx.patientName, patientId: tx.patient?.id,
      paid: tx.paid, notes: tx.notes || "", extra: tx.extra, paidFromExtra: tx.paidFromExtra,
      customColumns: (tx.customColumns as Record<string, string>) || {},
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editRow || !selectedClinicId) return;
    try {
      const res = await fetch(`/api/clinics/${selectedClinicId}/transactions/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: editRow.patientName, patientId: editRow.patientId || null,
          paid: editRow.paid, notes: editRow.notes, extra: editRow.extra, paidFromExtra: editRow.paidFromExtra,
          customColumns: Object.keys(editRow.customColumns).length > 0 ? editRow.customColumns : undefined,
        }),
      });
      if (res.ok) { setEditingId(null); setEditRow(null); loadTransactions(); }
    } catch { /* ignore */ }
  }, [editingId, editRow, selectedClinicId, loadTransactions]);

  // ─── Helpers ───

  function updateManualRow(index: number, field: keyof TransactionRow, value: string) {
    setManualRows((prev) => {
      const updated = [...prev];
      if (field === "customColumns") return updated;
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function openAddDialog() {
    setShowAddDialog(true);
    setMessage(null);
    setManualRows([createEmptyRow()]);
    setExtractedRows([]);
    setImagePreview(null);
    setSelectedFile(null);
    setTransactionDate(new Date().toISOString().split("T")[0]);
  }

  // ─── Render ───

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <Header title={t("title")} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(historyTotal / pageSize);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title={t("title")}>
        {selectedClinicId && (
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addTransaction")}
          </Button>
        )}
      </Header>

      <div className="p-4 lg:p-6 space-y-6">
        {/* Clinic selector + date filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  {tc("filter")}
                </label>
                <Select value={selectedClinicId} onValueChange={(v) => { setSelectedClinicId(v); setHistoryPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={clinics.length > 0 ? t("title") : tc("noData")} />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClinicId && (
                <>
                  <div className="sm:w-40">
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">{t("from")}</label>
                    <Input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setHistoryPage(1); }} />
                  </div>
                  <div className="sm:w-40">
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">{t("to")}</label>
                    <Input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setHistoryPage(1); }} />
                  </div>
                  {(filterStartDate || filterEndDate) && (
                    <div className="flex items-end">
                      <Button variant="ghost" size="sm" onClick={() => { setFilterStartDate(""); setFilterEndDate(""); setHistoryPage(1); }}>
                        <X className="h-4 w-4" /> {t("allDates")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        {selectedClinicId ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-teal-600" />
                  {t("history")}
                  {historyTotal > 0 && (
                    <Badge variant="secondary" className="text-xs">{historyTotal}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" variant="outline" onClick={openAddDialog} className="gap-1.5 sm:hidden">
                  <Plus className="h-4 w-4" /> {t("addTransaction")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : savedTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Receipt className="h-16 w-16 mb-4 text-gray-300" />
                  <p className="text-sm font-medium mb-1">{t("noTransactions")}</p>
                  <p className="text-xs mb-4">{t("addTransaction")}</p>
                  <Button onClick={openAddDialog} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> {t("addTransaction")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/80">
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("date")}</th>
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("patientName")}</th>
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("paid")}</th>
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("notes")}</th>
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("extra")}</th>
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("paidFromExtra")}</th>
                          <th className="px-3 py-2.5 text-start font-medium text-gray-600">{t("source")}</th>
                          {customColumns.map((col) => (
                            <th key={col.id} className="px-3 py-2.5 text-start font-medium text-gray-600">{col.name}</th>
                          ))}
                          <th className="px-3 py-2.5 w-20" />
                        </tr>
                      </thead>
                      <tbody>
                        {savedTransactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50/50 group">
                            {editingId === tx.id && editRow ? (
                              <>
                                <td className="px-3 py-1.5 text-gray-500 text-xs whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="px-2 py-1.5 min-w-[180px]">
                                  <PatientSearch patients={patients} value={editRow.patientName} selectedPatientId={editRow.patientId} placeholder={t("patientName")}
                                    onSelect={(name, pid) => setEditRow((p) => p ? { ...p, patientName: name, patientId: pid } : p)} />
                                </td>
                                <td className="px-2 py-1.5"><Input type="number" value={editRow.paid} onChange={(e) => setEditRow((p) => p ? { ...p, paid: e.target.value } : p)} className="h-8 text-sm w-24" /></td>
                                <td className="px-2 py-1.5"><Input value={editRow.notes} onChange={(e) => setEditRow((p) => p ? { ...p, notes: e.target.value } : p)} className="h-8 text-sm" /></td>
                                <td className="px-2 py-1.5"><Input type="number" value={editRow.extra} onChange={(e) => setEditRow((p) => p ? { ...p, extra: e.target.value } : p)} className="h-8 text-sm w-24" /></td>
                                <td className="px-2 py-1.5"><Input type="number" value={editRow.paidFromExtra} onChange={(e) => setEditRow((p) => p ? { ...p, paidFromExtra: e.target.value } : p)} className="h-8 text-sm w-24" /></td>
                                <td className="px-3 py-1.5"><Badge variant={tx.source === "scan" ? "default" : "secondary"}>{tx.source === "scan" ? t("scan") : t("manual")}</Badge></td>
                                {customColumns.map((col) => (
                                  <td key={col.id} className="px-2 py-1.5">
                                    <Input value={editRow.customColumns[col.name] || ""} onChange={(e) => setEditRow((p) => p ? { ...p, customColumns: { ...p.customColumns, [col.name]: e.target.value } } : p)} className="h-8 text-sm" />
                                  </td>
                                ))}
                                <td className="px-2 py-1.5">
                                  <div className="flex gap-1">
                                    <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleSaveEdit}><Save className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingId(null); setEditRow(null); }}><X className="h-3 w-3" /></Button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="px-3 py-2.5 font-medium text-gray-900">{tx.patientName}</td>
                                <td className="px-3 py-2.5 font-semibold text-teal-700">{Number(tx.paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">{tx.notes || "—"}</td>
                                <td className="px-3 py-2.5">{Number(tx.extra).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2.5">{Number(tx.paidFromExtra).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2.5"><Badge variant={tx.source === "scan" ? "default" : "secondary"}>{tx.source === "scan" ? t("scan") : t("manual")}</Badge></td>
                                {customColumns.map((col) => (
                                  <td key={col.id} className="px-3 py-2.5">{(tx.customColumns as Record<string, string>)?.[col.name] || "—"}</td>
                                ))}
                                <td className="px-2 py-2.5">
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-teal-700" onClick={() => handleStartEdit(tx)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-red-600" onClick={() => handleDeleteTransaction(tx.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                      <p className="text-xs text-gray-500">
                        {t("showing", { from: (historyPage - 1) * pageSize + 1, to: Math.min(historyPage * pageSize, historyTotal), total: historyTotal })}
                      </p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-8" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                          <ChevronLeft className="h-4 w-4" /> {t("previous")}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" disabled={historyPage >= totalPages} onClick={() => setHistoryPage((p) => p + 1)}>
                          {t("next")} <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center text-gray-400">
                <Receipt className="h-16 w-16 mb-3 text-gray-300" />
                <p className="text-sm">{tc("noData")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── ADD TRANSACTION DIALOG ─── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-visible">
          <div className="max-h-[calc(95vh-2rem)] overflow-y-auto overflow-x-hidden px-1 -mx-1">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-teal-600" />
              {t("addTransaction")}
            </DialogTitle>
            <DialogDescription>{clinics.find((c) => c.id === selectedClinicId)?.name}</DialogDescription>
          </DialogHeader>

          {/* Date */}
          <div className="flex items-center gap-3 pb-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{t("date")}:</label>
            <Input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="w-44" />
          </div>

          {/* Message */}
          {message && (
            <div className={`rounded-lg p-3 text-sm ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {message.text}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            <button onClick={() => setAddTab("manual")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${addTab === "manual" ? "bg-white text-teal-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
              <PenLine className="h-4 w-4" /> {t("manualEntry")}
            </button>
            <button onClick={() => setAddTab("scan")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${addTab === "scan" ? "bg-white text-teal-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
              <Camera className="h-4 w-4" /> {t("scanImage")}
            </button>
          </div>

          {/* ─── MANUAL TAB ─── */}
          {addTab === "manual" && (
            <div className="space-y-3 pt-16">
              <div className="overflow-x-auto" style={{ overflowY: "visible" }}>
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-3 py-2 text-start font-medium text-gray-600">{t("patientName")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-600">{t("paid")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-600">{t("notes")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-600">{t("extra")}</th>
                      <th className="px-3 py-2 text-start font-medium text-gray-600">{t("paidFromExtra")}</th>
                      {customColumns.map((col) => (<th key={col.id} className="px-3 py-2 text-start font-medium text-gray-600">{col.name}</th>))}
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-1.5 min-w-[200px]" style={{ overflow: "visible" }}>
                          <PatientSearch patients={patients} value={row.patientName} selectedPatientId={row.patientId} placeholder={t("patientName")}
                            onSelect={(name, pid) => setManualRows((prev) => { const u = [...prev]; u[i] = { ...u[i], patientName: name, patientId: pid }; return u; })} />
                        </td>
                        <td className="px-2 py-1.5"><Input type="number" value={row.paid} onChange={(e) => updateManualRow(i, "paid", e.target.value)} className="h-8 text-sm w-24" /></td>
                        <td className="px-2 py-1.5"><Input value={row.notes} onChange={(e) => updateManualRow(i, "notes", e.target.value)} className="h-8 text-sm" /></td>
                        <td className="px-2 py-1.5"><Input type="number" value={row.extra} onChange={(e) => updateManualRow(i, "extra", e.target.value)} className="h-8 text-sm w-24" /></td>
                        <td className="px-2 py-1.5"><Input type="number" value={row.paidFromExtra} onChange={(e) => updateManualRow(i, "paidFromExtra", e.target.value)} className="h-8 text-sm w-24" /></td>
                        {customColumns.map((col) => (
                          <td key={col.id} className="px-2 py-1.5">
                            <Input value={row.customColumns[col.name] || ""} onChange={(e) => setManualRows((prev) => { const u = [...prev]; u[i] = { ...u[i], customColumns: { ...u[i].customColumns, [col.name]: e.target.value } }; return u; })} className="h-8 text-sm" />
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setManualRows((p) => p.filter((_, idx) => idx !== i))} disabled={manualRows.length <= 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setManualRows((p) => [...p, createEmptyRow()])}>
                  <Plus className="h-4 w-4" /> {t("addRow")}
                </Button>
                <Button onClick={() => handleSaveRows(manualRows)} disabled={saving || manualRows.every((r) => !r.patientName.trim())}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("saveAll")}
                </Button>
              </div>
            </div>
          )}

          {/* ─── SCAN TAB ─── */}
          {addTab === "scan" && (
            <div className="space-y-4">
              {/* Upload buttons */}
              <div className="flex flex-wrap gap-3">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> {t("uploadImage")}</Button>
                <input type="file" accept="image/*" capture="environment" className="hidden" id="camera-input-dialog" onChange={handleFileSelect} />
                <Button variant="outline" onClick={() => document.getElementById("camera-input-dialog")?.click()}><Camera className="h-4 w-4" /> {t("capturePhoto")}</Button>
              </div>

              {/* Image preview */}
              {imagePreview ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant={isCropping ? "default" : "outline"} size="sm" onClick={() => { setIsCropping(!isCropping); setCropStart(null); setCropEnd(null); }}>
                      <Crop className="h-4 w-4" /> {t("cropImage")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setIsCropping(false); setCropStart(null); setCropEnd(null); }}>
                      <RotateCcw className="h-4 w-4" /> {t("resetCrop")}
                    </Button>
                  </div>
                  <div className="relative inline-block max-w-full border rounded-lg overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img ref={imgRef} src={imagePreview} alt="Preview" className={`max-h-[300px] w-auto ${isCropping ? "cursor-crosshair" : ""}`}
                      onMouseDown={handleCropMouseDown} onMouseMove={handleCropMouseMove} onMouseUp={handleCropMouseUp} draggable={false} />
                    {isCropping && cropStart && cropEnd && (
                      <div className="absolute border-2 border-teal-500 bg-teal-500/10 pointer-events-none"
                        style={{ left: Math.min(cropStart.x, cropEnd.x), top: Math.min(cropStart.y, cropEnd.y), width: Math.abs(cropEnd.x - cropStart.x), height: Math.abs(cropEnd.y - cropStart.y) }} />
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <Button onClick={handleExtract} disabled={extracting} className="w-full sm:w-auto">
                    {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {extracting ? t("extracting") : t("extractData")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <p className="text-sm">{t("uploadImage")}</p>
                </div>
              )}

              {/* Extracted rows */}
              {extractedRows.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">{t("extracted", { count: extractedRows.length })}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/80">
                          <th className="px-3 py-2 text-start font-medium text-gray-600">{t("patientName")}</th>
                          <th className="px-3 py-2 text-start font-medium text-gray-600">{t("paid")}</th>
                          <th className="px-3 py-2 text-start font-medium text-gray-600">{t("notes")}</th>
                          <th className="px-3 py-2 text-start font-medium text-gray-600">{t("extra")}</th>
                          <th className="px-3 py-2 text-start font-medium text-gray-600">{t("paidFromExtra")}</th>
                          <th className="px-3 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {extractedRows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="px-2 py-1.5 min-w-[200px]">
                              <PatientSearch patients={patients} value={row.patientName} selectedPatientId={row.patientId} placeholder={t("patientName")}
                                onSelect={(name, pid) => setExtractedRows((prev) => { const u = [...prev]; u[i] = { ...u[i], patientName: name, patientId: pid }; return u; })} />
                            </td>
                            <td className="px-2 py-1.5"><Input type="number" value={row.paid} onChange={(e) => setExtractedRows((p) => { const u = [...p]; u[i] = { ...u[i], paid: e.target.value }; return u; })} className="h-8 text-sm w-24" /></td>
                            <td className="px-2 py-1.5"><Input value={row.notes} onChange={(e) => setExtractedRows((p) => { const u = [...p]; u[i] = { ...u[i], notes: e.target.value }; return u; })} className="h-8 text-sm" /></td>
                            <td className="px-2 py-1.5"><Input type="number" value={row.extra} onChange={(e) => setExtractedRows((p) => { const u = [...p]; u[i] = { ...u[i], extra: e.target.value }; return u; })} className="h-8 text-sm w-24" /></td>
                            <td className="px-2 py-1.5"><Input type="number" value={row.paidFromExtra} onChange={(e) => setExtractedRows((p) => { const u = [...p]; u[i] = { ...u[i], paidFromExtra: e.target.value }; return u; })} className="h-8 text-sm w-24" /></td>
                            <td className="px-2 py-1.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setExtractedRows((p) => p.filter((_, idx) => idx !== i))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => handleSaveRows(extractedRows)} disabled={saving || extractedRows.every((r) => !r.patientName.trim())}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t("saveAll")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
