"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ListFilter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LabelChip } from "@/components/shared/label-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { hasActiveFilters, parseFilters } from "@/lib/filters";
import { PRIORITIES, PRIORITY_META } from "@/lib/priority";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";

type ParamKey = "assignee" | "priority" | "label";

export function BoardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const members = useBoardStore((s) => s.members);
  const labels = useBoardStore((s) => s.labels);
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [q, setQ] = useState(filters.q);

  function update(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Debounce de la búsqueda de texto libre.
  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => update((p) => (q ? p.set("q", q) : p.delete("q"))), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggle(key: ParamKey, value: string) {
    update((p) => {
      const values = new Set((p.get(key) ?? "").split(",").filter(Boolean));
      if (values.has(value)) values.delete(value);
      else values.add(value);
      if (values.size) p.set(key, [...values].join(","));
      else p.delete(key);
    });
  }

  function clearAll() {
    setQ("");
    update((p) => ["q", "assignee", "priority", "label"].forEach((k) => p.delete(k)));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
      <div className="relative w-full sm:w-64">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por título o clave…"
          className="h-8 pl-8 text-sm"
        />
      </div>

      <FilterMenu
        label="Asignado"
        count={filters.assignees.length}
        options={[
          { value: "none", label: "Sin asignar", node: <span className="text-muted-foreground">Sin asignar</span> },
          ...members.map((m) => ({
            value: m.id,
            label: m.name ?? m.githubLogin ?? "",
            node: (
              <span className="flex items-center gap-2">
                <UserAvatar user={m} className="size-5" />
                {m.name}
              </span>
            ),
          })),
        ]}
        selected={filters.assignees}
        onToggle={(v) => toggle("assignee", v)}
      />
      <FilterMenu
        label="Prioridad"
        count={filters.priorities.length}
        options={PRIORITIES.map((p) => {
          const meta = PRIORITY_META[p];
          const Icon = meta.icon;
          return {
            value: p,
            label: meta.label,
            node: (
              <span className={cn("flex items-center gap-2", meta.text)}>
                <Icon className="size-4" /> {meta.label}
              </span>
            ),
          };
        })}
        selected={filters.priorities}
        onToggle={(v) => toggle("priority", v)}
      />
      <FilterMenu
        label="Etiquetas"
        count={filters.labels.length}
        options={labels.map((l) => ({ value: l.id, label: l.name, node: <LabelChip label={l} /> }))}
        selected={filters.labels}
        onToggle={(v) => toggle("label", v)}
      />

      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
          <X className="size-4" /> Limpiar
        </Button>
      )}
    </div>
  );
}

type Option = { value: string; label: string; node: React.ReactNode };

function FilterMenu(props: {
  label: string;
  count: number;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8", props.count && "border-primary/50")}>
          <ListFilter className="size-4" />
          {props.label}
          {props.count > 0 && (
            <span className="rounded bg-primary px-1 font-mono text-[10px] text-primary-foreground">
              {props.count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Filtrar ${props.label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {props.options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => props.onToggle(o.value)}>
                  <Check
                    className={cn("size-4", props.selected.includes(o.value) ? "opacity-100" : "opacity-0")}
                  />
                  {o.node}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
