(() => {
const form = document.querySelector('#booking-form');
const status = document.querySelector('#booking-status');
const api = window.CALM_BOOKING_API_URL || '';
const stepFields = [...form.querySelectorAll('[data-step]')];
const progress = [...document.querySelectorAll('.steps li')];
const dateInput = form.elements.date;
const timeInput = form.elements.time;
const timeGrid = document.querySelector('#time-grid');
const availabilityMessage = document.querySelector('#availability-message');
const retryButton = document.querySelector('#retry-availability');
let step = 0, availabilityVersion = 0, submitting = false, connection = 'checking';
let calendarCapabilities = null;
let requestId = null;
let submissionStarted = false;

function londonDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
dateInput.min = londonDate(new Date(Date.now() + 86400000));
dateInput.max = londonDate(new Date(Date.now() + 90 * 86400000));
function setStatus(text, error = false) { status.textContent = text; status.className = error ? 'error' : ''; }
function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!api) return reject(new Error('Service unavailable'));
    const callback = `calm_${crypto.randomUUID().replaceAll('-', '')}`;
    const script = document.createElement('script');
    let done = false;
    const finish = (error, result) => {
      if (done) return;
      done = true; clearTimeout(timer); script.remove();
      window[callback] = () => {}; // late responses must not throw after timeout
      setTimeout(() => delete window[callback], 60000);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Service timed out')), 12000);
    window[callback] = result => finish(null, result);
    script.onerror = () => finish(new Error('Service unavailable'));
    script.src = `${api}?${new URLSearchParams({ ...params, callback })}`;
    document.head.append(script);
  });
}
function intent() { return form.elements.intent.value; }
function calendarReady() {
  return connection === 'calendar' && calendarCapabilities && (intent() === 'viewing' ? calendarCapabilities.viewing : calendarCapabilities.rooms.includes(form.elements.room.value));
}
function displayStep(next) {
  step = next;
  stepFields.forEach((field, index) => { field.hidden = index !== step; });
  progress.forEach((item, index) => index === step ? item.setAttribute('aria-current', 'step') : item.removeAttribute('aria-current'));
  if (step === 2) renderSummary();
  const legend = stepFields[step].querySelector('legend');
  legend.tabIndex = -1; legend.focus({ preventScroll: true });
  document.querySelector('.booking-card').scrollIntoView({ block: 'start', behavior: 'smooth' });
  setStatus(connection === 'offline' ? 'Online requests are temporarily unavailable. Please call 07508 070295 or email the team.' : '', connection === 'offline');
}
function validStep() {
  if (step === 0) {
    if (!dateInput.reportValidity()) return false;
    if (!timeInput.value) { setStatus('Please choose a preferred time.', true); timeGrid.querySelector('button')?.focus(); return false; }
  }
  for (const input of stepFields[step].querySelectorAll('input, select, textarea')) {
    if (!input.checkValidity()) { input.reportValidity(); return false; }
  }
  return true;
}
form.querySelectorAll('.next-step').forEach(button => button.addEventListener('click', () => { if (validStep()) displayStep(step + 1); }));
form.querySelectorAll('.back-step').forEach(button => button.addEventListener('click', () => displayStep(step - 1)));
function formatDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
function entries() {
  const data = new FormData(form);
  return {
    Request: intent() === 'viewing' ? 'Viewing' : 'Room hire',
    Room: form.elements.room.selectedOptions[0].textContent,
    Date: formatDate(data.get('date')),
    Time: `${data.get('time')} (UK time)`,
    ...(intent() === 'room' ? { Length: form.elements.duration.selectedOptions[0].textContent, Pattern: data.get('frequency') } : {}),
    Name: data.get('name'), Email: data.get('email'), Phone: data.get('phone'),
    Practice: data.get('therapyType') === 'Other' ? data.get('otherTherapy') : data.get('therapyType'),
    ...(data.get('notes') ? { Notes: data.get('notes') } : {})
  };
}
function renderSummary() {
  const summary = document.querySelector('#request-summary'); summary.replaceChildren();
  for (const [key, value] of Object.entries(entries())) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = key; dd.textContent = value; summary.append(dt, dd);
  }
}
function updateIntent() {
  document.querySelectorAll('[data-room-only]').forEach(label => label.hidden = intent() !== 'room');
  loadAvailability();
}
form.querySelectorAll('[name=intent]').forEach(input => input.addEventListener('change', updateIntent));
[dateInput, form.elements.room, form.elements.duration].forEach(input => input.addEventListener('change', loadAvailability));
retryButton.addEventListener('click', loadAvailability);
form.elements.therapyType.addEventListener('change', () => {
  const other = form.elements.therapyType.value === 'Other';
  document.querySelector('#other-therapy-field').hidden = !other;
  form.elements.otherTherapy.required = other;
});
function renderTimes(slots, version) {
  if (version !== availabilityVersion) return;
  timeGrid.replaceChildren();
  slots.forEach(slot => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = slot;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      timeInput.value = slot;
      [...timeGrid.children].forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      setStatus('');
    });
    timeGrid.append(button);
  });
}
async function loadAvailability() {
  const version = ++availabilityVersion;
  timeInput.value = ''; timeGrid.replaceChildren(); retryButton.hidden = true;
  if (!dateInput.value || !dateInput.checkValidity()) { availabilityMessage.textContent = 'Choose a date within the next 90 days.'; return; }
  if (connection === 'checking') { availabilityMessage.textContent = 'Checking the request service…'; return; }
  if (calendarReady()) {
    availabilityMessage.textContent = 'Checking the calendar…';
    try {
      const result = await jsonp({ action: 'availability', date: dateInput.value, intent: intent(), room: form.elements.room.value, duration: intent() === 'viewing' ? '60' : form.elements.duration.value });
      if (version !== availabilityVersion) return;
      if (!result.ok || !Array.isArray(result.slots)) throw new Error('Unable to check availability');
      const slots = result.slots.filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot));
      availabilityMessage.textContent = slots.length ? 'Times currently free in the diary. Requests still need team approval. All times are UK time.' : 'No times available on this date. Please choose another day or contact us.';
      renderTimes(slots, version);
    } catch {
      if (version !== availabilityVersion) return;
      availabilityMessage.textContent = 'We couldn’t check the diary. Try again or call 07508 070295.';
      retryButton.hidden = false;
    }
  } else {
    availabilityMessage.textContent = 'Choose a preferred time for the team to check. These are request times, not confirmed availability. All times are UK time.';
    const start = intent() === 'viewing' ? 10 : 8;
    const end = intent() === 'viewing' ? 15 : 21 - Number(form.elements.duration.value) / 60;
    renderTimes(Array.from({ length: end - start + 1 }, (_, i) => `${String(start + i).padStart(2, '0')}:00`), version);
  }
}
async function connect() {
  try {
    const health = await jsonp({ action: 'booking-health' });
    if (health.ok && health.version === 2) {
      connection = 'calendar'; calendarCapabilities = { viewing: health.viewing === true, rooms: Array.isArray(health.rooms) ? health.rooms : [] };
    } else {
      const legacy = await jsonp({ action: 'enquiry-health' });
      if (!legacy.ok || legacy.mode !== 'callback-enquiry') throw new Error('Service unavailable');
      connection = 'enquiry';
    }
  } catch { connection = 'offline'; }
  if (connection === 'offline') {
    form.querySelector('.request').disabled = true;
    setStatus('Online requests are temporarily unavailable. Please call 07508 070295 or email calmcollectivebooking@gmail.com.', true);
  }
  loadAvailability();
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (step < 2) { if (validStep()) displayStep(step + 1); return; }
  if (submitting || submissionStarted || !validStep()) return;
  if (connection === 'checking') { setStatus('The request service is still connecting. Please wait a moment.', true); return; }
  if (connection === 'offline') { setStatus('Please call 07508 070295 or email the team to make your request.', true); return; }
  submitting = true;
  requestId = crypto.randomUUID();
  const data = Object.fromEntries(new FormData(form));
  const summary = Object.entries(entries()).map(([key,value]) => `${key}: ${value}`).join('\n');
  const payload = connection === 'calendar' ? { ...data, action: 'request', requestId } : {
    action: 'enquiry', requestId, name: data.name, phone: data.phone, therapyType: data.therapyType,
    otherTherapy: data.otherTherapy, callbackTime: 'Contact by phone or email', website: data.website,
    notes: `BOOKING REQUEST — NOT CONFIRMED\nReference: ${requestId}\n${summary}`.slice(0, 1800)
  };
  form.querySelectorAll('button, input, select, textarea').forEach(control => control.disabled = true);
  setStatus('Sending your request…');
  try {
    submissionStarted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try { await fetch(api, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    let result;
    for (let attempt = 0; attempt < 6; attempt++) {
      result = await jsonp({ action: 'status', requestId });
      if (result.state !== 'processing') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (result?.ok && ['confirmed', 'received', 'pending'].includes(result.state)) {
      stepFields.forEach(field => field.hidden = true);
      document.querySelector('.steps').hidden = true;
      const success = document.querySelector('#booking-success'); success.hidden = false;
      document.querySelector('#request-reference').textContent = `Your reference: ${requestId}`;
      setStatus(''); success.focus();
    } else if (result?.state === 'failed') {
      submissionStarted = false;
      form.querySelectorAll('button, input, select, textarea').forEach(control => control.disabled = false);
      setStatus('The request was not accepted. Please check the date and time again, or contact the team.', true);
      // Refresh availability before allowing another calendar request.
      if (calendarReady()) { displayStep(0); await loadAvailability(); setStatus('That request could not be accepted. Please choose a time again or contact us.', true); }
    } else throw new Error('Uncertain result');
  } catch {
    setStatus(`We couldn’t verify receipt. Please contact the team with reference ${requestId} before submitting another request.`, true);
    // A timed-out POST may have succeeded. Do not invite a duplicate submission.
  } finally { submitting = false; }
});
// Browser validation cannot focus a control inside a previous hidden step.
form.noValidate = true;
document.querySelectorAll('.room-select').forEach(link => link.addEventListener('click', () => {
  if (submissionStarted) return;
  form.elements.room.value = link.dataset.room; form.elements.intent.value = 'room'; displayStep(0); updateIntent();
}));
document.querySelectorAll('[data-intent]').forEach(link => link.addEventListener('click', () => {
  if (submissionStarted) return;
  form.elements.intent.value = link.dataset.intent; displayStep(0); updateIntent();
}));
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
function closeMenu() { menuButton.setAttribute('aria-expanded','false'); nav.classList.remove('is-open'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open); });
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
  document.querySelector('.mobile-booking').classList.toggle('is-hidden', entries[0].isIntersecting);
}, { threshold: 0 }).observe(document.querySelector('#booking'));
// Native dialog keeps keyboard focus inside the full-size photograph viewer.
const photoLinks = [...document.querySelectorAll('.gallery-open')];
const photoViewer = document.querySelector('#photo-viewer');
let currentPhoto = 0;
function showPhoto(index) {
  currentPhoto = (index + photoLinks.length) % photoLinks.length;
  const link = photoLinks[currentPhoto];
  const preview = link.querySelector('img');
  const photo = document.querySelector('#viewer-image');
  photo.src = link.href;
  photo.alt = preview.alt;
  document.querySelector('#viewer-caption').textContent = link.closest('figure').querySelector('figcaption').textContent;
  document.querySelector('#photo-counter').textContent = `Photo ${currentPhoto + 1} of ${photoLinks.length}`;
}
if (photoViewer && typeof photoViewer.showModal === 'function') {
  photoLinks.forEach((link, index) => link.addEventListener('click', event => {
    event.preventDefault(); showPhoto(index); photoViewer.showModal();
    document.body.classList.add('gallery-is-open');
  }));
  photoViewer.querySelector('.viewer-close').addEventListener('click', () => photoViewer.close());
  photoViewer.querySelector('.viewer-previous').addEventListener('click', () => showPhoto(currentPhoto - 1));
  photoViewer.querySelector('.viewer-next').addEventListener('click', () => showPhoto(currentPhoto + 1));
  photoViewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(currentPhoto + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(currentPhoto - 1); }
  });
  photoViewer.addEventListener('click', event => {
    if (event.target !== photoViewer) return;
    const rect = photoViewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) photoViewer.close();
  });
  photoViewer.addEventListener('close', () => document.body.classList.remove('gallery-is-open'));
}

connect();

})();
