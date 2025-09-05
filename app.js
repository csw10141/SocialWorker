(function(){
  const gallery = document.getElementById('gallery');

  // Sticky form elements
  const stickyForm = document.getElementById('stickyForm');
  const nameInput = document.getElementById('nameInput');
  const phoneInput = document.getElementById('phoneInput');
  const eduSelect = document.getElementById('eduSelect');
  const agreeInput = document.getElementById('agreeInput');
  const openPolicyFromSticky = document.getElementById('openPolicyFromSticky');

  // Modal elements
  const modal = document.getElementById('modal');
  const modalClose = document.getElementById('modalClose');
  const modalForm = document.getElementById('modalForm');
  const modalName = document.getElementById('modalName');
  const modalPhone = document.getElementById('modalPhone');
  const modalEdu = document.getElementById('modalEdu');
  const modalAgree = document.getElementById('modalAgree');
  const openPolicyFromModal = document.getElementById('openPolicyFromModal');

  // Policy modal elements
  const policyModal = document.getElementById('policyModal');
  const policyClose = document.getElementById('policyClose');

  // Hotspot position config (percentages relative to image container)
  // Desktop vs Mobile separate values
  const HOTSPOT_CONFIG = {
    index: 3, // zero-based index for 4th image
    desktop: { top: 57, left: 50, width: 74, height: 16 },
    mobile:  { top: 60, left: 50, width: 84, height: 18 } // tuned for <=768px
  };

  /**
   * images/ 폴더의 이미지를 숫자 순서로 탐색합니다.
   * 1..50까지 gif/png/jpg/jpeg/webp 확장자를 시도하고, 연속 미스가 일정 횟수 넘으면 중단합니다.
   */
  async function discoverImages(maxTry = 4, consecutiveMissLimit = 5) {
    const exts = ['gif', 'png', 'jpg', 'jpeg', 'webp'];
    const found = [];

    let misses = 0;
    for (let i = 1; i <= maxTry; i++) {
      let matched = null;
      for (const ext of exts) {
        const url = `images/${i}.${ext}`;
        // eslint-disable-next-line no-await-in-loop
        const ok = await canLoad(url);
        if (ok) { matched = url; break; }
      }
      if (matched) {
        found.push(matched);
        misses = 0;
      } else {
        misses++;
        if (misses >= consecutiveMissLimit) break;
      }
    }
    return found;
  }

  function canLoad(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const done = (ok) => {
        img.onload = null; img.onerror = null;
        resolve(ok);
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url + `?v=${Date.now()}`;
    });
  }

  const state = {
    images: [],
    modalOpen: false,
    policyOpen: false,
    hotspotEl: null,
    mql: window.matchMedia('(max-width: 768px)')
  };

  function applyHotspotPosition(el) {
    if (!el) return;
    const isMobile = state.mql.matches;
    const c = isMobile ? HOTSPOT_CONFIG.mobile : HOTSPOT_CONFIG.desktop;
    el.style.top = c.top + '%';
    el.style.left = c.left + '%';
    el.style.width = c.width + '%';
    el.style.height = c.height + '%';
    // Ensure center-anchor positioning
    el.style.bottom = 'auto';
    el.style.transform = 'translate(-50%, -50%)';
  }

  function renderGallery(urls) {
    gallery.innerHTML = '';
    state.hotspotEl = null;

    urls.forEach((src, i) => {
      const item = document.createElement('figure');
      item.className = 'gallery-item';

      const img = new Image();
      img.src = src;
      img.alt = `이미지 ${i + 1}`;
      item.appendChild(img);

      // 4번째 이미지에만 핫스팟 버튼 추가
      if (i === HOTSPOT_CONFIG.index) {
        const hotspot = document.createElement('button');
        hotspot.type = 'button';
        hotspot.className = 'hotspot';
        hotspot.setAttribute('aria-label', '무료상담 신청 영역');
        applyHotspotPosition(hotspot);
        hotspot.addEventListener('click', () => openModal(true));
        item.appendChild(hotspot);
        state.hotspotEl = hotspot;
      }

      gallery.appendChild(item);
    });
  }

  // Update hotspot on viewport change
  function handleViewportChange() {
    applyHotspotPosition(state.hotspotEl);
  }
  state.mql.addEventListener ? state.mql.addEventListener('change', handleViewportChange)
                             : state.mql.addListener(handleViewportChange); // Safari legacy
  window.addEventListener('resize', handleViewportChange);

  // Modal helpers
  function openModal(prefill = true) {
    state.modalOpen = true;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (prefill) {
      if (nameInput && nameInput.value) modalName.value = nameInput.value;
      if (phoneInput && phoneInput.value) modalPhone.value = phoneInput.value;
    }
    setTimeout(() => modalName.focus(), 0);
  }

  function closeModal() {
    state.modalOpen = false;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openPolicyModal() {
    state.policyOpen = true;
    policyModal.hidden = false;
    policyModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closePolicyModal() {
    state.policyOpen = false;
    policyModal.hidden = true;
    policyModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Simple validation
  function sanitizePhone(val) { return (val || '').replace(/[^0-9]/g, ''); }
  function validateForm(name, phone) {
    const p = sanitizePhone(phone);
    const nameOk = typeof name === 'string' && name.trim().length >= 1;
    const phoneOk = p.length >= 10 && p.length <= 11;
    return { ok: nameOk && phoneOk, phoneSan: p };
  }

  // 제출 진행 상태 UI 관리
    let _submitInFlight = false;
    let _cooldownTimer = null; // 연속 제출 쿨다운

    function createOverlay(){
    const el = document.createElement('div');
    el.className = 'submitting-overlay';
    el.innerHTML = `<div>등록 중입니다<span class="dot">...</span></div>`;
    return el;
    }
    const overlayEl = createOverlay();

    function setSubmitting(on, scope /* 'sticky' | 'modal' | 'any' */){
    // 플래그
    _submitInFlight = !!on;

    // 오버레이
    if (on) {
        if (!document.body.contains(overlayEl)) document.body.appendChild(overlayEl);
    } else {
        if (document.body.contains(overlayEl)) document.body.removeChild(overlayEl);
    }

    // 폼 컨트롤 비활성화
    const stickyControls = [nameInput, phoneInput, eduSelect, agreeInput, stickyForm && stickyForm.querySelector('[type="submit"]')].filter(Boolean);
    const modalControls  = [modalName, modalPhone, modalEdu, modalAgree, modalForm && modalForm.querySelector('[type="submit"]')].filter(Boolean);

    const disable = (arr, disabled) => arr.forEach(el => { try{ el.disabled = disabled; }catch(_){} });

    if (scope === 'sticky') disable(stickyControls, on);
    else if (scope === 'modal') disable(modalControls, on);
    else {
        disable(stickyControls, on);
        disable(modalControls, on);
    }

    // 접근성
    if (stickyForm) stickyForm.setAttribute('aria-busy', on ? 'true' : 'false');
    if (modalForm)  modalForm.setAttribute('aria-busy',  on ? 'true' : 'false');
    }

    // 연속 제출 쿨다운(중복 방지)
    function startCooldown(ms = 6000){
    clearTimeout(_cooldownTimer);
    _cooldownTimer = setTimeout(()=>{ _submitInFlight = false; }, ms);
    }


  async function submitData(name, phone, scope = 'any', education = '') {

    if (_submitInFlight) return false; // 중복 제출 즉시 차단
    
    const url = "https://script.google.com/macros/s/AKfycbzuBorWV63iF8rZAgO43bP3W3vklJovQMrD7EWSJOGuS9R87x-JN_s6NHrgwhvI9qBM/exec";
  
    const device  = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'pc';
    const payload = { name, phone, device, education: String(education || '') };

    // UI: 등록 중 표시 & 컨트롤 잠금
    setSubmitting(true, scope);

    try {
        // no-cors: 응답은 못 읽음. 성공/실패 판단 불가 → UX상 성공 가정.
        await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
        });

        alert(`상담 신청이 접수되었습니다.\n이름: ${name}\n전화: ${phone}`);
        // 중복 방지 쿨다운(네트워크/시트 반영 지연 대비)
        startCooldown(6000);
        return true;
    } catch (err) {
        console.error('Submit failed:', err);
        alert('전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        return false;
    } finally {
        setSubmitting(false, scope);
    }
}

  // Phone auto-formatting helpers
  function formatPhone(value) {
    const d = (value || '').replace(/\D/g, '').slice(0, 11);
    if (d.startsWith('02')) { // 서울 국번 처리 (유선)
      if (d.length <= 2) return d;
      if (d.length <= 6) return d.slice(0,2) + '-' + d.slice(2);
      if (d.length <= 10) return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6);
      return d.slice(0,2) + '-' + d.slice(2,6) + '-' + d.slice(6,10);
    }
    if (d.length < 4) return d;
    if (d.length < 7) return d.slice(0,3) + '-' + d.slice(3);
    if (d.length <= 10) return d.slice(0,3) + '-' + d.slice(3,6) + '-' + d.slice(6);
    return d.slice(0,3) + '-' + d.slice(3,7) + '-' + d.slice(7);
  }

  function attachPhoneAutoFormat(inputEl) {
    if (!inputEl) return;
    // Format while typing
    inputEl.addEventListener('input', () => {
      const caretToEnd = (inputEl.selectionStart === inputEl.value.length);
      const formatted = formatPhone(inputEl.value);
      inputEl.value = formatted;
      // Keep caret at end for simplicity (good UX for phone typing)
      if (caretToEnd) inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
    });
    // Ensure final formatting on blur
    inputEl.addEventListener('blur', () => {
      inputEl.value = formatPhone(inputEl.value);
    });
  }

  // 이벤트 바인딩 - 정책 모달
  if (openPolicyFromSticky) {
    openPolicyFromSticky.addEventListener('click', (e) => {
      e.preventDefault();
      openPolicyModal();
    });
  }
  if (openPolicyFromModal) {
    openPolicyFromModal.addEventListener('click', (e) => {
      e.preventDefault();
      openPolicyModal();
    });
  }
  if (policyClose) policyClose.addEventListener('click', closePolicyModal);
  if (policyModal) {
    policyModal.addEventListener('click', (e) => {
      const dlg = e.target.closest('.modal-dialog');
      if (!dlg) closePolicyModal();
    });
  }

  // Attach phone auto-formatters
  attachPhoneAutoFormat(phoneInput);
  attachPhoneAutoFormat(modalPhone);

  // 상담 모달 바인딩
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      const dlg = e.target.closest('.modal-dialog');
      if (!dlg) closeModal();
    });
  }

  // Esc 키로 모달 닫기
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.policyOpen) { closePolicyModal(); return; }
    if (state.modalOpen) { closeModal(); return; }
  });

  // Sticky form submit
if (stickyForm) {
    stickyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const phone = phoneInput.value;
      const { ok, phoneSan } = validateForm(name, phone);
      if (!ok) {
        alert('이름과 휴대폰 번호(숫자 10~11자리)를 정확히 입력해 주세요.');
        return;
      }
      if (!agreeInput || !agreeInput.checked) {
        alert('개인정보 처리방침에 동의해 주세요.');
        return;
      }
      const education = eduSelect ? (eduSelect.value || '') : '';
      const success = await submitData(name, phoneSan, 'sticky', education);
      if (success) stickyForm.reset(); // 성공시에만 reset
    });
  }
  
  // Modal form submit
  if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalName.value.trim();
      const phone = modalPhone.value;
      const { ok, phoneSan } = validateForm(name, phone);
      if (!ok) {
        alert('이름과 휴대폰 번호(숫자 10~11자리)를 정확히 입력해 주세요.');
        return;
      }
      if (!modalAgree || !modalAgree.checked) {
        alert('개인정보 처리방침에 동의해 주세요.');
        return;
      }
      const education = modalEdu ? (modalEdu.value || '') : '';
      const success = await submitData(name, phoneSan, 'modal', education);
      if (success) {
        closeModal();
        modalForm.reset();
      }
    });
  }

  // Initialize
  (async function init(){
    state.images = await discoverImages(4, 3);
    if (state.images.length === 0) {
      const fallback = [];
      for (let i = 1; i <= 10; i++) fallback.push(`images/${i}.gif`);
      state.images = fallback;
    }
    renderGallery(state.images);
    // Apply once after render in case of initial mobile viewport
    applyHotspotPosition(state.hotspotEl);
  })();
})();
