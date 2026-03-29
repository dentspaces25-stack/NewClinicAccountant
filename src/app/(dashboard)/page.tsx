"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  DollarSign,
  Wallet,
  Trophy,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Stats {
  totalClinics: number;
  totalPatients: number;
  totalEarnings: number;
  heldAmount: number;
  topClinic: { id: string; name: string; totalPaid: number } | null;
}

interface EarningsData {
  month: string;
  earnings: number;
}

interface Clinic {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  const [stats, setStats] = useState<Stats | null>(null);
  const [earnings, setEarnings] = useState<EarningsData[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, earningsRes, clinicsRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/dashboard/earnings"),
        fetch("/api/clinics"),
      ]);

      if (!statsRes.ok || !earningsRes.ok || !clinicsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const statsData = await statsRes.json();
      const earningsData = await earningsRes.json();
      const clinicsData = await clinicsRes.json();

      setStats(statsData);
      setEarnings(earningsData.earnings || []);
      setClinics(
        (clinicsData || []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
      );
    } catch {
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = stats
    ? [
        {
          label: t("totalClinics"),
          value: stats.totalClinics,
          icon: Building2,
          gradient: "from-teal-50 to-cyan-50",
          iconColor: "text-teal-600",
          border: "border-teal-200",
        },
        {
          label: t("totalPatients"),
          value: stats.totalPatients,
          icon: Users,
          gradient: "from-blue-50 to-indigo-50",
          iconColor: "text-blue-600",
          border: "border-blue-200",
        },
        {
          label: t("totalEarnings"),
          value: stats.totalEarnings.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
          icon: DollarSign,
          gradient: "from-emerald-50 to-green-50",
          iconColor: "text-emerald-600",
          border: "border-emerald-200",
        },
        {
          label: t("heldAmount"),
          value: stats.heldAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
          icon: Wallet,
          gradient: "from-amber-50 to-orange-50",
          iconColor: "text-amber-600",
          border: "border-amber-200",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header title={t("title")}>
        {clinics.length > 0 && (
          <Select>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("selectClinic")} />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Header>

      <div className="p-4 lg:p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && stats && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <Card
                  key={card.label}
                  className={`bg-gradient-to-br ${card.gradient} ${card.border} hover:shadow-md transition-shadow`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          {card.label}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {card.value}
                        </p>
                      </div>
                      <div
                        className={`rounded-xl bg-white/60 p-3 ${card.iconColor}`}
                      >
                        <card.icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Top Clinic & Monthly Earnings */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Clinic */}
              <Card className="lg:col-span-1 border-teal-100">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    {t("topClinic")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topClinic ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 p-4 border border-teal-100">
                        <p className="text-lg font-semibold text-gray-900">
                          {stats.topClinic.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {t("earnings")}:{" "}
                          <span className="font-medium text-teal-700">
                            {stats.topClinic.totalPaid.toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-4">
                      No clinic data yet
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Earnings Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {t("monthlyEarnings")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {earnings.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={earnings}
                          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            tickFormatter={(value: string) => {
                              const [, month] = value.split("-");
                              const months = [
                                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                              ];
                              return months[parseInt(month, 10) - 1];
                            }}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "#6b7280" }}
                            tickFormatter={(value: number) =>
                              value >= 1000
                                ? `${(value / 1000).toFixed(0)}k`
                                : String(value)
                            }
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid #e5e7eb",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                            formatter={(value) => [
                              Number(value).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              }),
                              t("earnings"),
                            ]}
                          />
                          <Bar
                            dataKey="earnings"
                            fill="#0d9488"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={50}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-12 text-center">
                      No earnings data yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
