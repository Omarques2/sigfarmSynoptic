export type QueryStateCategoryProjectionLike = {
  queryRef?: string | null;
  nativeQueryRef?: string | null;
  active?: boolean | null;
  field?: {
    Column?: {
      Property?: string | null;
    } | null;
  } | null;
} | null;

export type CategoryColumnLike = {
  source?: {
    queryName?: string | null;
    displayName?: string | null;
    roles?: Record<string, boolean | undefined> | null;
  } | null;
  values?: ArrayLike<unknown> | null;
} | null;

function getColumnName(column?: CategoryColumnLike): string | null {
  const name = column?.source?.queryName || column?.source?.displayName || "";
  return typeof name === "string" && name.trim().length > 0 ? name : null;
}

function getProjectionFieldName(projection?: QueryStateCategoryProjectionLike): string | null {
  const direct = projection?.queryRef || projection?.nativeQueryRef || projection?.field?.Column?.Property || "";
  if (typeof direct !== "string") return null;
  const trimmed = direct.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  return parts[parts.length - 1] || trimmed;
}

function namesMatch(columnName: string | null, projectionName: string | null): boolean {
  if (!columnName || !projectionName) return false;
  if (columnName === projectionName) return true;
  const columnTail = columnName.split(".").pop();
  const projectionTail = projectionName.split(".").pop();
  return !!columnTail && !!projectionTail && columnTail === projectionTail;
}

export function getConfiguredCategoryColumns<T extends CategoryColumnLike>(columns: T[]): T[] {
  return (columns ?? []).filter((column): column is T => !!column?.source?.roles?.category);
}

export function getSingleCategoryValue(column: CategoryColumnLike): string | null {
  const unique = new Set<string>();
  for (const value of Array.from(column?.values ?? [])) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    unique.add(text);
    if (unique.size > 1) return null;
  }
  return unique.size === 1 ? Array.from(unique)[0] : null;
}

export function getLastActiveProjectionIndex<T extends CategoryColumnLike>(
  columns: T[],
  projections: QueryStateCategoryProjectionLike[]
): number | null {
  if (!Array.isArray(projections) || projections.length === 0) return null;
  const configured = getConfiguredCategoryColumns(columns);
  let sawExplicitState = false;
  let lastActiveIndex = -1;

  configured.forEach((column, index) => {
    const columnName = getColumnName(column);
    const projection =
      projections[index] && namesMatch(columnName, getProjectionFieldName(projections[index]))
        ? projections[index]
        : projections.find((candidate) => namesMatch(columnName, getProjectionFieldName(candidate)));
    if (!projection || typeof projection.active !== "boolean") return;
    sawExplicitState = true;
    if (projection.active) lastActiveIndex = index;
  });

  if (!sawExplicitState) return null;
  return Math.max(0, lastActiveIndex);
}

export function inferActiveCategoryIndexFromValues<T extends CategoryColumnLike>(columns: T[]): number {
  const configured = getConfiguredCategoryColumns(columns);
  if (configured.length === 0) return -1;
  for (let i = 0; i < configured.length; i++) {
    if (getSingleCategoryValue(configured[i]) === null) return i;
  }
  return configured.length - 1;
}

export function getEffectiveCurrentCategoryIndex<T extends CategoryColumnLike>(
  columns: T[],
  projections: QueryStateCategoryProjectionLike[] = []
): number {
  const configured = getConfiguredCategoryColumns(columns);
  if (configured.length === 0) return -1;
  const projectionIndex = getLastActiveProjectionIndex(configured, projections);
  if (projectionIndex !== null) return projectionIndex;
  return inferActiveCategoryIndexFromValues(configured);
}

export function getEffectiveCategoryColumns<T extends CategoryColumnLike>(
  columns: T[],
  projections: QueryStateCategoryProjectionLike[] = []
): T[] {
  const configured = getConfiguredCategoryColumns(columns);
  const currentIndex = getEffectiveCurrentCategoryIndex(configured, projections);
  if (currentIndex < 0) return [];
  return configured.slice(0, currentIndex + 1);
}

export function getEffectiveCurrentLevel<T extends CategoryColumnLike>(
  columns: T[],
  projections: QueryStateCategoryProjectionLike[] = []
): number {
  return Math.max(0, getEffectiveCurrentCategoryIndex(columns, projections));
}

export function getEffectiveCurrentCategory<T extends CategoryColumnLike>(
  columns: T[],
  projections: QueryStateCategoryProjectionLike[] = []
): T | null {
  const configured = getConfiguredCategoryColumns(columns);
  const index = getEffectiveCurrentCategoryIndex(configured, projections);
  return index >= 0 ? configured[index] || null : null;
}
