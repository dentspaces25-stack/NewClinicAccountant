"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  StickyNote,
  DollarSign,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Info,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getDriveEmbedUrl, isDriveUrl } from "@/lib/drive-embed";

interface PatientTag {
  tagId: string;
  tag: { id: string; name: string };
}

interface Patient {
  id: string;
  name: string;
  treatmentPlanLink: string | null;
  createdAt: string;
  tags: PatientTag[];
}

interface Financials {
  totalTransactions: number;
  totalPaid: number;
  heldAmount: number;
}

interface PatientNote {
  id: string;
  content: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  date: string;
  paid: string;
  extra: string;
  paidFromExtra: string;
  notes: string | null;
  source: string;
}

const PAGE_SIZE = 20;

export default function PatientProfilePage() {
  const t = useTranslations("patientProfile");
  const tc = useTranslations("common");
  const tt = useTranslations("transactions");
  const params = useParams();
  const clinicId = params.id as string;
  const patientId = params.patientId as string;

  // Profile data
  const [patient, setPatient] = useState<Patient | null>(null);
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [loading, setLoading] = useState(true);

  // Notes
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  // Treatment plan link edit
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, notesRes] = await Promise.all([
        fetch(`/api/clinics/${clinicId}/patients/${patientId}/profile`),
        fetch(`/api/clinics/${clinicId}/patients/${patientId}/notes`),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setPatient(data.patient);
        setFinancials(data.financials);
      }
      if (notesRes.ok) {
        setNotes(await notesRes.json());
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [clinicId, patientId]);

  const fetchTransactions = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const res = await fetch(
        `/api/clinics/${clinicId}/patients/${patientId}/transactions?page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        setTxTotal(data.pagination.total);
      }
    } catch { /* ignore */ } finally {
      setTxLoading(false);
    }
  }, [clinicId, patientId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchTransactions(txPage);
  }, [fetchTransactions, txPage]);

  async function handleAddNote() {
    if (!noteInput.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/clinics/${clinicId}/patients/${patientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteInput.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes((prev) => [note, ...prev]);
        setNoteInput("");
      }
    } catch { /* ignore */ } finally {
      setAddingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm(t("deleteNoteConfirm"))) return;
    try {
      const res = await fetch(
        `/api/clinics/${clinicId}/patients/${patientId}/notes/${noteId}`,
        { method: "DELETE" }
      );
      if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch { /* ignore */ }
  }

  async function handleSaveLink() {
    setSavingLink(true);
    try {
      const res = await fetch(`/api/clinics/${clinicId}/patients/${patientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatmentPlanLink: linkInput || "" }),
      });
      if (res.ok) {
        setPatient((prev) => prev ? { ...prev, treatmentPlanLink: linkInput || null } : prev);
        setLinkDialogOpen(false);
      }
    } catch { /* ignore */ } finally {
      setSavingLink(false);
    }
  }

  function openLinkDialog() {
    setLinkInput(patient?.treatmentPlanLink || "");
    setLinkDialogOpen(true);
  }

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

  if (!patient || !financials) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <Header title={t("title")} />
        <div className="flex items-center justify-center py-20 text-gray-400">{tc("noData")}</div>
      </div>
    );
  }

  const embedUrl = patient.treatmentPlanLink ? getDriveEmbedUrl(patient.treatmentPlanLink) : null;
  const totalPages = Math.ceil(txTotal / PAGE_SIZE);

  const pieData = [
    { name: t("paid"), value: financials.totalPaid },
    { name: t("heldAmount"), value: financials.heldAmount },
  ].filter((d) => d.value > 0);

  const PIE_COLORS = ["#0d9488", "#f59e0b"];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title={patient.name} />

      <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">

        {/* Back */}
        <Link href={`/clinics/${clinicId}/patients`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        </Link>

        {/* Patient name + tags */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
          {patient.tags.map((pt) => (
            <Badge key={pt.tagId} variant="default">{pt.tag.name}</Badge>
          ))}
        </div>

        {/* ── Section 1: Treatment Plan + Financial Summary ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Treatment Plan */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-600" />
                  {t("treatmentPlan")}
                </span>
                <Button variant="ghost" size="sm" onClick={openLinkDialog} className="h-7 text-xs">
                  {tc("edit")}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {patient.treatmentPlanLink ? (
                <>
                  <a
                    href={patient.treatmentPlanLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 hover:underline break-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {t("openLink")}
                  </a>

                  {/* Embedded Drive viewer */}
                  {embedUrl ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      <iframe
                        src={embedUrl}
                        className="w-full"
                        style={{ height: "480px" }}
                        allow="autoplay"
                        title={t("treatmentPlan")}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{t("notDriveLink")}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center py-6 text-center text-gray-400 gap-2">
                  <LinkIcon className="h-8 w-8 text-gray-300" />
                  <p className="text-sm">{t("noTreatmentPlan")}</p>
                  <Button variant="outline" size="sm" onClick={openLinkDialog}>{t("addLink")}</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-teal-600" />
                {t("financialSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Stat chips */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{financials.totalTransactions}</p>
                  <p className="text-xs text-gray-500 mt-1">{t("totalTransactions")}</p>
                </div>
                <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-center">
                  <p className="text-2xl font-bold text-teal-700">
                    {financials.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-teal-600 mt-1">{t("paid")}</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">
                    {financials.heldAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">{t("heldAmount")}</p>
                </div>
              </div>

              {/* Pie chart */}
              {pieData.length > 0 ? (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          value.toLocaleString(undefined, { minimumFractionDigits: 2 }),
                        ]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">{tc("noData")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Section 2: Notes ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-5 w-5 text-teal-600" />
              {t("notes")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add note */}
            <div className="flex gap-2">
              <Input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t("notePlaceholder")}
                maxLength={1000}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              />
              <Button onClick={handleAddNote} disabled={addingNote || !noteInput.trim()}>
                {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : t("addNote")}
              </Button>
            </div>

            {/* Notes timeline */}
            {notes.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-gray-400 gap-2">
                <StickyNote className="h-10 w-10 text-gray-300" />
                <p className="text-sm">{tc("noData")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                      <div className="w-px flex-1 bg-gray-200 mt-1" />
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1" suppressHydrationWarning>
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Transactions Table ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5 text-teal-600" />
              {t("transactions")}
              {txTotal > 0 && <Badge variant="secondary" className="text-xs">{txTotal}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                <Receipt className="h-10 w-10 text-gray-300" />
                <p className="text-sm">{tc("noData")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80">
                        <th className="px-3 py-2.5 text-start font-medium text-gray-600">{tt("date")}</th>
                        <th className="px-3 py-2.5 text-start font-medium text-gray-600">{tt("paid")}</th>
                        <th className="px-3 py-2.5 text-start font-medium text-gray-600">{tt("extra")}</th>
                        <th className="px-3 py-2.5 text-start font-medium text-gray-600">{tt("paidFromExtra")}</th>
                        <th className="px-3 py-2.5 text-start font-medium text-gray-600">{tt("notes")}</th>
                        <th className="px-3 py-2.5 text-start font-medium text-gray-600">{tt("source")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap" suppressHydrationWarning>
                            {new Date(tx.date).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-teal-700" suppressHydrationWarning>
                            {Number(tx.paid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600" suppressHydrationWarning>
                            {Number(tx.extra).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600" suppressHydrationWarning>
                            {Number(tx.paidFromExtra).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">{tx.notes || "—"}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant={tx.source === "scan" ? "default" : "secondary"}>
                              {tx.source === "scan" ? tt("scan") : tt("manual")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                    <p className="text-xs text-gray-500">
                      {tt("showing", {
                        from: (txPage - 1) * PAGE_SIZE + 1,
                        to: Math.min(txPage * PAGE_SIZE, txTotal),
                        total: txTotal,
                      })}
                    </p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" /> {tt("previous")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={txPage >= totalPages} onClick={() => setTxPage((p) => p + 1)}>
                        {tt("next")} <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Treatment Plan Link Dialog ── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTreatmentPlan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              maxLength={2000}
            />
            {/* Drive hint */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">{t("driveHint")}</p>
            </div>
            {/* Live validation feedback */}
            {linkInput && (
              isDriveUrl(linkInput) ? (
                <p className="text-xs text-teal-600 flex items-center gap-1">
                  ✓ {t("driveDetected")}
                </p>
              ) : (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠ {t("notDriveLinkWarning")}
                </p>
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} disabled={savingLink}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSaveLink} disabled={savingLink}>
              {savingLink && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
