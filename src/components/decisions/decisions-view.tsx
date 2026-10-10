"use client";
// Decisions list: status filter, search, table (cards on mobile), row actions (open, rename, delete).
// "?new=1" in the URL opens the New decision dialog (the top bar links there).
import { formatDateTime } from "@/lib/dateFormat";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Ellipsis, FolderOpen, Pencil, Plus, Scale, Search, Trash } from "lucide-react";
import NewDecisionDialog from "@/components/new-decision-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPKR } from "@/lib/format";
import type { DecisionStatus } from "@/lib/types";
import { DecisionStatusBadge, STATUS_LABEL } from "./status-badge";
import { type DecisionSummary, formatRelative } from "./summary";

type Filter = "all" | DecisionStatus;
const FILTERS: Filter[] = ["all", "draft", "collecting", "comparing", "decided"];

export default function DecisionsView({ decisions }: { decisions: DecisionSummary[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState<DecisionSummary | null>(null);
  const [deleting, setDeleting] = useState<DecisionSummary | null>(null);

  // The dialog is open while ?new=1 is in the URL; closing it drops the param.
  const wantsNew = searchParams.get("new") === "1";
  function onNewOpenChange(open: boolean) {
    setNewOpen(open);
    if (!open && wantsNew) router.replace(pathname, { scroll: false });
  }

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: decisions.length, draft: 0, collecting: 0, comparing: 0, decided: 0 };
    for (const d of decisions) c[d.status]++;
    return c;
  }, [decisions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decisions.filter(
      (d) =>
        (filter === "all" || d.status === filter) &&
        (!q || d.title.toLowerCase().includes(q) || d.suppliers.some((s) => s.toLowerCase().includes(q))),
    );
  }, [decisions, filter, query]);

  const actions = (d: DecisionSummary) => (
    <RowActions
      onOpen={() => router.push(`/decisions/${d.id}`)}
      onRename={() => setRenaming(d)}
      onDelete={() => setDeleting(d)}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/80 pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[1.75rem] leading-tight font-bold">Decisions</h1>
          <p className="text-sm text-muted-foreground">Every big purchase, from quotation to decision.</p>
        </div>
      </div>

      <NewDecisionDialog open={newOpen || wantsNew} onOpenChange={onNewOpenChange} />

      {decisions.length === 0 ? (
        <Empty className="border border-dashed border-foreground/25 bg-card py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Scale />
            </EmptyMedia>
            <EmptyTitle>No decisions yet</EmptyTitle>
            <EmptyDescription>Start with a supplier&apos;s quotation or what you need.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setNewOpen(true)}>
              <Plus data-icon="inline-start" />
              New decision
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  {FILTERS.map((f) => (
                    <TabsTrigger key={f} value={f} className="px-2.5">
                      {f === "all" ? "All" : STATUS_LABEL[f]}
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{counts[f]}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="relative md:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search decisions"
                placeholder="Search title or supplier"
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <Empty className="border border-dashed border-foreground/25 py-10">
              <EmptyHeader>
                <EmptyTitle>No matching decisions</EmptyTitle>
                <EmptyDescription>Try another status or search term.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              {/* Desktop: table */}
              <Card className="hidden py-0 md:flex">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Supplier(s)</TableHead>
                      <TableHead>Best option</TableHead>
                      <TableHead className="text-right">Savings after tax</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-12 pr-4">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="max-w-72 pl-4">
                          <Link href={`/decisions/${d.id}`} className="block truncate font-medium hover:underline">
                            {d.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <DecisionStatusBadge status={d.status} />
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-muted-foreground">
                          <SupplierList suppliers={d.suppliers} />
                        </TableCell>
                        <TableCell className="max-w-56 truncate">
                          {d.bestOption ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Savings value={d.savingsAfterTax} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <time dateTime={d.updatedAt} title={formatDateTime(d.updatedAt)} suppressHydrationWarning>
                            {formatRelative(d.updatedAt)}
                          </time>
                        </TableCell>
                        <TableCell className="pr-4 text-right">{actions(d)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile: cards */}
              <ul className="flex flex-col gap-3 md:hidden">
                {visible.map((d) => (
                  <li key={d.id}>
                    <Card size="sm" className="gap-2 px-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/decisions/${d.id}`} className="min-w-0 font-medium leading-snug hover:underline">
                          {d.title}
                        </Link>
                        {actions(d)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <DecisionStatusBadge status={d.status} />
                        <time dateTime={d.updatedAt} suppressHydrationWarning>
                          Updated {formatRelative(d.updatedAt)}
                        </time>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">Supplier(s)</dt>
                        <dd className="truncate text-right">
                          <SupplierList suppliers={d.suppliers} />
                        </dd>
                        <dt className="text-muted-foreground">Best option</dt>
                        <dd className="truncate text-right">{d.bestOption ?? "—"}</dd>
                        <dt className="text-muted-foreground">Savings after tax</dt>
                        <dd className="text-right">
                          <Savings value={d.savingsAfterTax} />
                        </dd>
                      </dl>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <RenameDialog
        decision={renaming}
        onClose={() => setRenaming(null)}
        onDone={() => {
          setRenaming(null);
          router.refresh();
        }}
      />
      <DeleteDialog
        decision={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => {
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function SupplierList({ suppliers }: { suppliers: string[] }) {
  if (suppliers.length === 0) return <span className="text-muted-foreground">—</span>;
  const [first, ...rest] = suppliers;
  return (
    <span title={suppliers.join(", ")}>
      {first}
      {rest.length > 0 && <span className="text-muted-foreground"> +{rest.length}</span>}
    </span>
  );
}

function Savings({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`font-mono tabular-nums ${value > 0 ? "text-success" : "text-muted-foreground"}`}>
      {formatPKR(value)}
    </span>
  );
}

function RowActions(props: { onOpen: () => void; onRename: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Decision actions" />}>
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={props.onOpen}>
          <FolderOpen />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={props.onRename}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={props.onDelete}>
          <Trash />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameDialog(props: { decision: DecisionSummary | null; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Prefill when a different decision is picked.
  if ((props.decision?.id ?? null) !== lastId) {
    setLastId(props.decision?.id ?? null);
    setTitle(props.decision?.title ?? "");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!props.decision || !clean) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/decisions/${props.decision.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: clean }),
      });
      if (!res.ok) throw new Error(`Rename failed (${res.status})`);
      toast.success("Decision renamed");
      props.onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.decision !== null} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename decision</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="rename-decision-title">Title</FieldLabel>
            <Input
              id="rename-decision-title"
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog(props: { decision: DecisionSummary | null; onClose: () => void; onDone: () => void }) {
  const [deleting, setDeleting] = useState(false);
  // Keep the last title visible while the dialog animates closed.
  const [shown, setShown] = useState<DecisionSummary | null>(null);
  if (props.decision && props.decision !== shown) setShown(props.decision);

  async function remove() {
    if (!props.decision) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decisions/${props.decision.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success("Decision deleted", { description: props.decision.title });
      props.onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={props.decision !== null} onOpenChange={(open) => !open && props.onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this decision?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{shown?.title}&rdquo; and its quotation, offers, emails and memo will be removed. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void remove()} disabled={deleting}>
            {deleting && <Spinner />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
