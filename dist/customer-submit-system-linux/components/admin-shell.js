import { BarChart3, BookOpen, FileText, Home, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui";

const navItems = [
  {
    href: "/admin",
    label: "仪表盘",
    icon: LayoutDashboard
  },
  {
    href: "/admin/templates",
    label: "模板配置",
    icon: Settings
  },
  {
    href: "/admin/submissions",
    label: "提交查询",
    icon: FileText
  },
  {
    href: "/admin/api-docs",
    label: "接口文档",
    icon: BookOpen
  }
];

export default function AdminShell({ title, description, active = "dashboard", children, actions }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="border-b bg-card/95 px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:py-5">
          <div className="flex items-center gap-3 px-2 lg:mb-8 lg:block">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold lg:mt-3">客服提交系统</h2>
              <p className="text-xs text-muted-foreground">Admin Console</p>
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-0 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.href.replace("/admin/", "").replace("/admin", "dashboard");

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:gap-3",
                    isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-3 border-t pt-3 lg:mt-8 lg:pt-4">
            <a
              href="/"
              className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:w-full lg:gap-3"
            >
              <Home className="h-4 w-4" />
              返回首页
            </a>
          </div>
        </aside>

        <section className="min-w-0 subtle-grid">
          <div className="border-b bg-background/80 backdrop-blur">
            <div className="flex flex-col justify-between gap-4 px-4 py-5 sm:px-5 md:flex-row md:items-center lg:px-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>

          <div className="px-4 py-6 sm:px-5 lg:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function AdminTopActions() {
  return (
    <>
      <LinkButton href="/admin/templates" variant="outline" size="sm">模板配置</LinkButton>
      <LinkButton href="/admin/submissions" variant="outline" size="sm">提交查询</LinkButton>
    </>
  );
}
