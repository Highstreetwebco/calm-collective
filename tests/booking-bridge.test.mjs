import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8');
function setup() {
  const props = { BUSINESS_EMAIL: 'business@example.com', VIEWING_CALENDAR_ID: 'viewings', HOST_CALENDAR_ID: 'host', CALM_ROOM_CALENDAR_ID: 'calm', STILL_ROOM_CALENDAR_ID: 'still' };
  const calendars = {};
  for (const id of ['viewings','host','calm','still']) calendars[id] = {
    events: [], getEvents(start,end) { return this.events.filter(e => e.start < end && e.end > start); },
    createEvent(title,start,end,options) {
      const event = { title, start, end, options, tags: {}, setTag(k,v) { this.tags[k] = v; }, getTag(k) { return this.tags[k]; }, getTitle() { return this.title; }, getStartTime() { return this.start; }, deleteEvent() { calendars[id].events = calendars[id].events.filter(e => e !== this); } };
      this.events.push(event); return event;
    }
  };
  const mail = [], cache = new Map(); let locked = false;
  const context = vm.createContext({ console, Date, Number, String, JSON, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({...props}), getProperty:k => props[k], setProperty(k,v) { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get:k => cache.get(k), put:(k,v) => cache.set(k,v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => locked ? false : (locked = true), hasLock: () => locked, releaseLock: () => { locked = false; } }) },
    CalendarApp: { getCalendarById: id => calendars[id] },
    MailApp: { sendEmail: data => mail.push(data) },
    ContentService: { MimeType: { JAVASCRIPT:'js' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    Utilities: { base64EncodeWebSafe: s => Buffer.from(s).toString('base64url'), formatDate(date,zone,format) {
      if (format === 'Z') { const name = new Intl.DateTimeFormat('en', {timeZone:zone,timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName').value; return name==='GMT'?'+0000':name.replace('GMT','').replace(':',''); }
      return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    } }
  });
  vm.runInContext(code,context);
  const date = new Date(Date.now()+3*86400000); while ([0,6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate()+1);
  const payload = { action:'request', requestId:'12345678-1234-1234-1234-123456789001', name:'Test practitioner', email:'test@example.com', phone:'07000000000', therapyType:'Coaching', consent:'on', room:'calm', intent:'room', duration:'60', date:date.toISOString().slice(0,10), time:'10:00', frequency:'One-off' };
  return { context, props, calendars, mail, cache, payload, post(p) { context.doPost({ postData:{ contents:JSON.stringify(p) } }); }, state(id) { return JSON.parse(props['request:'+id]).state; } };
}
test('same reference cannot create duplicate calendar holds or notices',()=>{
 const x=setup();x.post(x.payload);x.post(x.payload);assert.equal(x.calendars.calm.events.length,1);assert.equal(x.mail.length,1);assert.equal(x.state(x.payload.requestId),'pending');
});
test('competing requests cannot take same room; another room remains available',()=>{
 const x=setup();x.post(x.payload);const second={...x.payload,requestId:'12345678-1234-1234-1234-123456789002',email:'other@example.com'};x.post(second);assert.equal(x.state(second.requestId),'failed');assert.equal(x.calendars.calm.events.length,1);
 const third={...second,room:'still',requestId:'12345678-1234-1234-1234-123456789003'};x.post(third);assert.equal(x.state(third.requestId),'pending');assert.equal(x.calendars.still.events.length,1);
});
test('viewings respect host clashes and never read personal default calendar',()=>{
 const x=setup(), p={...x.payload,intent:'viewing'};const range=x.context.slotRange_(p.date,p.time,60);x.calendars.host.createEvent('busy',range.start,range.end,{});x.post(p);assert.equal(x.state(p.requestId),'failed');assert.equal(x.calendars.viewings.events.length,0);
});
test('missing calendar fails availability closed',()=>{
 const x=setup();assert.throws(()=>x.context.availableSlots_(x.payload.date,'room','haven',60));
});
test('any-room requests send an enquiry without reserving an arbitrary room',()=>{
 const x=setup();x.post({...x.payload,room:'any'});assert.equal(x.mail.length,1);assert.equal(x.state(x.payload.requestId),'received');assert.equal(x.calendars.calm.events.length,0);
});
test('UK summer and winter offsets are explicit',()=>{
 const x=setup();assert.equal(x.context.slotRange_('2027-07-20','10:00',60).start.toISOString(),'2027-07-20T09:00:00.000Z');assert.equal(x.context.slotRange_('2027-01-20','10:00',60).start.toISOString(),'2027-01-20T10:00:00.000Z');
});
test('invalid dates, duration, consent and honeypot cannot create events',()=>{
 for(const change of [{date:'2026-02-31'},{duration:'-60'},{consent:''},{website:'bot'}]) {const x=setup();x.post({...x.payload,...change});assert.equal(x.state(x.payload.requestId),'failed');assert.equal(x.calendars.calm.events.length,0);}
});
test('approval notifies once; decline releases a pending hold',()=>{
 const x=setup();x.post(x.payload);x.calendars.calm.events[0].title='CONFIRMED — The Calm Room';x.context.processPendingApprovals();x.context.processPendingApprovals();assert.equal(x.mail.length,2);assert.equal(x.state(x.payload.requestId),'confirmed');
 const y=setup();y.post(y.payload);y.calendars.calm.events[0].title='DECLINED — The Calm Room';y.context.processPendingApprovals();assert.equal(y.calendars.calm.events.length,0);assert.equal(y.state(y.payload.requestId),'declined');
});
test('status endpoint returns no customer information',()=>{
 const x=setup();x.post(x.payload);const response=x.context.doGet({parameter:{action:'status',requestId:x.payload.requestId,callback:'test'}}).text;assert.equal(response,'test({"ok":true,"state":"pending"});');
});
