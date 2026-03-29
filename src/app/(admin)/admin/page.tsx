"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Building2,
  UserCheck,
  DollarSign,
  Ticket,
  ArrowLeft,
  Send,
  Shield,
} from "lucide-react";

type Tab = "doctors" | "clinics" | "patients" | "tickets" | "auditLogs";

interface Stats {
  totalDoctors: number;
  totalClinics: number;
  totalPatients: number;
  totalTransactions: number;
  totalEarnings: string;
  openTickets: number;
}

interface Doctor {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  createdAt: string;
  _count: { clinics: number };
}

interface Clinic {
  id: string;
  name: string;
  location: string;
  createdAt: string;
  doctor: { id: string; name: string };
  _count: { patients: number };
}

interface Patient {
  id: string;
  name: string;
  createdAt: string;
  clinic: { id: string; name: string };
}

interface TicketItem {
  id: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  doctor: { id: string; name: string };
}

interface TicketReply {
  id: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

interface TicketDetail extends TicketItem {
  replies: TicketReply[];
}

interface AuditLog {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: unknown;
  ip: string | null;
  createdAt: string;
  doctor: { id: string; name: string } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const STATUS_BADGE_MAP: Record<string, "default" | "warning" | "success" | "secondary"> = {
  OPEN: "default",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
};

export default function AdminPage() {
  const t = useTranslations("admin");
  const tt = useTranslations("tickets");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");

  const [activeTab, setActiveTab] = useState<Tab>("doctors");
  const [stats, setStats] = useState<Stats | null>(null);

  // Data states
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsPagination, setPatientsPagination] = useState({ page: 1, totalPages: 1 });
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, totalPages: 1 });
  const [auditAction, setAuditAction] = useState("");
  const [auditEntity, setAuditEntity] = useState("");

  // Ticket detail
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const fetchTabData = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case "doctors": {
          const res = await fetch("/api/admin/doctors");
          if (res.ok) setDoctors(await res.json());
          break;
        }
        case "clinics": {
          const res = await fetch("/api/admin/clinics");
          if (res.ok) setClinics(await res.json());
          break;
        }
        case "patients": {
          const res = await fetch(`/api/admin/patients?page=${patientsPagination.page}`);
          if (res.ok) {
            const data: PaginatedResponse<Patient> = await res.json();
            setPatients(data.data);
            setPatientsPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
          }
          break;
        }
        case "tickets": {
          const res = await fetch("/api/admin/tickets");
          if (res.ok) setTickets(await res.json());
          break;
        }
        case "auditLogs": {
          const params = new URLSearchParams({ page: String(auditPagination.page) });
          if (auditAction) params.set("action", auditAction);
          if (auditEntity) params.set("entity", auditEntity);
          const res = await fetch(`/api/admin/audit-logs?${params}`);
          if (res.ok) {
            const data: PaginatedResponse<AuditLog> = await res.json();
            setAuditLogs(data.data);
            setAuditPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
          }
          break;
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [patientsPagination.page, auditPagination.page, auditAction, auditEntity]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  async function handleSelectTicket(id: string) {
    try {
      const res = await fetch(`/api/admin/tickets/${id}`);
      if (res.ok) setSelectedTicket(await res.json());
    } catch {}
  }

  async function handleAdminReply() {
    if (!selectedTicket || !replyMessage.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage }),
      });
      if (res.ok) {
        setReplyMessage("");
        handleSelectTicket(selectedTicket.id);
      }
    } catch {} finally {
      setReplying(false);
    }
  }

  async function handleStatusUpdate(status: string) {
    if (!selectedTicket) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        handleSelectTicket(selectedTicket.id);
        fetchTabData("tickets");
      }
    } catch {} finally {
      setStatusUpdating(false);
    }
  }

  function getStatusLabel(status: string) {
    const map: Record<string, string> = {
      OPEN: tt("open"),
      IN_PROGRESS: tt("inProgress"),
      RESOLVED: tt("resolved"),
      CLOSED: tt("closed"),
    };
    return map[status] || status;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "doctors", label: t("doctors") },
    { key: "clinics", label: t("allClinics") },
    { key: "patients", label: t("allPatients") },
    { key: "tickets", label: t("allTickets") },
    { key: "auditLogs", label: t("auditLogs") },
  ];

  // Ticket detail view
  if (selectedTicket) {
    return (
      <div>
        <Header title={t("title")} />
        <div className="p-4 lg:p-6 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => setSelectedTicket(null)} className="mb-4">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedTicket.doctor?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedTicket.status}
                    onValueChange={handleStatusUpdate}
                    disabled={statusUpdating}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">{tt("open")}</SelectItem>
                      <SelectItem value="IN_PROGRESS">{tt("inProgress")}</SelectItem>
                      <SelectItem value="RESOLVED">{tt("resolved")}</SelectItem>
                      <SelectItem value="CLOSED">{tt("closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                {selectedTicket.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`rounded-lg p-4 ${
                      reply.isAdmin
                        ? "bg-teal-50 border border-teal-200"
                        : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <p className="text-xs font-medium mb-1 text-gray-500">
                      {reply.isAdmin ? tt("adminReply") : tt("yourReply")}
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(reply.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Input
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={t("replyToTicket")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAdminReply();
                    }
                  }}
                />
                <Button
                  onClick={handleAdminReply}
                  disabled={replying || !replyMessage.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title={t("title")} />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-teal-100 p-2.5">
                  <Users className="h-5 w-5 text-teal-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDoctors}</p>
                  <p className="text-xs text-gray-500">{t("totalDoctors")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2.5">
                  <Building2 className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalClinics}</p>
                  <p className="text-xs text-gray-500">{td("totalClinics")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2.5">
                  <UserCheck className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPatients}</p>
                  <p className="text-xs text-gray-500">{td("totalPatients")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-yellow-100 p-2.5">
                  <DollarSign className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{parseFloat(stats.totalEarnings).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{td("totalEarnings")}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-2.5">
                  <Ticket className="h-5 w-5 text-red-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.openTickets}</p>
                  <p className="text-xs text-gray-500">{tt("open")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {loading ? (
          <p className="text-center text-gray-500 py-8">{tc("loading")}</p>
        ) : (
          <>
            {/* Doctors Tab */}
            {activeTab === "doctors" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-start py-3 px-4 font-medium">{tc("search")}</th>
                      <th className="text-start py-3 px-4 font-medium">{tt("subject")}</th>
                      <th className="text-start py-3 px-4 font-medium">{td("totalClinics")}</th>
                      <th className="text-start py-3 px-4 font-medium">{tt("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doc) => (
                      <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{doc.name}</td>
                        <td className="py-3 px-4 text-gray-600">{doc.phone}</td>
                        <td className="py-3 px-4 text-gray-600">{doc._count.clinics}</td>
                        <td className="py-3 px-4">
                          <Badge variant={doc.role === "ADMIN" ? "default" : "secondary"}>
                            {doc.role}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {doctors.length === 0 && (
                  <p className="text-center text-gray-500 py-8">{tc("noData")}</p>
                )}
              </div>
            )}

            {/* Clinics Tab */}
            {activeTab === "clinics" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-start py-3 px-4 font-medium">{tc("search")}</th>
                      <th className="text-start py-3 px-4 font-medium">{t("doctors")}</th>
                      <th className="text-start py-3 px-4 font-medium">{td("totalPatients")}</th>
                      <th className="text-start py-3 px-4 font-medium">{new Date().toLocaleDateString()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinics.map((clinic) => (
                      <tr key={clinic.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{clinic.name}</td>
                        <td className="py-3 px-4 text-gray-600">{clinic.doctor.name}</td>
                        <td className="py-3 px-4 text-gray-600">{clinic._count.patients}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(clinic.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clinics.length === 0 && (
                  <p className="text-center text-gray-500 py-8">{tc("noData")}</p>
                )}
              </div>
            )}

            {/* Patients Tab */}
            {activeTab === "patients" && (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="text-start py-3 px-4 font-medium">{tc("search")}</th>
                        <th className="text-start py-3 px-4 font-medium">{t("allClinics")}</th>
                        <th className="text-start py-3 px-4 font-medium">{new Date().toLocaleDateString()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((patient) => (
                        <tr key={patient.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{patient.name}</td>
                          <td className="py-3 px-4 text-gray-600">{patient.clinic.name}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            {new Date(patient.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {patients.length === 0 && (
                    <p className="text-center text-gray-500 py-8">{tc("noData")}</p>
                  )}
                </div>
                {patientsPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={patientsPagination.page <= 1}
                      onClick={() =>
                        setPatientsPagination((p) => ({ ...p, page: p.page - 1 }))
                      }
                    >
                      &lt;
                    </Button>
                    <span className="text-sm text-gray-600 flex items-center px-2">
                      {patientsPagination.page} / {patientsPagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={patientsPagination.page >= patientsPagination.totalPages}
                      onClick={() =>
                        setPatientsPagination((p) => ({ ...p, page: p.page + 1 }))
                      }
                    >
                      &gt;
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Tickets Tab */}
            {activeTab === "tickets" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="text-start py-3 px-4 font-medium">{tt("subject")}</th>
                      <th className="text-start py-3 px-4 font-medium">{t("doctors")}</th>
                      <th className="text-start py-3 px-4 font-medium">{tt("status")}</th>
                      <th className="text-start py-3 px-4 font-medium">{new Date().toLocaleDateString()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectTicket(ticket.id)}
                      >
                        <td className="py-3 px-4 font-medium text-gray-900">{ticket.subject}</td>
                        <td className="py-3 px-4 text-gray-600">{ticket.doctor.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant={STATUS_BADGE_MAP[ticket.status]}>
                            {getStatusLabel(ticket.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tickets.length === 0 && (
                  <p className="text-center text-gray-500 py-8">{tc("noData")}</p>
                )}
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === "auditLogs" && (
              <div>
                <div className="flex flex-wrap gap-3 mb-4">
                  <Input
                    placeholder={tc("filter") + " - Action"}
                    value={auditAction}
                    onChange={(e) => {
                      setAuditAction(e.target.value);
                      setAuditPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-48"
                  />
                  <Input
                    placeholder={tc("filter") + " - Entity"}
                    value={auditEntity}
                    onChange={(e) => {
                      setAuditEntity(e.target.value);
                      setAuditPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className="w-48"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="text-start py-3 px-4 font-medium">Action</th>
                        <th className="text-start py-3 px-4 font-medium">Entity</th>
                        <th className="text-start py-3 px-4 font-medium">{t("doctors")}</th>
                        <th className="text-start py-3 px-4 font-medium">IP</th>
                        <th className="text-start py-3 px-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <Badge variant="outline">{log.action}</Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{log.entity || "-"}</td>
                          <td className="py-3 px-4 text-gray-600">{log.doctor?.name || "-"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs font-mono">{log.ip || "-"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditLogs.length === 0 && (
                    <p className="text-center text-gray-500 py-8">{tc("noData")}</p>
                  )}
                </div>
                {auditPagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPagination.page <= 1}
                      onClick={() =>
                        setAuditPagination((p) => ({ ...p, page: p.page - 1 }))
                      }
                    >
                      &lt;
                    </Button>
                    <span className="text-sm text-gray-600 flex items-center px-2">
                      {auditPagination.page} / {auditPagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPagination.page >= auditPagination.totalPages}
                      onClick={() =>
                        setAuditPagination((p) => ({ ...p, page: p.page + 1 }))
                      }
                    >
                      &gt;
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
