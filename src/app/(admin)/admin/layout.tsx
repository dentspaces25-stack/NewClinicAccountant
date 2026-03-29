import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen">
        <AdminSidebar userName={session.user.name} />
        <main className="lg:ms-64">
          <div className="min-h-screen">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
