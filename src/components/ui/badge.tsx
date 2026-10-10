import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[2px] border border-transparent px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/85",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a]:hover:bg-muted",
        destructive:
          "border-destructive/45 bg-transparent text-destructive before:size-1.5 before:shrink-0 before:bg-current before:content-[''] has-[>svg]:before:hidden",
        success:
          "border-success/40 bg-transparent text-success before:size-1.5 before:shrink-0 before:bg-current before:content-[''] has-[>svg]:before:hidden",
        warning:
          "border-warning/50 bg-transparent text-warning before:size-1.5 before:shrink-0 before:bg-current before:content-[''] has-[>svg]:before:hidden",
        muted:
          "border-border bg-transparent text-muted-foreground before:size-1.5 before:shrink-0 before:bg-current before:content-[''] has-[>svg]:before:hidden",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
