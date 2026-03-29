"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  MapPin,
  Users,
  Receipt,
  Pencil,
  Trash2,
  Building2,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface Clinic {
  id: string;
  name: string;
  location: string;
  createdAt: string;
  _count: {
    patients: number;
    transactions: number;
  };
}

export default function ClinicsPage() {
  const t = useTranslations("clinics");
  const tc = useTranslations("common");

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchClinics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/clinics");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setClinics(data);
    } catch {
      alert(tc("error"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  useEffect(() => {
    fetchClinics();
  }, [fetchClinics]);

  function openCreateDialog() {
    setEditingClinic(null);
    setFormName("");
    setFormLocation("");
    setDialogOpen(true);
  }

  function openEditDialog(clinic: Clinic) {
    setEditingClinic(clinic);
    setFormName(clinic.name);
    setFormLocation(clinic.location);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formLocation.trim()) return;

    setSubmitting(true);
    try {
      const url = editingClinic
        ? `/api/clinics/${editingClinic.id}`
        : "/api/clinics";
      const method = editingClinic ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, location: formLocation }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setDialogOpen(false);
      fetchClinics();
    } catch (err) {
      alert(err instanceof Error ? err.message : tc("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(clinic: Clinic) {
    if (!confirm(t("deleteConfirm"))) return;

    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchClinics();
    } catch {
      alert(tc("error"));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50/50 via-white to-cyan-50/30">
      <Header title={t("title")}>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          {t("addClinic")}
        </Button>
      </Header>

      <div className="p-4 lg:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : clinics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-teal-100 p-4 mb-4">
              <Building2 className="h-10 w-10 text-teal-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {tc("noData")}
            </h2>
            <p className="text-gray-500 mb-6 max-w-md">
              {t("addClinic")}
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("addClinic")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {clinics.map((clinic) => (
              <Link
                key={clinic.id}
                href={`/clinics/${clinic.id}/patients`}
                className="block group"
              >
                <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-teal-200 group-hover:ring-1 group-hover:ring-teal-100">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{clinic.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1.5 mt-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{clinic.location}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 ms-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEditDialog(clinic);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(clinic);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-teal-600" />
                        <span className="font-medium">{clinic._count.patients}</span>
                        <span>{t("patientsCount")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Receipt className="h-4 w-4 text-teal-600" />
                        <span className="font-medium">
                          {clinic._count.transactions}
                        </span>
                        <span>{t("transactionsCount")}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="w-full h-1 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 opacity-60" />
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClinic ? t("editClinic") : t("addClinic")}
            </DialogTitle>
            <DialogDescription>
              {editingClinic ? t("editClinic") : t("addClinic")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">{t("clinicName")}</Label>
                <Input
                  id="clinic-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("clinicName")}
                  required
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-location">{t("location")}</Label>
                <Input
                  id="clinic-location"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder={t("location")}
                  required
                  maxLength={500}
                />
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
