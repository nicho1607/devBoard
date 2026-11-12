"use client";

import { forwardRef, useEffect, useState } from "react";

type Props = { title: string; onSave: (title: string) => Promise<boolean> };

/** Título editable in-place: guarda al perder el foco o con Enter. */
export const TaskTitle = forwardRef<HTMLHeadingElement, Props>(function TaskTitle(
  { title, onSave, ...rest },
  ref,
) {
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);

  async function commit() {
    const next = value.trim();
    if (!next) return setValue(title);
    if (next !== title && !(await onSave(next))) setValue(title);
  }

  return (
    <h2 ref={ref} {...rest} className="mt-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setValue(title);
        }}
        aria-label="Título de la tarea"
        className="w-full rounded bg-transparent px-1 -mx-1 text-xl font-semibold outline-none hover:bg-muted/50 focus:bg-muted/50"
      />
    </h2>
  );
});
