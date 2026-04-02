import StudentHeader from "@/components/student/StudentHeader";
import StudentFooter from "@/components/student/StudentFooter";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{
      background: "linear-gradient(160deg, #f8fafc 0%, #eef2ff 55%, #f5f3ff 100%)",
    }}>
      <StudentHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col">
        {children}
      </main>

      <StudentFooter />
    </div>
  );
}
