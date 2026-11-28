/* ============================================================
 * 手机填写模式 —— 轻量弹窗（Popup）
 *
 * 交互：点表格里任意输入框 → 弹出一个小窗（底部/居中，不遮挡全表）
 *      小窗里有「常用值按钮」+「自定义输入」，确认后写回该输入框。
 *
 * 铁律：本文件不含任何计算公式。
 *      写回目标始终是页面原有的那个输入框（触发它自己的 change），
 *      由页面原有 calc() 负责重算。
 * ============================================================ */
(function () {
  'use strict';

  var PRESET = {
    rate: { title: '汇率', unit: 'THB → CNY', opts: ['4.20', '4.50', '4.70', '4.85', '5.00'] },
    qty: { title: '件数', unit: '件', opts: ['10', '20', '50', '100', '200'] },
    wt: { title: '单件净重', unit: 'KG / 件', opts: ['6', '8', '10', '12'] },
    price: { title: '收果价', unit: '฿ / KG', opts: ['70', '80', '100', '120', '150'] },
    actualWt: { title: '国内实际净重', unit: 'KG / 件', opts: ['8', '9', '9.5', '10'] },
    // 泰国费用：按单价计
    thUnit: { title: '费用单价', unit: '฿', opts: ['1', '2', '3', '5', '10'] },
    // 金额类
    thAmount: { title: '泰国费用金额', unit: '฿', opts: ['1000', '3000', '5000', '7000'] },
    cnAmount: { title: '中国费用金额', unit: '¥', opts: ['100', '500', '1000', '2000'] }
  };

  var CSS = [
    '.wz-mask{position:fixed;inset:0;background:rgba(0,0,0,.18);z-index:9998;display:none}',
    '.wz-mask.on{display:block}',
    '.wz-pop{position:fixed;z-index:9999;background:#fff;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.28);width:340px;max-width:calc(100vw - 24px);padding:14px;display:none}',
    '.wz-pop.on{display:block}',
    '.wz-pop h4{margin:0 0 2px;font-size:15px;color:#1B5E20}',
    '.wz-pop .wz-sub{font-size:12px;color:#9E9E9E;margin-bottom:10px}',
    '.wz-opts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}',
    '.wz-opt{padding:8px 14px;border:1.5px solid #C8E6C9;border-radius:20px;background:#F1F8E9;color:#2E7D32;font-size:15px;font-weight:600;cursor:pointer}',
    '.wz-opt.sel{background:#1B5E20;color:#fff;border-color:#1B5E20}',
    '.wz-row{display:flex;gap:8px;align-items:center}',
    '.wz-in{flex:1;padding:11px;font-size:18px;font-weight:700;text-align:center;border:1.5px solid #C8E6C9;border-radius:9px;outline:none;background:#FAFFF5}',
    '.wz-in:focus{border-color:#1B5E20}',
    '.wz-ok{padding:11px 16px;border:none;border-radius:9px;background:#1B5E20;color:#fff;font-size:15px;font-weight:700;cursor:pointer}',
    '.wz-focus{outline:3px solid #FF6F00 !important;outline-offset:2px;background:#FFF8E1 !important}',
    '.wz-tip{position:fixed;right:14px;bottom:76px;z-index:9996;background:#FF6F00;color:#fff;border-radius:20px;padding:8px 14px;font-size:12px;box-shadow:0 3px 10px rgba(0,0,0,.2)}'
  ].join('\n');

  var cur = null;  // { input, kind }
  var pop, mask;

  function injectStyle() {
    if (document.getElementById('wz-style')) return;
    var st = document.createElement('style');
    st.id = 'wz-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // 根据 class / id 判断这一格属于哪类，用于取常用值
  function kindOf(inp) {
    if (inp.id === 'exchangeRate') return 'rate';
    if (inp.classList.contains('qty')) return 'qty';
    if (inp.classList.contains('wt')) return 'wt';
    if (inp.classList.contains('price')) return 'price';
    if (inp.classList.contains('actual-wt')) return 'actualWt';
    var tr = inp.closest ? inp.closest('tr') : null;
    if (tr && tr.parentElement && tr.parentElement.id === 'thFeeBody') {
      // 泰国费用行：第一个输入框是按单价，第二个是金额
      var inputs = tr.querySelectorAll('input');
      return inputs[0] === inp ? 'thUnit' : 'thAmount';
    }
    if (tr && tr.parentElement && tr.parentElement.id === 'cnFeeBody') return 'cnAmount';
    return 'cnAmount';
  }

  function labelOf(inp) {
    // 找同行的级别名/费用名做标题
    var tr = inp.closest ? inp.closest('tr') : null;
    if (!tr) return '';
    var nameInput = tr.querySelector('input.name') || tr.querySelector('input[style*="text-align:left"]');
    return nameInput ? nameInput.value : '';
  }

  function ensureDom() {
    if (pop) return;
    mask = document.createElement('div'); mask.className = 'wz-mask';
    pop = document.createElement('div'); pop.className = 'wz-pop';
    pop.innerHTML = [
      '<h4></h4>',
      '<div class="wz-sub"></div>',
      '<div class="wz-opts"></div>',
      '<div class="wz-row">',
      '  <input class="wz-in" type="number" step="0.01" inputmode="decimal" placeholder="自定义">',
      '  <button class="wz-ok">确定</button>',
      '</div>'
    ].join('');
    document.body.appendChild(mask);
    document.body.appendChild(pop);
    mask.addEventListener('click', close);
    pop.querySelector('.wz-ok').addEventListener('click', confirmValue);
  }

  // 把弹窗贴在输入框下方（空间不够就放上方）
  function place(inp) {
    var r = inp.getBoundingClientRect();
    var pw = 340, ph = 210;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8);
    var top = r.bottom + 8;
    if (top + ph > window.innerHeight) top = Math.max(8, r.top - ph - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function open(inp) {
    ensureDom();
    cur = { input: inp, kind: kindOf(inp) };
    var p = PRESET[cur.kind] || PRESET.cnAmount;
    pop.querySelector('h4').textContent = p.title + '（' + p.unit + '）';
    pop.querySelector('.wz-sub').textContent = labelOf(inp) || '';
    var box = pop.querySelector('.wz-opts');
    box.innerHTML = '';
    p.opts.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'wz-opt' + (String(inp.value) === v ? ' sel' : '');
      b.type = 'button'; b.textContent = v;
      b.addEventListener('click', function () { setValue(v); });
      box.appendChild(b);
    });
    var sin = pop.querySelector('.wz-in');
    sin.value = inp.value && inp.value !== '0' ? inp.value : '';
    mask.classList.add('on');
    pop.classList.add('on');
    place(inp);
    setTimeout(function () {
      try { sin.focus(); sin.select(); } catch (e) {}
    }, 80);
  }

  function setValue(v) {
    if (!cur) return;
    var inp = cur.input;
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));   // 交给页面原有逻辑重算
    close();
  }

  function confirmValue() {
    var v = pop.querySelector('.wz-in').value;
    if (v === '') { close(); return; }
    setValue(v);
  }

  function close() {
    if (!pop) return;
    pop.classList.remove('on');
    mask.classList.remove('on');
    if (cur && cur.input) cur.input.classList.remove('wz-focus');
    cur = null;
  }

  // 让所有表格里的输入框点一下就弹窗
  function bind() {
    var inputs = document.querySelectorAll('#gradeBody input, #thFeeBody input, #cnFeeBody input');
    Array.prototype.forEach.call(inputs, function (inp) {
      if (inp.__wzBound) return;
      inp.__wzBound = true;
      inp.setAttribute('readonly', 'readonly');      // 先读后写，避免手机键盘抢焦点
      inp.addEventListener('focus', function () {
        close();
        inp.classList.add('wz-focus');
        open(inp);
      });
      inp.addEventListener('click', function () {
        if (cur && cur.input === inp) return;
        close();
        inp.classList.add('wz-focus');
        open(inp);
      });
      // 让 readonly 仍可聚焦
      inp.style.cursor = 'pointer';
    });
  }

  function tip() {
    var d = document.createElement('div');
    d.className = 'wz-tip';
    d.textContent = '点表格里的数字即可修改';
    document.body.appendChild(d);
    setTimeout(function () { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; }, 4000);
    setTimeout(function () { d.remove(); }, 4600);
  }

  function boot() {
    injectStyle();
    bind();
    tip();
    // 表格增删行后会重建，重新绑定
    setInterval(bind, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.wizard = { open: open, close: close, rebind: bind };
})();
