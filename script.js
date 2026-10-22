(() => {
const form = document.querySelector('#booking-form');
if (!form || form.dataset.initialised) return;
form.dataset.initialised = 'true';
const status = document.querySelector('#booking-status');
const submit = form.querySelector('.request');
const delivery = document.querySelector('#form-delivery-note');
const recipient = 'calmcollectiverooms@gmail.com';
const api = window.CALM_BOOKING_API_URL || '';
let directDelivery = false, submitting = false, submitted = false;
let draftText = '';
function setStatus(text, error = false) {
  status.textContent = text;
  status.className = error ? 'error' : '';
}
function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!api) return reject(new Error('Service unavailable'));
    const callback = `calm_${crypto.randomUUID().replaceAll('-', '')}`;
    const script = document.createElement('script');
    let done = false;
    const finish = (error, result) => {
      if (done) return;
      done = true; clearTimeout(timer); script.remove();
      window[callback] = () => {};
      setTimeout(() => delete window[callback], 60000);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Service timed out')), 6000);
    window[callback] = result => finish(null, result);
    script.onerror = () => finish(new Error('Service unavailable'));
    script.src = `${api}?${new URLSearchParams({ ...params, callback })}`;
    document.head.append(script);
  });
}
function enquiryText() {
  const data = new FormData(form);
  return [
    'Calm Collective room enquiry', '',
    `Name: ${String(data.get('name')).trim()}`,
    `Email: ${String(data.get('email')).trim()}`,
    `Room: ${form.elements.room.selectedOptions[0].textContent}`,
    `Dates: ${String(data.get('dates')).trim() || 'Flexible / to discuss'}`,
    `Questions: ${String(data.get('notes')).trim() || 'None'}`,
    '', 'This is an enquiry, not a confirmed booking.'
  ].join('\n');
}
function prepareEmail() {
  draftText = enquiryText();
  const link = document.querySelector('#email-draft-link');
  link.href = `mailto:${recipient}?subject=${encodeURIComponent('Calm Collective room enquiry')}&body=${encodeURIComponent(draftText)}`;
  document.querySelector('#email-fallback').hidden = false;
  setStatus('Your email draft is ready. Review it in your email app and press Send. Nothing has been sent by this website.');
  link.click();
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || submitted || !form.reportValidity()) return;
  if (!form.elements.name.value.trim()) { form.elements.name.focus(); setStatus('Please enter your name.', true); return; }
  if (form.elements.website.value) return;
  if (!directDelivery) { prepareEmail(); return; }
  submitting = true;
  const requestId = crypto.randomUUID();
  const payload = { ...Object.fromEntries(new FormData(form)), action: 'contact', requestId };
  form.querySelectorAll('input, select, textarea, button').forEach(control => control.disabled = true);
  setStatus('Sending your enquiry…');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      await fetch(api, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: controller.signal });
    } finally { clearTimeout(timer); }
    let result;
    for (let attempt = 0; attempt < 6; attempt++) {
      result = await jsonp({ action: 'status', requestId });
      if (result.state !== 'processing') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (result?.ok && result.state === 'received') {
      submitted = true;
      submit.textContent = 'Enquiry received';
      setStatus(`Thank you. Your enquiry has been received. We’ll contact you to discuss the details. Your booking is not confirmed yet. Reference: ${requestId}`);
    } else if (result?.state === 'failed') {
      form.querySelectorAll('input, select, textarea, button').forEach(control => control.disabled = false);
      setStatus('Your enquiry was not accepted. Check your details or email calmcollectiverooms@gmail.com.', true);
    } else throw new Error('Receipt uncertain');
  } catch {
    submitted = true; // A timed-out POST may have succeeded. Prevent duplicate enquiries.
    setStatus(`We couldn’t verify receipt. Please contact ${recipient} with reference ${requestId} before sending another enquiry.`, true);
  } finally { submitting = false; }
});
document.querySelector('#copy-enquiry').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(draftText); setStatus(`Enquiry copied. Paste it into an email to ${recipient}.`); }
  catch { setStatus(`Copy is unavailable in this browser. Use “Open enquiry email” or email ${recipient} directly.`, true); }
});
document.querySelectorAll('.room-select').forEach(link => link.addEventListener('click', () => {
  if (submitting || submitted) return;
  form.elements.room.value = link.dataset.room;
}));
document.querySelectorAll('[data-intent="viewing"]').forEach(link => link.addEventListener('click', () => {
  if (submitting || submitted) return;
  if (!form.elements.notes.value.trim()) form.elements.notes.value = 'I’d like to arrange a viewing.';
}));
// Enable direct delivery only when the deployed bridge explicitly supports the
// five-field form AND confirms the new mailbox. Never send through the old route.
jsonp({ action: 'contact-health' }).then(health => {
  if (submitting || submitted || !health.ok || health.mode !== 'room-enquiry' || health.recipient !== recipient) return;
  directDelivery = true;
  submit.textContent = 'Send enquiry';
  delivery.textContent = 'Send your enquiry to the Calm Collective team. We’ll reply by email to discuss your room and dates.';
}).catch(() => {});

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
// Load the decorative loop only when motion is welcome, or on explicit play.
const backgroundVideo = document.querySelector('#hero-video');
const videoToggle = document.querySelector('.video-toggle');
if (backgroundVideo && videoToggle) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  backgroundVideo.muted = true;
  backgroundVideo.autoplay = !reducedMotion.matches && !navigator.connection?.saveData;
  videoToggle.hidden = false;
  function updateVideoControl() {
    const action = backgroundVideo.paused ? 'Play' : 'Pause';
    videoToggle.textContent = `${action} video`;
    videoToggle.setAttribute('aria-label', `${action} background video`);
  }
  function playBackgroundVideo() {
    if (!backgroundVideo.getAttribute('src')) backgroundVideo.src = backgroundVideo.dataset.src;
    backgroundVideo.play().catch(updateVideoControl);
  }
  backgroundVideo.addEventListener('playing', () => {
    backgroundVideo.classList.add('is-ready');
    updateVideoControl();
  });
  backgroundVideo.addEventListener('pause', updateVideoControl);
  backgroundVideo.addEventListener('error', () => {
    backgroundVideo.classList.remove('is-ready');
    videoToggle.hidden = true;
  });
  videoToggle.addEventListener('click', () => {
    if (backgroundVideo.paused) playBackgroundVideo();
    else backgroundVideo.pause();
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      backgroundVideo.autoplay = false;
      backgroundVideo.pause();
    }
  });
  if (backgroundVideo.autoplay) playBackgroundVideo();
}
})();
