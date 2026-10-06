/** Calm Collective calendar bridge v2. Configure Script Properties; see README.md. */
const TIME_ZONE = 'Europe/London';
const ROOM_NAMES = { calm: 'The Calm Room', still: 'The Still Room', haven: 'The Haven Room', any: 'Help me choose' };
function settings_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return { email: p.BUSINESS_EMAIL || '', viewing: p.VIEWING_CALENDAR_ID || '', host: p.HOST_CALENDAR_ID || '',
    rooms: { calm: p.CALM_ROOM_CALENDAR_ID || '', still: p.STILL_ROOM_CALENDAR_ID || '', haven: p.HAVEN_ROOM_CALENDAR_ID || '' },
    open: Number(p.ROOM_OPEN_HOUR || 8), close: Number(p.ROOM_CLOSE_HOUR || 21),
    days: (p.ROOM_OPEN_DAYS || '1,2,3,4,5,6,0').split(',').map(Number) };
}
function doGet(event) {
  const p = event && event.parameter || {};
  let result;
  try {
    const config = settings_();
    if (p.action === 'booking-health') {
      if (!validEmail_(config.email)) throw new Error('Business contact is not configured.');
      // Capability discovery checks access before offering any calendar-backed times.
      const accessible = id => { try { return !!id && !!CalendarApp.getCalendarById(id); } catch (_) { return false; } };
      result = { ok: true, version: 2, viewing: accessible(config.viewing) && accessible(config.host), rooms: Object.keys(config.rooms).filter(key => accessible(config.rooms[key])) };
    } else if (p.action === 'enquiry-health') {
      result = { ok: validEmail_(config.email), mode: 'callback-enquiry' };
    } else if (p.action === 'availability') {
      result = { ok: true, slots: availableSlots_(p.date, p.intent, p.room, Number(p.duration || 60)) };
    } else if (p.action === 'status') {
      const id = validId_(p.requestId);
      const raw = PropertiesService.getScriptProperties().getProperty('request:' + id);
      const record = raw ? JSON.parse(raw) : null;
      result = record ? { ok: record.state !== 'failed', state: record.state } : { ok: true, state: 'processing' };
    } else result = { ok: false, error: 'Unknown request.' };
  } catch (_) { result = { ok: false, error: 'Unable to complete this request. Please contact Calm Collective.' }; }
  const callback = /^[A-Za-z_$][0-9A-Za-z_$]{0,100}$/.test(p.callback || '') ? p.callback : 'calendarResponse';
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(event) {
  let payload, id, lock;
  try {
    payload = JSON.parse(event && event.postData && event.postData.contents || '{}');
    id = validId_(payload.requestId);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw new Error('Busy');
    processRequest_(payload);
  } catch (_) {
    if (id && lock && lock.hasLock()) {
      const properties = PropertiesService.getScriptProperties();
      // Never downgrade a successful or uncertain request after a retry.
      if (!properties.getProperty('request:' + id)) properties.setProperty('request:' + id, JSON.stringify({ state: 'failed', at: Date.now() }));
    }
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
  return ContentService.createTextOutput('ok');
}
function processRequest_(payload) {
  const properties = PropertiesService.getScriptProperties();
  const id = validId_(payload.requestId);
  if (properties.getProperty('request:' + id)) return; // idempotent replay; status is authoritative
  const config = settings_();
  if (!validEmail_(config.email)) throw new Error('Business contact is not configured');
  const data = {
    name: clean_(payload.name, 100), email: clean_(payload.email, 160).toLowerCase(), phone: clean_(payload.phone, 30),
    therapy: clean_(payload.therapyType === 'Other' ? payload.otherTherapy : payload.therapyType, 160),
    notes: clean_(payload.notes, 1800), date: clean_(payload.date, 10), time: clean_(payload.time, 5),
    intent: payload.intent, room: payload.room, duration: payload.intent === 'viewing' ? 60 : Number(payload.duration),
    frequency: clean_(payload.frequency || 'One-off', 50)
  };
  const legacy = payload.action === 'enquiry';
  if (!legacy && payload.action !== 'request') throw new Error('Invalid action');
  if (payload.website || !data.name || data.phone.length < 7 || !data.therapy) throw new Error('Incomplete request');
  if (!legacy && (!validEmail_(data.email) || payload.consent !== 'on' || !['viewing','room'].includes(data.intent) || !Object.prototype.hasOwnProperty.call(ROOM_NAMES, data.room))) throw new Error('Invalid request');
  const rateKey = 'rate:' + Utilities.base64EncodeWebSafe(data.email || data.phone);
  if (CacheService.getScriptCache().get(rateKey)) throw new Error('Please wait before sending another request');
  let calendarId = '', range;
  if (!legacy) {
    validateDate_(data.date);
    if (!/^([01]\d|2[0-3]):00$/.test(data.time) || ![60,120,180,240].includes(data.duration)) throw new Error('Invalid time');
    range = slotRange_(data.date, data.time, data.duration);
    calendarId = data.intent === 'viewing' ? config.viewing : config.rooms[data.room];
    if (calendarId && !availableSlots_(data.date, data.intent, data.room, data.duration).includes(data.time)) throw new Error('Time no longer available');
  }
  const details = [
    'Request: ' + (legacy ? 'Callback' : data.intent === 'viewing' ? 'Viewing' : 'Room hire'),
    'Room: ' + (ROOM_NAMES[data.room] || 'Not specified'),
    'Name: ' + data.name, 'Email: ' + data.email, 'Phone: ' + data.phone, 'Practice: ' + data.therapy,
    'Requested date and time: ' + data.date + ' ' + data.time + ' (Europe/London)',
    'Duration: ' + data.duration + ' minutes', 'Pattern: ' + data.frequency,
    'Notes: ' + data.notes, 'Reference: ' + id,
    'This is a request, not a confirmed booking.'
  ].join('\n');
  let record = { state: 'processing', at: Date.now() };
  properties.setProperty('request:' + id, JSON.stringify(record));
  if (calendarId) {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) throw new Error('Calendar unavailable');
    const event = calendar.createEvent('PENDING — ' + (data.intent === 'viewing' ? 'Viewing' : ROOM_NAMES[data.room]), range.start, range.end, { description: details });
    event.setTag('calmRequestId', id);
    event.setTag('calmCustomerEmail', data.email);
    event.setTag('calmNotified', 'no');
    record = { state: 'pending', at: Date.now() };
    properties.setProperty('request:' + id, JSON.stringify(record));
    // The calendar hold is durable even if the optional admin notification fails.
    try { MailApp.sendEmail({ to: config.email, subject: 'Calm Collective request awaiting approval', body: details, name: 'Calm Collective' }); } catch (_) {}
  } else {
    MailApp.sendEmail({ to: config.email, subject: 'Calm Collective ' + (legacy ? 'enquiry' : 'booking request'), body: details, name: 'Calm Collective', ...(data.email ? { replyTo: data.email } : {}) });
    properties.setProperty('request:' + id, JSON.stringify({ state: 'received', at: Date.now() }));
  }
  CacheService.getScriptCache().put(rateKey, '1', 300);
}
function availableSlots_(date, intent, room, duration) {
  validateDate_(date);
  if (!['viewing','room'].includes(intent) || !Object.prototype.hasOwnProperty.call(ROOM_NAMES, room) || ![60,120,180,240].includes(duration)) throw new Error('Invalid request');
  const config = settings_();
  const ids = intent === 'viewing' ? [config.viewing, config.host] : [config.rooms[room]];
  if (ids.some(id => !id)) throw new Error('Calendar not connected');
  const calendars = [...new Set(ids)].map(id => CalendarApp.getCalendarById(id));
  if (calendars.some(calendar => !calendar)) throw new Error('Calendar unavailable');
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  if (intent === 'viewing' ? [0,6].includes(weekday) : !config.days.includes(weekday)) return [];
  const open = intent === 'viewing' ? 10 : config.open;
  const close = intent === 'viewing' ? 16 : config.close;
  if (!Number.isInteger(open) || !Number.isInteger(close) || open < 0 || close > 24 || close <= open || (intent === 'viewing' && duration !== 60)) throw new Error('Invalid hours');
  const slots = [];
  for (let hour = open; hour + duration / 60 <= close; hour++) {
    const time = String(hour).padStart(2,'0') + ':00';
    const range = slotRange_(date, time, duration);
    if (range.start > new Date() && calendars.every(calendar => calendar.getEvents(range.start, range.end).length === 0)) slots.push(time);
  }
  return slots;
}
function validateDate_(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) throw new Error('Invalid date');
  const day = new Date(text + 'T12:00:00Z');
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== text) throw new Error('Invalid date');
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const max = Utilities.formatDate(new Date(Date.now() + 90 * 86400000), TIME_ZONE, 'yyyy-MM-dd');
  if (text <= today || text > max) throw new Error('Date outside booking window');
}
function slotRange_(date, time, duration) {
  // Explicit London offset works even if the Apps Script project timezone is changed.
  const offset = Utilities.formatDate(new Date(date + 'T12:00:00Z'), TIME_ZONE, 'Z');
  const start = new Date(date + 'T' + time + ':00' + offset.slice(0,3) + ':' + offset.slice(3));
  return { start: start, end: new Date(start.getTime() + duration * 60000) };
}
/** Owner edits event title to CONFIRMED — ... or DECLINED — ... in Google Calendar. */
function processPendingApprovals() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return;
  try {
    const config = settings_();
    const ids = [...new Set([config.viewing, ...Object.values(config.rooms)].filter(Boolean))];
    const from = new Date(Date.now() - 86400000), until = new Date(Date.now() + 91 * 86400000);
    ids.forEach(id => {
      const calendar = CalendarApp.getCalendarById(id);
      if (!calendar) return;
      calendar.getEvents(from, until).forEach(event => {
        const reference = event.getTag('calmRequestId');
        const email = event.getTag('calmCustomerEmail');
        if (!reference || !validEmail_(email) || event.getTag('calmNotified') !== 'no') return;
        const confirmed = event.getTitle().startsWith('CONFIRMED —');
        const declined = event.getTitle().startsWith('DECLINED —');
        if (!confirmed && !declined) return;
        // A notification is sent once; if delivery is uncertain it is flagged for manual review.
        event.setTag('calmNotified', 'sending');
        const when = Utilities.formatDate(event.getStartTime(), TIME_ZONE, 'EEEE d MMMM yyyy, HH:mm');
        try {
          MailApp.sendEmail({ to: email, subject: confirmed ? 'Your Calm Collective booking is confirmed' : 'Your Calm Collective booking request',
            name: 'Calm Collective', replyTo: config.email,
            body: (confirmed ? 'Your booking is confirmed for ' + when + ' (UK time).' : 'We are unable to confirm your requested time. Please contact us to arrange an alternative.') + '\n\n72A Market Place, Warwick, CV34 4SD\nReference: ' + reference + '\nContact: ' + config.email + ' / 07508 070295' });
          event.setTag('calmNotified','yes');
          PropertiesService.getScriptProperties().setProperty('request:' + reference, JSON.stringify({ state: confirmed ? 'confirmed' : 'declined', at: Date.now() }));
          if (declined) event.deleteEvent(); // release declined hold
        } catch (_) { event.setTag('calmNotified', 'check-delivery'); }
      });
    });
  } finally { lock.releaseLock(); }
}
function installApprovalTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => { if (trigger.getHandlerFunction() === 'processPendingApprovals') ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('processPendingApprovals').timeBased().everyMinutes(5).create();
}
function clean_(value, limit) { return String(value == null ? '' : value).trim().slice(0,limit); }
function validEmail_(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ''); }
function validId_(id) { if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id || '')) throw new Error('Invalid reference'); return id; }
