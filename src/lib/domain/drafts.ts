export function draftKey(ownerId: string, studentId: string, date: string) {
  return `epq-draft:${ownerId}:${studentId}:${date}`;
}
