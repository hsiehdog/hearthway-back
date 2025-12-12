export function resolveMemberIdsFromNames(
  passengers: string[],
  groupMembers: { id: string; displayName: string; userId: string | null }[],
  currentUserId: string
): { memberIds: string[]; unknownPassengers: string[] } {
  const names = passengers?.length ? passengers : ["me"];
  const memberIds = new Set<string>();
  const unknown: string[] = [];

  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;

    if (["me", "i", "my", "myself"].includes(name)) {
      const self = groupMembers.find((m) => m.userId === currentUserId);
      if (self) memberIds.add(self.id);
      continue;
    }

    const match = groupMembers.find((m) =>
      m.displayName.toLowerCase().includes(name)
    );
    if (match) memberIds.add(match.id);
    else unknown.push(raw);
  }

  // If the user didn't specify passengers (or none matched), default to "me"
  if (!memberIds.size) {
    const self = groupMembers.find((m) => m.userId === currentUserId);
    if (self) memberIds.add(self.id);
  }

  return { memberIds: Array.from(memberIds), unknownPassengers: unknown };
}
