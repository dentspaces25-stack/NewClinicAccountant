"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  ArrowLeft,
  Loader2,
  MessageSquarePlus,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

interface TicketReply {
  id: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
}

interface TicketDetail extends Ticket {
  replies: TicketReply[];
}

const STATUS_BADGE_MAP: Record<string, "default" | "warning" | "success" | "secondary"> = {
  OPEN: "default",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
};

export default function TicketsPage() {
  const t = useTranslations("tickets");
  const tc = useTranslations("common");
  const v = useTranslations("validation");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Create ticket (inline)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Reply
  const [replyMessage, setReplyMessage] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/tickets");
      if (res.ok) setTickets(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  async function handleSelectTicket(id: string) {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok) setSelectedTicket(await res.json());
    } catch { /* ignore */ }
  }

  async function handleCreateTicket() {
    setCreateError("");
    if (newSubject.trim().length < 3) { setCreateError(v("subjectMin")); return; }
    if (newMessage.trim().length < 10) { setCreateError(v("messageMin")); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject.trim(), message: newMessage.trim() }),
      });
      if (res.ok) {
        setNewSubject("");
        setNewMessage("");
        setShowCreateForm(false);
        setCreateError("");
        fetchTickets();
      } else {
        setCreateError(v("serverError"));
      }
    } catch {
      setCreateError(v("networkError"));
    } finally { setCreating(false); }
  }

  async function handleReply() {
    if (!selectedTicket || !replyMessage.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage }),
      });
      if (res.ok) {
        setReplyMessage("");
        handleSelectTicket(selectedTicket.id);
      }
    } catch { /* ignore */ }
    finally { setReplying(false); }
  }

  function getStatusLabel(status: string) {
    const map: Record<string, string> = {
      OPEN: t("open"), IN_PROGRESS: t("inProgress"), RESOLVED: t("resolved"), CLOSED: t("closed"),
    };
    return map[status] || status;
  }

  // ─── TICKET DETAIL VIEW ───
  if (selectedTicket) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <Header title={t("title")} />
        <div className="p-4 lg:p-6 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={() => { setSelectedTicket(null); fetchTickets(); }} className="mb-4">
            <ArrowLeft className="h-4 w-4" /> {tc("back")}
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE_MAP[selectedTicket.status]}>
                  {getStatusLabel(selectedTicket.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Original message */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {/* Replies thread */}
              {selectedTicket.replies.length > 0 && (
                <div className="space-y-3">
                  {selectedTicket.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className={`rounded-lg p-4 ${
                        reply.isAdmin
                          ? "bg-teal-50 border border-teal-200 ms-4"
                          : "bg-gray-50 border border-gray-200 me-4"
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1.5" style={{ color: reply.isAdmin ? "#0f766e" : "#6b7280" }}>
                        {reply.isAdmin ? t("adminReply") : t("yourReply")}
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(reply.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              {selectedTicket.status !== "CLOSED" && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Input
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={t("reply") + "..."}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                  />
                  <Button onClick={handleReply} disabled={replying || !replyMessage.trim()} size="icon">
                    {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── MAIN VIEW: CREATE FORM + TICKET LIST ───
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title={t("title")} />

      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">

        {/* ─── INLINE CREATE FORM ─── */}
        <Card className={showCreateForm ? "border-teal-200 shadow-md" : ""}>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full flex items-center justify-between p-4 text-start hover:bg-gray-50/50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${showCreateForm ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"} transition-colors`}>
                <MessageSquarePlus className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">{t("newTicket")}</p>
                <p className="text-xs text-gray-500">{t("subject")}</p>
              </div>
            </div>
            {showCreateForm ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {showCreateForm && (
            <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t border-gray-100">
              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {createError}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("subject")}</Label>
                <Input
                  value={newSubject}
                  onChange={(e) => { setNewSubject(e.target.value); setCreateError(""); }}
                  placeholder={t("subject") + "..."}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("message")}</Label>
                <textarea
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); setCreateError(""); }}
                  rows={4}
                  placeholder={t("message") + "..."}
                  maxLength={2000}
                  className="flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-teal-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-end">{newMessage.length}/2000</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(false); setNewSubject(""); setNewMessage(""); setCreateError(""); }}>
                  {tc("cancel")}
                </Button>
                <Button size="sm" onClick={handleCreateTicket} disabled={creating || !newSubject.trim() || !newMessage.trim()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {tc("submit")}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ─── TICKET LIST ─── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <HelpCircle className="h-16 w-16 mb-3 text-gray-300" />
            <p className="text-sm font-medium">{tc("noData")}</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group"
              onClick={() => handleSelectTicket(ticket.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 truncate group-hover:text-teal-700 transition-colors">
                      {ticket.subject}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {ticket.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(ticket.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE_MAP[ticket.status]}>
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
