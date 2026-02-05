export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

export function isValidSlotType(type: string): boolean {
  return ['work', 'meeting', 'focus', 'personal'].includes(type);
}

export function isValidStatus(status: string): boolean {
  return ['active', 'cancelled'].includes(status);
}
