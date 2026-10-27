<template>
  <section class="home-page feature-panel active">
    <div class="home-hero container-xl">
      <div class="home-hero-card">
        <div>
          <p class="home-kicker">Coder Online Tools Lab</p>
          <h1 class="home-title">工程工具首页</h1>
          <p class="home-copy">
            从工程设计、图表与代码实验，到 Git 学习、知识检索和材料阅读，快速开始当前工作。
          </p>
        </div>
        <div class="home-hero-actions">
          <button
            v-for="tool in tools"
            :key="tool.path"
            class="btn btn-outline-primary"
            :class="{ 'home-hero-primary': tool.path === '/can-arch' }"
            type="button"
            @click="go(tool.path)"
          >
            {{ tool.action }}
          </button>
        </div>
      </div>

      <div class="home-cards">
        <article v-for="tool in tools" :key="tool.path" class="home-card">
          <div class="home-card-heading">
            <span class="home-card-icon" :class="`home-card-icon-${tool.tone}`">
              <HomeToolIcon :name="tool.icon" />
            </span>
            <h2>{{ tool.title }}</h2>
          </div>
          <p>{{ tool.description }}</p>
          <button class="btn btn-sm btn-success" type="button" @click="go(tool.path)">进入</button>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router';
import HomeToolIcon from '../ui/HomeToolIcon.vue';

const router = useRouter();

const tools = [
  {
    title: 'CAN 架构设计器',
    description: '拖拽 ECU、配置 J1939 / CANopen、导入导出 DBC，并内嵌 J1939 PGN/ID 辅助工具。',
    action: '打开 CAN 架构',
    path: '/can-arch',
    icon: 'network',
    tone: 'coral',
  },
  {
    title: '曲线图',
    description: '按曲线组管理数据，支持函数编辑、显示设置和图形渲染。',
    action: '打开曲线图',
    path: '/chart',
    icon: 'chart',
    tone: 'teal',
  },
  {
    title: '文言编程',
    description: '代码编辑、帮助文档和古书渲染一体化的实验性工作区。',
    action: '打开文言编程',
    path: '/wenyan',
    icon: 'code',
    tone: 'amber',
  },
  {
    title: 'Git 学习与练习',
    description: '通过交互式提交树和关卡练习分支、合并、变基与远程协作。',
    action: '开始学习 Git',
    path: '/learn-git',
    icon: 'git',
    tone: 'coral',
  },
  {
    title: '知识库问答',
    description: '配置私有检索 API 与授权信息，面向企业知识库进行问答与结果回显。',
    action: '打开知识问答',
    path: '/knowledge-chat',
    icon: 'search',
    tone: 'teal',
  },
  {
    title: '材料阅读',
    description: '选择成果文件夹，浏览 learn-from-materials 生成的互动 HTML 和 Markdown 学习成果。',
    action: '打开材料阅读',
    path: '/material-reader',
    icon: 'book',
    tone: 'amber',
  },
  {
    title: 'PlantUML 甘特图',
    description: '通过嵌入式 Gantt Studio 创建、导入、预览并导出 PlantUML 甘特图项目。',
    action: '打开甘特图',
    path: '/tool-gui-gantte',
    icon: 'timeline',
    tone: 'coral',
  },
];

function go(path) {
  router.push(path);
}
</script>
