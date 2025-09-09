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
  // 모달 내 체크박스(최종학력) - 다중 중 1개만 선택되도록 제어
  const modalEduCheckboxes = modalForm ? Array.from(modalForm.querySelectorAll('input[name="education"].edu-checkbox')) : [];
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
    mql: window.matchMedia('(max-width: 768px)'),
    pushAlarmTimer: null
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

  // ===== PushAlarm 위치 보정: 항상 하단 입력폼 위에 표시 =====
  function updatePushAlarmPosition() {
    try {
      const bar = document.querySelector('.bottom-bar');
      const footer = document.querySelector('.site-footer');
      const barH = bar ? Math.ceil(bar.getBoundingClientRect().height) : 88; // fallback
      const gap = 12; // 입력폼/푸터와의 간격
      const isMobile = state.mql && (state.mql.matches === true);
      const safe = isMobile && window.visualViewport && (window.visualViewport.height !== window.innerHeight)
        ? (window.innerHeight - window.visualViewport.height)
        : 0;

      let bottomPx = Math.max(0, barH + gap + safe);

      if (isMobile) {
        // 모바일에서만 푸터 보정 적용
        if (footer) {
          const fr = footer.getBoundingClientRect();
          if (fr.top < window.innerHeight) {
            const overlapFromBottom = Math.max(0, window.innerHeight - fr.top);
            bottomPx = Math.max(bottomPx, overlapFromBottom + gap + safe);
          }
        }
      }

      document.querySelectorAll('.pushAlarm').forEach(el => {
        el.style.bottom = bottomPx + 'px';
      });
    } catch(_) {}
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
    updatePushAlarmPosition();
  }
  state.mql.addEventListener ? state.mql.addEventListener('change', handleViewportChange)
                             : state.mql.addListener(handleViewportChange); // Safari legacy
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', updatePushAlarmPosition, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updatePushAlarmPosition);
  }

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
    return { ok: nameOk && phoneOk, phoneSan: p, nameOk, phoneOk };
  }

  // 제출 진행 상태 UI 관리
    let _submitInFlight = false;
    let _cooldownTimer = null; // 연속 제출 쿨다운

    // 전송 엔드포인트: 기본은 동일 출처 API, 실패 시 GAS로 폴백
    const API_URL = "/api/submit";
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxXAo-09FU64IKc0ysm8exbyqGgIPRst6-2NdEnqLux5oHVSSs2ZAeAXHgqfWqv8D9h/exec";

    function createOverlay(){
    const el = document.createElement('div');
    el.className = 'submitting-overlay';
    el.innerHTML = `<div style='font-weight:600;'>등록 중입니다<span class="dot">...</span></div>`;
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
    const modalControls  = [modalName, modalPhone, ...modalEduCheckboxes, modalAgree, modalForm && modalForm.querySelector('[type="submit"]')].filter(Boolean);

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

  // 학력 코드 → 한글 라벨 매핑
  function mapEduToKorean(code) {
    switch (String(code || '').trim()) {
      case 'highschool': return '고졸';
      case 'associate':  return '초대졸';
      case 'college':    return '대졸';
      case 'other':      return '기타';
      default:           return '';
    }
  }

  async function submitData(name, phone, scope = 'any', education = '') {

    if (_submitInFlight) return false; // 중복 제출 즉시 차단
    
    // 동일 출처 API 우선 시도, 실패 시 GAS로 폴백
    const url = API_URL;
   
    const device  = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'mobile' : 'pc';
    const payload = { name, phone, device, education: mapEduToKorean(education) };

    // UI: 등록 중 표시 & 컨트롤 잠금
    setSubmitting(true, scope);

    try {
        let ok = false;
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          ok = resp.ok;
          if (!ok) throw new Error(`HTTP ${resp.status}`);
          // 응답 본문은 선택적으로만 처리
          await resp.json().catch(() => ({}));
        } catch (apiErr) {
          // API 실패(file://, 정적 호스팅, 배포 미완, CORS 등) 시 GAS로 폴백
          await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
          });
          ok = true; // no-cors는 응답 확인 불가 → 성공 가정
        }
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

  // ===== Error bubble helpers =====
  const _errorBubbles = new WeakMap();

  function clearErrorBubbles() {
    document.querySelectorAll('.error-bubble').forEach(el => el.remove());
    _errorBubbles && _errorBubbles.clear && _errorBubbles.clear();
  }

  function showFieldError(targetEl, message) {
    if (!targetEl) return;

    // 기존 말풍선 제거(필드 단위)
    const prev = _errorBubbles.get(targetEl);
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    const bubble = document.createElement('div');
    bubble.className = 'error-bubble';
    bubble.textContent = message;
    bubble.style.visibility = 'hidden';

    document.body.appendChild(bubble);

    const rect = targetEl.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();

    // position: fixed 기준 → viewport 좌표 사용
    const gap = 8;
    let top = rect.top - bubbleRect.height - gap;
    let left = rect.left; // 기본은 왼쪽 정렬

    // 화면 오른쪽 넘침 방지
    const maxLeft = window.innerWidth - bubbleRect.width - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    if (left < 8) left = 8;

    // 화면 위로 넘어가면 대상 위쪽에 배치가 어려우므로 위로 조금 더 여백만 두고 붙임
    if (top < 8) top = Math.max(8, rect.top + rect.height + gap);

    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
    bubble.style.visibility = 'visible';

    _errorBubbles.set(targetEl, bubble);

    // 자동 제거 타이머
    const timer = setTimeout(() => {
      if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
      if (_errorBubbles.has(targetEl)) _errorBubbles.delete(targetEl);
    }, 3000);

    // 입력/변경 시 제거
    const cleanup = () => {
      clearTimeout(timer);
      if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
      targetEl.removeEventListener('input', cleanup, { once: true });
      targetEl.removeEventListener('change', cleanup, { once: true });
      if (_errorBubbles.has(targetEl)) _errorBubbles.delete(targetEl);
    };
    targetEl.addEventListener('input', cleanup, { once: true });
    targetEl.addEventListener('change', cleanup, { once: true });
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

  // ===== Push Alarm ticker =====
  function startPushAlarmTicker(intervalMs = 6000) {
     try {
       const items = Array.from(document.querySelectorAll('.pushAlarm'));
       if (!items.length) return;
       // 초기 상태: 모두 숨김 + 투명
       items.forEach(el => { el.style.display = 'none'; el.style.opacity = '0'; });

       // 정밀 타이밍(밀리초)
       const FADE_MS = 1500; // 1.5초 페이드 (styles.css transition과 일치)
       const HOLD_MS = 1500; // 1.5초 유지(보이는 상태)
       const GAP_MS  = 100; // 1.5초 공백(완전히 사라진 뒤)

       let index = -1;
       let timer = null;

       const clearTimer = () => { if (state.pushAlarmTimer) { clearTimeout(state.pushAlarmTimer); state.pushAlarmTimer = null; } if (timer) { clearTimeout(timer); timer = null; } };

       const fadeOutPrev = (el) => {
         if (!el) return; // 첫 사이클
         el.style.opacity = '0';
         el.style.transform = 'translate(-50%, 10px)';
         // 페이드 아웃 종료 시점에 display:none 처리
         setTimeout(() => { el.style.display = 'none'; }, FADE_MS + 20);
       };

       const fadeInNext = (el) => {
         if (!el) return;
         el.style.display = 'block';
         el.style.opacity = '0';
         el.style.transform = 'translate(-50%, 10px)';
         // reflow to ensure transition triggers
         void el.offsetWidth;
         el.style.opacity = '0.8';
         el.style.transform = 'translate(-50%, 0)';
       };

       const tick = () => {
         // 1) 이전 요소 페이드아웃 (1.5s)
         const prevEl = index >= 0 ? items[index] : null;
         fadeOutPrev(prevEl);

         // 2) 공백(1.5s) 후 다음 요소 페이드인 (1.5s)
         timer = setTimeout(() => {
           index = (index + 1) % items.length;
           const nextEl = items[index];
           fadeInNext(nextEl);
           // 3) 유지(1.5s) 후 다음 사이클 시작 (다시 1)로 복귀)
           state.pushAlarmTimer = setTimeout(tick, HOLD_MS);
         }, FADE_MS + GAP_MS);
       };

       // 중복 실행 방지 후 시작
       clearTimer();
       tick();
     } catch (e) { console.warn('pushAlarm ticker init failed:', e); }
   }

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
        clearErrorBubbles();
        const name = nameInput.value.trim();
        const phone = phoneInput.value;
        const { ok, phoneSan, nameOk, phoneOk } = validateForm(name, phone);
        if (!nameOk) {
          showFieldError(nameInput, '이름을 입력해 주세요.');
          nameInput.focus();
          return;
        }
        if (!phoneOk) {
          showFieldError(phoneInput, '휴대폰 번호(숫자 10~11자리)를 입력해 주세요.');
          phoneInput.focus();
          return;
        }
        if (!agreeInput || !agreeInput.checked) {
          // 체크박스 바로 위에 표시
          showFieldError(agreeInput, '개인정보 처리방침에 동의해 주세요.');
          agreeInput.focus();
          return;
        }
        const education = eduSelect ? (eduSelect.value || '') : '';
        const success = await submitData(name, phoneSan, 'sticky', education);
        if (success) stickyForm.reset(); // 성공시에만 reset
      });
    }
  
  // Modal form submit
  if (modalForm) {
    // 체크박스 1개만 선택되도록 강제
    if (modalEduCheckboxes.length) {
      modalEduCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            modalEduCheckboxes.forEach(other => { if (other !== cb) other.checked = false; });
          }
        });
      });
    }

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
      const checked = modalEduCheckboxes.find(cb => cb.checked);
      const education = checked ? checked.value : '';
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
    // pushAlarm 위치 초기 보정
    updatePushAlarmPosition();
    // 푸시 알림 순차 노출 시작(요소가 있으면 동작) - 총 6초 사이클(페이드인 1.5s, 유지 1.5s, 페이드아웃 1.5s, 공백 1.5s)
    startPushAlarmTicker(6000);
  })();
})();
