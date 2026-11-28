/* ============================================================
 * 手机填写模式（弹窗向导）
 * 设计原则：
 *   1. 不包含任何计算公式。弹窗只负责“把输入写回原来的表格输入框”。
 *   2. 数据来源只读：直接读页面原有全局变量 grades / thFees / cnFees
 *      以及汇率输入框，写回时触发原输入框自身的 onchange（= 原有计算）。
 *   3. 不覆盖任何原有函数，只在 window.wizard 上挂自己的方法与 UI。
 * ============================================================ */
(function () {
  'use strict';

  // ---------- 工具 ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // 把值写进“原来的输入框”并触发它自己的事件，让原有逻辑负责计算
  function commit(input, value) {
    if (!input) return;
    // 页面 render 会重建行，必须每次现场取最新节点（见 locate()）
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // 读取页面当前状态（只读，用于展示与判断）
  function snapshot() {
    var rate = $('#exchangeRate');
    return {
      rate: rate ? rate.value : '',
      grades: (typeof grades !== 'undefined' ? grades : []).map(function (g) {
        return { name: g.name, qty: g.qty, wt: g.wt, price: g.price, actualWt: g.actualWt };
      }),
      th: (typeof thFees !== 'undefined' ? thFees : []).map(function (f) {
        return { name: f.name, unitPrice: f.unitPrice, amount: f.amount, calcType: f.calcType || 'manual' };
      }),
      cn: (typeof cnFees !== 'undefined' ? cnFees : []).map(function (f) {
        return { name: f.name, amount: f.amount, auto: /增值税/.test(f.name) };
      }),
      result: {
        perKg: ($('#perKgFee') || {}).textContent || '',
        breakdown: ($('#feeBreakdown') || {}).textContent || ''
      }
    };
  }

  // ---------- 样式（独立命名空间 wz-，不改原有样式） ----------
  var CSS = [
    '.wz-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9998;display:none;align-items:flex-end;justify-content:center}',
    '.wz-mask.on{display:flex}',
    '.wz-panel{background:#fff;width:100%;max-width:520px;max-height:92vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -4px 24px rgba(0,0,0,.25)}',
    '@media(min-width:620px){.wz-mask{align-items:center}.wz-panel{border-radius:16px}}',
    '.wz-head{padding:14px 16px 10px;border-bottom:1px solid #EEF2EE;display:flex;justify-content:space-between;align-items:center}',
    '.wz-head h3{font-size:16px;color:#1B5E20;margin:0}',
    '.wz-close{border:none;background:#F1F8E9;color:#1B5E20;border-radius:50%;width:30px;height:30px;font-size:16px;cursor:pointer}',
    '.wz-prog{height:4px;background:#E8F5E9}.wz-prog>i{display:block;height:100%;background:#4CAF50;width:0;transition:width .25s}',
    '.wz-body{padding:16px;overflow-y:auto;flex:1}',
    '.wz-label{font-size:13px;color:#616161;margin-bottom:6px}',
    '.wz-name{font-size:17px;font-weight:700;color:#212121;margin-bottom:2px}',
    '.wz-hint{font-size:12px;color:#9E9E9E;margin-bottom:12px}',
    '.wz-input{width:100%;padding:14px;font-size:24px;font-weight:700;text-align:center;border:2px solid #C8E6C9;border-radius:10px;outline:none;background:#FAFFF5}',
    '.wz-input:focus{border-color:#1B5E20}',
    '.wz-unit{text-align:center;color:#9E9E9E;font-size:12px;margin-top:6px}',
    '.wz-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
    '.wz-chip{padding:8px 14px;border:1px solid #C8E6C9;border-radius:18px;background:#F1F8E9;color:#2E7D32;font-size:13px;cursor:pointer}',
    '.wz-foot{padding:12px 16px;border-top:1px solid #EEF2EE;display:flex;gap:10px;background:#fff}',
    '.wz-btn{flex:1;padding:13px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}',
    '.wz-btn.next{background:#1B5E20;color:#fff}',
    '.wz-btn.prev{background:#F1F8E9;color:#1B5E20}',
    '.wz-btn.skip{background:#fff;color:#616161;border:1px solid #E0E0E0}',
    '.wz-item{display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid #E8F5E9;border-radius:10px;margin-bottom:8px;cursor:pointer}',
    '.wz-item .n{font-weight:600;font-size:14px}.wz-item .v{color:#1B5E20;font-weight:700;font-size:15px}',
    '.wz-item.done{border-color:#4CAF50;background:#F9FDF9}',
    '.wz-badge{font-size:11px;color:#fff;background:#9E9E9E;border-radius:8px;padding:1px 6px;margin-left:6px}',
    '.wz-badge.ok{background:#4CAF50}.wz-badge.auto{background:#FF6F00}',
    '.wz-result{background:#F1F8E9;border-radius:10px;padding:14px;margin-bottom:12px}',
    '.wz-result .k{font-size:12px;color:#616161}.wz-result .num{font-size:26px;font-weight:700;color:#1B5E20}',
    '.wz-open{position:fixed;right:16px;bottom:16px;z-index:9997;background:#1B5E20;color:#fff;border:none;border-radius:26px;padding:13px 18px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;display:none}',
    '@media(max-width:900px){.wz-open{display:block}}',
    '@media(min-width:901px){.wz-mask{align-items:center}}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('wz-style')) return;
    var st = document.createElement('style');
    st.id = 'wz-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---------- 步骤定义：每一项都对应“页面里真实存在的一个输入框” ----------
  // locate: 返回该输入框 DOM；读值从 DOM 读，写值写回 DOM
  function gradeInput(row, cls) {
    var tr = $$('#gradeBody tr')[row];
    return tr ? tr.querySelector('.' + cls) : null;
  }
  function thInput(idx, showUnitPrice) {
    var tr = $$('#thFeeBody tr')[idx];
    if (!tr) return null;
    var inputs = $$('input', tr);
    return showUnitPrice ? inputs[0] : inputs[1];
  }
  function cnInput(idx) {
    var tr = $$('#cnFeeBody tr')[idx];
    return tr ? tr.querySelector('input') : null;
  }

  function buildSteps() {
    var steps = [];
    var snap = snapshot();

    // 1. 汇率
    steps.push({
      key: 'rate', section: '汇率', title: '汇率', sub: 'THB → CNY',
      unit: '泰铢兑人民币', get: function () { return ($('#exchangeRate') || {}).value; },
      set: function (v) { commit($('#exchangeRate'), v); },
      chips: ['4.2', '4.5', '4.7', '4.85', '5.0']
    });

    // 2. 每个级别 4 项
    snap.grades.forEach(function (g, i) {
      var fields = [
        ['qty', '件数', '件', ['10', '20', '50', '100']],
        ['wt', '单件净重', 'KG / 件', ['9', '10', '12']],
        ['price', '收果价', '฿ / KG', ['80', '100', '120']],
        ['actualWt', '国内实际净重', 'KG / 件', ['9', '9.5', '10']]
      ];
      fields.forEach(function (f) {
        steps.push({
          key: 'g' + i + '_' + f[0], section: g.name, title: f[1], sub: g.name,
          unit: f[2], chips: f[3],
          get: function () { var el = gradeInput(i, f[0]); return el ? el.value : ''; },
          set: function (v) { commit(gradeInput(i, f[0]), v); }
        });
      });
    });

    // 3. 泰国费用：只有“手动/单价”项需要填；自动项跳过
    snap.th.forEach(function (f, i) {
      var ct = f.calcType || 'manual';
      if (ct === 'shrinkage') {
        steps.push({ key: 'th' + i, section: '泰国费用', title: f.name, sub: '自动计算', auto: true,
          note: '失水 = 收果价总额 ÷ (1-5%) × 5%，无需填写' });
        return;
      }
      var byUnit = (ct === 'weight' || ct === 'qty');
      steps.push({
        key: 'th' + i, section: '泰国费用', title: f.name,
        sub: byUnit ? (ct === 'weight' ? '按重量计价' : '按件数计价') : '手动填金额',
        unit: byUnit ? (ct === 'weight' ? '฿ / KG' : '฿ / 件') : '฿ 合计',
        auto: false,
        get: function () { var el = thInput(i, byUnit); return el ? el.value : ''; },
        set: function (v) { commit(thInput(i, byUnit), v); }
      });
    });

    // 4. 中国费用：增值税自动，跳过
    snap.cn.forEach(function (f, i) {
      if (f.auto) {
        steps.push({ key: 'cn' + i, section: '中国费用', title: f.name, sub: '自动计算', auto: true,
          note: '增值税 = (收果价总额 + 泰国费用小计) ÷ 汇率 × 9%，无需填写' });
        return;
      }
      steps.push({
        key: 'cn' + i, section: '中国费用', title: f.name, sub: '手动填金额', unit: '¥ 合计',
        get: function () { var el = cnInput(i); return el ? el.value : ''; },
        set: function (v) { commit(cnInput(i), v); }
      });
    });

    steps.push({ key: 'done', title: '完成', finish: true });
    return steps;
  }

  // ---------- 渲染 ----------
  var state = { steps: [], idx: 0, mask: null };

  function ensureDom() {
    if (state.mask) return;
    var mask = document.createElement('div');
    mask.className = 'wz-mask';
    mask.innerHTML = [
      '<div class="wz-panel">',
      '  <div class="wz-head"><h3></h3><button class="wz-close">✕</button></div>',
      '  <div class="wz-prog"><i></i></div>',
      '  <div class="wz-body"></div>',
      '  <div class="wz-foot"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(mask);
    mask.querySelector('.wz-close').addEventListener('click', close);
    state.mask = mask;
  }

  function openButton() {
    if (document.getElementById('wz-open')) return;
    var b = document.createElement('button');
    b.id = 'wz-open'; b.className = 'wz-open'; b.textContent = '📝 手机填写';
    b.addEventListener('click', open);
    document.body.appendChild(b);
  }

  function open(startIdx) {
    state.steps = buildSteps();
    state.idx = startIdx || 0;
    ensureDom();
    state.mask.classList.add('on');
    render();
  }
  function close() { if (state.mask) state.mask.classList.remove('on'); refreshOpenBadge(); }

  function refreshOpenBadge() {
    var big = document.getElementById('wz-open');
    if (big) big.textContent = snapshot().result.perKg && snapshot().result.perKg !== '¥0.00' ? '📝 手机填写 · ' + snapshot().result.perKg + '/kg' : '📝 手机填写';
  }

  function render() {
    var s = state.steps[state.idx];
    var mask = state.mask;
    mask.querySelector('.wz-head h3').textContent = s.section || '填写';
    mask.querySelector('.wz-prog>i').style.width = ((state.idx + 1) / state.steps.length * 100) + '%';
    var body = mask.querySelector('.wz-body');
    var foot = mask.querySelector('.wz-foot');

    if (s.finish) { renderFinish(body, foot); return; }

    body.innerHTML = [
      '<div class="wz-label">' + state.idx + ' / ' + (state.steps.length - 1) + '</div>',
      '<div class="wz-name"></div>',
      '<div class="wz-hint"></div>',
      s.auto ? '<div class="wz-label" style="background:#FFF3E0;border-radius:8px;padding:10px;color:#FF6F00"></div>'
             : '<input class="wz-input" type="number" step="0.01" inputmode="decimal">',
      s.auto ? '' : '<div class="wz-unit"></div>',
      (!s.auto && s.chips) ? '<div class="wz-chips"></div>' : ''
    ].join('');
    body.querySelector('.wz-name').textContent = s.title;
    body.querySelector('.wz-hint').textContent = s.sub || '';
    if (s.auto) {
      body.querySelectorAll('div.wz-label')[1].textContent = s.note || '';
    } else {
      var inp = body.querySelector('.wz-input');
      inp.value = s.get() === '' ? '' : String(s.get());
      body.querySelector('.wz-unit').textContent = s.unit || '';
      var chips = body.querySelector('.wz-chips');
      if (chips && s.chips) {
        s.chips.forEach(function (c) {
          var b = document.createElement('button');
          b.className = 'wz-chip'; b.type = 'button'; b.textContent = c + ' ' + (s.unit || '');
          b.addEventListener('click', function () { inp.value = c; onNext(); });
          chips.appendChild(b);
        });
      }
      setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
    }

    foot.innerHTML = state.idx === 0 ? '<button class="wz-btn next">下一项</button>'
      : '<button class="wz-btn prev">上一项</button>' + (s.auto ? '<button class="wz-btn next">下一项</button>' : '<button class="wz-btn skip">跳过</button><button class="wz-btn next">下一项</button>');
    var prev = foot.querySelector('.prev'); if (prev) prev.addEventListener('click', function () { state.idx--; render(); });
    var skip = foot.querySelector('.skip'); if (skip) skip.addEventListener('click', function () { onNext(true); });
    foot.querySelector('.next').addEventListener('click', function () { onNext(); });
  }

  function onNext(skip) {
    var s = state.steps[state.idx];
    if (!s.auto && !skip) {
      var inp = state.mask.querySelector('.wz-input');
      if (inp && inp.value !== '') { var v = inp.value; s.set(v); }
      // 采用“即时生效”：每填一项就写回，页面原有 calc() 立刻重算
    }
    if (state.idx < state.steps.length - 1) { state.idx++; render(); }
  }

  function renderFinish(body, foot) {
    var snap = snapshot();
    body.innerHTML = [
      '<div class="wz-result">',
      '  <div class="k">每公斤费用摊销</div>',
      '  <div class="num" id="wz-perkg"></div>',
      '  <div class="k" style="margin-top:8px" id="wz-break"></div>',
      '</div>',
      '<div class="wz-label">点击可回到对应项修改</div>',
      '<div id="wz-list"></div>'
    ].join('');
    document.getElementById('wz-perkg').textContent = snap.result.perKg;
    document.getElementById('wz-break').textContent = snap.result.breakdown;
    var list = document.getElementById('wz-list');
    state.steps.forEach(function (s, i) {
      if (s.finish) return;
      var v = s.auto ? '自动' : (s.get() || '0');
      var d = document.createElement('div');
      d.className = 'wz-item';
      d.innerHTML = '<div class="n">' + s.title + (s.auto ? '<span class="wz-badge auto">自动</span>' : '') +
                    '</div><div class="v">' + v + ' ' + (s.unit || '') + '</div>';
      d.addEventListener('click', function () { state.idx = i; render(); });
      list.appendChild(d);
    });
    foot.innerHTML = '<button class="wz-btn prev" style="flex:0 0 auto">返回</button><button class="wz-btn next">完成</button>';
    foot.querySelector('.prev').addEventListener('click', function () { state.idx = Math.max(0, state.steps.length - 2); render(); });
    foot.querySelector('.next').addEventListener('click', close);
  }

  // ---------- 启动 ----------
  function boot() {
    injectStyle();
    openButton();
    refreshOpenBadge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.wizard = { open: open, close: close, snapshot: snapshot, buildSteps: buildSteps };
})();
