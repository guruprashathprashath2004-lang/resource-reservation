const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseColomboDateTime(local: string) {
  const match = LOCAL_DATETIME.exec(local);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  return new Date(`${local}:00+05:30`);
}

export function fitsResourceOpeningHours(
  start: string,
  end: string,
  openHour: number,
  closeHour: number,
) {
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);
  const startMinute = Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16));
  const endMinute = Number(end.slice(11, 13)) * 60 + Number(end.slice(14, 16));
  const openMinute = openHour * 60;
  const closeMinute = closeHour * 60;

  if (startDate === endDate) {
    return startMinute >= openMinute && endMinute <= closeMinute;
  }

  const expectedNextDay = new Date(`${startDate}T00:00:00Z`);
  expectedNextDay.setUTCDate(expectedNextDay.getUTCDate() + 1);
  if (
    endDate !== expectedNextDay.toISOString().slice(0, 10) ||
    closeHour !== 24
  ) {
    return false;
  }

  return (
    startMinute >= openMinute &&
    startMinute < closeMinute &&
    endMinute >= openMinute &&
    endMinute <= closeMinute
  );
}
