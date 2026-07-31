<template>
  <section class="home-page feature-panel active">
    <div class="home-hero container-xl">
      <div class="home-hero-card">
        <div>
          <p class="home-kicker">Coder Online Tools Lab</p>
          <h1 class="home-title">工程工具首页</h1>
          <p class="home-copy">
            你可以从这里进入 CAN 架构设计、J1939 辅助转换、曲线图和文言编程，快速开始当前工作。
          </p>
        </div>
        <div class="home-hero-actions">
          <button class="btn btn-outline-primary home-hero-primary" type="button" @click="go('/can-arch')">打开 CAN 架构</button>
          <button class="btn btn-outline-primary" type="button" @click="go('/chart')">打开曲线图</button>
          <button class="btn btn-outline-primary" type="button" @click="go('/wenyan')">打开文言编程</button>
        </div>
      </div>

      <div class="home-cards">
        <article class="home-card">
          <h2>CAN 架构设计器</h2>
          <p>拖拽 ECU、配置 J1939 / CANopen、导入导出 DBC，并内嵌 J1939 PGN/ID 辅助工具。</p>
          <button class="btn btn-sm btn-success" type="button" @click="go('/can-arch')">进入</button>
        </article>
        <article class="home-card">
          <h2>曲线图</h2>
          <p>按曲线组管理数据，支持函数编辑、显示设置和图形渲染。</p>
          <button class="btn btn-sm btn-success" type="button" @click="go('/chart')">进入</button>
        </article>
        <article class="home-card">
          <h2>文言编程</h2>
          <p>代码编辑、帮助文档和古书渲染一体化的实验性工作区。</p>
          <button class="btn btn-sm btn-success" type="button" @click="go('/wenyan')">进入</button>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

function go(path) {
  router.push(path);
}
</script>
