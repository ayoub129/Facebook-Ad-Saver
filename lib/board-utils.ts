import type { Board } from "@/components/ui/boards-provider";

export function buildBoardPath(boards: Board[], boardId: string | null): Board[] {
  if (!boardId) return [];

  const map = new Map(boards.map((b) => [b._id, b]));
  const path: Board[] = [];

  let current = map.get(boardId);

  while (current) {
    path.unshift(current);
    current = current.parentBoardId ? map.get(current.parentBoardId) ?? undefined : undefined;
  }

  return path;
}