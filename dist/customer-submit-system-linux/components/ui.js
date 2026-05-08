import Link from "next/link";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "default", size = "default", asChild, children, ...props }) {
  const Comp = asChild ? "span" : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "outline" && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
        variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-9 rounded-md px-3",
        size === "lg" && "h-11 rounded-md px-8",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function LinkButton({ href, className, variant, size, children, ...props }) {
  return (
    <Link href={href} className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      variant === "outline" && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      variant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
      (!variant || variant === "default") && "bg-primary text-primary-foreground hover:bg-primary/90",
      size === "sm" ? "h-9 px-3" : size === "lg" ? "h-11 px-8" : "h-10 px-4 py-2",
      className
    )} {...props}>
      {children}
    </Link>
  );
}

export function Card({ className, ...props }) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
}

export function Badge({ className, variant = "default", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variant === "default" && "border-transparent bg-primary text-primary-foreground",
        variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
        variant === "outline" && "text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function AlertBox({ type = "info", title, children, className }) {
  const iconMap = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "i"
  };

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-4 text-sm shadow-sm",
        type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        type === "error" && "border-red-200 bg-red-50 text-red-800",
        type === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        type === "info" && "border-blue-200 bg-blue-50 text-blue-800",
        className
      )}
      role={type === "error" ? "alert" : "status"}
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current text-xs font-bold text-white">
        {iconMap[type] || iconMap.info}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <div className="font-semibold">{title}</div> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
