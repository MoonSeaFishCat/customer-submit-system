"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";

export default function AdminLoginForm() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret })
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "登录失败");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="secret">管理员密钥</Label>
        <Input
          id="secret"
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="输入 ADMIN_SECRET"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button className="w-full" disabled={loading}>
        {loading ? "登录中..." : "登录后台"}
      </Button>
    </form>
  );
}
