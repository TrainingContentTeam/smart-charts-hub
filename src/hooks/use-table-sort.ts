import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";
export type SortState<Key extends string> = {
  key: Key;
  direction: SortDirection;
};

export function useTableSort<Key extends string>(defaultSort: SortState<Key>) {
  const [userSort, setUserSort] = useState<SortState<Key> | null>(null);

  const effectiveSort = useMemo(() => userSort || defaultSort, [defaultSort, userSort]);

  const toggleSort = (key: Key) => {
    setUserSort((current) => {
      if (!current) {
        return { key, direction: "asc" };
      }

      if (current.key !== key) {
        return { key, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return null;
    });
  };

  return {
    sort: effectiveSort,
    userSort,
    toggleSort,
  };
}
