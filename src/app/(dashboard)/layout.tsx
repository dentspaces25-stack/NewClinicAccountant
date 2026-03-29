import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SessionProvider } from "next-auth/react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen">
        <Sidebar userRole={session.user.role} userName={session.user.name} />
        <main className="lg:ms-64">
          <div className="min-h-screen">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
