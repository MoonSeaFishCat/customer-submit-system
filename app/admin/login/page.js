import AdminLoginForm from "@/components/admin-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, LinkButton } from "@/components/ui";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center subtle-grid p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader>
          <CardTitle>管理员登录</CardTitle>
          <CardDescription>使用环境变量 ADMIN_SECRET 配置的密钥登录后台。</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
          <div className="mt-4 text-center">
            <LinkButton href="/" variant="ghost" size="sm">返回首页</LinkButton>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
