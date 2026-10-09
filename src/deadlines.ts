const TIME_ZONE = 'America/Sao_Paulo';
export function approvedCivilDay(approvedAt: string): string {
  const date = new Date(approvedAt);
  if (Number.isNaN(date.getTime())) throw new RangeError('Data de aprovação inválida');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const field = (name:string) => parts.find(part => part.type === name)!.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}
export function isPastDeadline(approvedAt: string, deadlineDate: string): boolean {
  return approvedCivilDay(approvedAt) > deadlineDate;
}
