<template>
  <section id="feature-j1939" class="feature-panel" :class="{ active }">
    <div class="j1939-panel container-xl">
      <div class="j1939-grid">
        <div class="j1939-card card shadow-sm border-0">
          <div class="card-body">
            <div class="j1939-card-title card-title h5">ID 转 PGN</div>
            <div class="row g-2 align-items-end">
              <div class="col-12 col-lg-6">
                <label for="input-j1939-id" class="form-label mb-1">29位ID</label>
                <input id="input-j1939-id" class="form-control form-control-sm" type="text" value="0x18E1F3EF" placeholder="支持十进制或0x十六进制">
              </div>
              <div class="col-auto">
                <button id="btn-convert-id" class="btn btn-outline-primary" type="button">转换</button>
              </div>
            </div>
            <div id="id-to-pgn-result" class="j1939-result"></div>
          </div>
        </div>

        <div class="j1939-card card shadow-sm border-0">
          <div class="card-body">
            <div class="j1939-card-title card-title h5">PGN 转 ID</div>
            <div class="j1939-form-grid">
              <label for="input-j1939-pgn">PGN</label>
              <input id="input-j1939-pgn" class="form-control form-control-sm" type="text" value="65043" placeholder="支持十进制或0x十六进制">

              <label for="input-j1939-priority">优先级 P (0-7)</label>
              <input id="input-j1939-priority" class="form-control form-control-sm" type="number" min="0" max="7" value="3">

              <label for="input-j1939-sa">源地址 SA (0-255)</label>
              <input id="input-j1939-sa" class="form-control form-control-sm" type="text" value="131">

              <label for="input-j1939-da">目的地址 DA (0-255)</label>
              <input id="input-j1939-da" class="form-control form-control-sm" type="text" value="0x27">
            </div>
            <div id="pgn-validation-msg" class="j1939-validation"></div>
            <div class="mt-12">
              <button id="btn-convert-pgn" class="btn btn-success" type="button">转换</button>
            </div>
            <div id="pgn-to-id-result" class="j1939-result mt-12"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});
</script>
