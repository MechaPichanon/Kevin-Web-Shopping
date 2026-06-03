import type { HTMLAttributes } from "react"

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className,
      ].join(" ")}
      {...props}
    />
  )
}

export function CardContent({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />
}

export function CardHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={["flex flex-col space-y-1.5 p-6", className].join(" ")} {...props} />
}

export function CardTitle({
  className = "",
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={["text-lg font-semibold leading-none tracking-normal", className].join(" ")}
      {...props}
    />
  )
}
