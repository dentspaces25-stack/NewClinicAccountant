"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  Users,
  Tag as TagIcon,
  X,
} from "lucide-react";
import Link from "next/link";

interface Tag {
  id: string;
  name: string;
}

interface PatientTag {
  tagId: string;
  tag: Tag;
}

interface Patient {
  id: string;
  name: string;
  treatmentPlanLink: string | null;
  createdAt: string;
  tags: PatientTag[];
}

export default function PatientsPage() {
  const t = useTranslations("patients");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const clinicId = params.id as string;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const [formName, setFormName] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Tag management
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clinics/${clinicId}/patients`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/clinics");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const data = await res.json();
      setPatients(data);
    } catch {
      alert(tc("error"));
    } finally {
      setLoading(false);
    }
  }, [clinicId, tc, router]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      const data = await res.json();
      setTags(data);
    } catch {
      // Tags are non-critical, fail silently
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchTags();
  }, [fetchPatients, fetchTags]);

  function openCreateDialog() {
    setEditingPatient(null);
    setFormName("");
    setFormLink("");
    setFormTagIds([]);
    setDialogOpen(true);
  }

  function openEditDialog(patient: Patient) {
    setEditingPatient(patient);
    setFormName(patient.name);
    setFormLink(patient.treatmentPlanLink || "");
    setFormTagIds(patient.tags.map((pt) => pt.tagId));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    setSubmitting(true);
    try {
      const url = editingPatient
        ? `/api/clinics/${clinicId}/patients/${editingPatient.id}`
        : `/api/clinics/${clinicId}/patients`;
      const method = editingPatient ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          treatmentPlanLink: formLink || "",
          tagIds: formTagIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setDialogOpen(false);
      fetchPatients();
    } catch (err) {
      alert(err instanceof Error ? err.message : tc("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(patient: Patient) {
    if (!confirm(t("deleteConfirm"))) return;

    try {
      const res = await fetch(
        `/api/clinics/${clinicId}/patients/${patient.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      fetchPatients();
    } catch {
      alert(tc("error"));
    }
  }

  function toggleTag(tagId: string) {
    setFormTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name || name.length < 1) return;
    setCreatingTag(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const tag = await res.json();
        setTags((prev) => [...prev, tag]);
        setFormTagIds((prev) => [...prev, tag.id]);
        setNewTagName("");
      }
    } catch { /* ignore */ }
    finally { setCreatingTag(false); }
  }

  async function handleDeleteTag(tagId: string) {
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tagId));
        setFormTagIds((prev) => prev.filter((id) => id !== tagId));
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-white to-cyan-50/30">
      <Header title={t("title")}>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          {t("addPatient")}
        </Button>
      </Header>

      <div className="p-4 lg:p-6">
        {/* Back button */}
        <div className="mb-4">
          <Link href="/clinics">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              {tc("back")}
            </Button>
          </Link>
        </div>

        {/* Tag Manager */}
        <div className="mb-4">
          <button
            onClick={() => setShowTagManager(!showTagManager)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-teal-700 transition-colors"
          >
            <TagIcon className="h-4 w-4" />
            {t("tags")} ({tags.length})
            <span className="text-xs">{showTagManager ? "▲" : "▼"}</span>
          </button>

          {showTagManager && (
            <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-medium text-teal-800"
                    >
                      {tag.name}
                      <button
                        onClick={() => { if (confirm(`Delete tag "${tag.name}"?`)) handleDeleteTag(tag.id); }}
                        className="hover:text-red-600 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-3">{tc("noData")}</p>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={t("addTag") + "..."}
                  className="h-8 text-sm flex-1 max-w-xs"
                  maxLength={50}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={handleCreateTag}
                  disabled={creatingTag || !newTagName.trim()}
                >
                  {creatingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  {t("addTag")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-teal-100 p-4 mb-4">
              <Users className="h-10 w-10 text-teal-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {tc("noData")}
            </h2>
            <p className="text-gray-500 mb-6 max-w-md">
              {t("addPatient")}
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("addPatient")}
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-start px-4 py-3 text-sm font-medium text-gray-600">
                      {t("patientName")}
                    </th>
                    <th className="text-start px-4 py-3 text-sm font-medium text-gray-600">
                      {t("tags")}
                    </th>
                    <th className="text-start px-4 py-3 text-sm font-medium text-gray-600">
                      {t("treatmentPlan")}
                    </th>
                    <th className="text-end px-4 py-3 text-sm font-medium text-gray-600 w-24">
                      {tc("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="hover:bg-teal-50/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {patient.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {patient.tags.length > 0 ? (
                            patient.tags.map((pt) => (
                              <Badge key={pt.tagId} variant="default">
                                {pt.tag.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {patient.treatmentPlanLink ? (
                          <a
                            href={patient.treatmentPlanLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("treatmentPlan")}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(patient)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(patient)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Patient Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPatient ? t("editPatient") : t("addPatient")}
            </DialogTitle>
            <DialogDescription>
              {editingPatient ? t("editPatient") : t("addPatient")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="patient-name">{t("patientName")}</Label>
                <Input
                  id="patient-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("patientName")}
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatment-link">{t("treatmentPlan")}</Label>
                <Input
                  id="treatment-link"
                  type="url"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                  placeholder="https://..."
                  maxLength={2000}
                />
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-1.5">
                  <TagIcon className="h-3.5 w-3.5" />
                  {t("tags")}
                </Label>

                {/* Existing tags as toggle chips */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = formTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "bg-teal-100 border-teal-300 text-teal-800"
                              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {tag.name}
                          {selected && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Inline create new tag */}
                <div className="flex items-center gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={t("addTag") + "..."}
                    className="h-8 text-sm flex-1"
                    maxLength={50}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); } }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagName.trim()}
                  >
                    {creatingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {t("addTag")}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
