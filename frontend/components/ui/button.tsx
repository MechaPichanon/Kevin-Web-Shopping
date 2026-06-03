import type { ButtonHTMLAttributes } from "react"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "icon"
}

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  ghost: "hover:bg-muted",
  outline: "border border-input bg-background hover:bg-muted",
}

const sizeClasses = {
  default: "h-10 px-4 py-2",
  icon: "h-10 w-10",
}

export function Button({
  className = "",
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
      {...props}
    />
  )
}
