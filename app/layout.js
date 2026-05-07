import "./globals.css";

export const metadata = {
  title: "客服信息提交系统",
  description: "支持多模板、多人同时提交、API 写入修改、Webhook 的客服信息提交系统"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
