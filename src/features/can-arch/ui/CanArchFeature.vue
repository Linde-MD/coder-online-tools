<template>
  <section id="feature-can-arch" class="feature-panel" :class="panelClassList">
    <div class="can-arch-panel container-xl">
      <div class="can-arch-header">
        <div>
          <h2 class="can-arch-title">
            {{ ecuMessageEditor.active ? `${ecuMessageEditor.ecu?.name || 'ECU'} 报文编辑器` : 'CAN 架构设计器' }}
          </h2>
          <p class="can-arch-note mb-0">
            {{ ecuMessageEditor.active
              ? '在此页配置该 ECU 各 CAN BUS 上的收发报文（Message / Signal）。'
              : '当前版本聚焦 ECU 建模：拖拽布局、协议配置、DBC 节点导入导出。' }}
          </p>
        </div>
        <div class="can-arch-toolbar-wrap">
          <div class="can-arch-menubar" @click.stop>
            <template v-if="!ecuMessageEditor.active">
              <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('file')">文件</button>
              <span class="can-menu-sep"></span>
            </template>
            <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('edit')">编辑</button>
            <span class="can-menu-sep"></span>
            <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('view')">视图</button>
            <template v-if="!ecuMessageEditor.active">
              <span class="can-menu-sep"></span>
              <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('export')">导出</button>
            </template>

            <div v-if="activeTopMenu === 'file' && !ecuMessageEditor.active" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" @click="runMenuAction(triggerImportDialog)">导入 DBC</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(triggerConfigImportDialog)">导入架构 JSON</button>
            </div>

            <div v-if="activeTopMenu === 'edit'" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" :disabled="!canUndo" @click="runMenuAction(undoNodes)">撤销</button>
              <button class="can-top-menu-item" type="button" :disabled="!canRedo" @click="runMenuAction(redoNodes)">重做</button>
              <button class="can-top-menu-item danger" type="button" :disabled="!hasAnySelectionForDelete" @click="runMenuAction(deleteSelected)">删除选中</button>
            </div>

            <div v-if="activeTopMenu === 'view'" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" @click="runMenuAction(toggleFullscreen)">{{ isFullscreen ? '退出全屏 (Esc)' : '全屏查看 (Ctrl+Shift+F)' }}</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(toggleMagneticHeader)">{{ magneticHeader ? '关闭顶部磁吸' : '开启顶部磁吸' }}</button>
              <template v-if="!ecuMessageEditor.active">
                <button v-if="isSideCollapsed" class="can-top-menu-item" type="button" @click="runMenuAction(showSideCard)">显示属性面板</button>
                <button v-else class="can-top-menu-item" type="button" @click="runMenuAction(hideSideCard)">隐藏属性面板</button>
              </template>
            </div>

            <div v-if="activeTopMenu === 'export' && !ecuMessageEditor.active" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" @click="runMenuAction(exportArchitectureConfig)">导出架构 JSON</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(exportSelectedNodes)" :disabled="!hasAnySelectionForExport">导出选中 DBC</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(exportArchitectureSvg)">导出 SVG</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(exportArchitecturePng)">导出 PNG</button>
              <label class="can-top-menu-check">
                <input type="checkbox" v-model="exportPrefs.includeBackground">
                导出包含背景
              </label>
              <label class="can-top-menu-check">
                <input type="checkbox" v-model="exportPrefs.autoCrop">
                自动裁剪空白
              </label>
            </div>
          </div>

          <div class="can-arch-toolbar can-arch-toolbar-icons">
            <template v-if="!ecuMessageEditor.active">
              <select v-model="activeLinkStyle" class="form-select form-select-sm can-link-style-select" title="连线样式" @change="applyActiveStyleToSelectedLink">
                <option value="polyline">折线（可加锚点）</option>
                <option value="curve">曲线</option>
                <option value="rounded">圆角折线</option>
                <option value="orthogonal">直角折线</option>
              </select>
              <button class="can-icon-tool-btn" type="button" title="新增 ECU" data-tip="新增 ECU" @click="addNode()">
                <span aria-hidden="true">＋</span>
              </button>
              <button class="can-icon-tool-btn" type="button" title="新增 CAN BUS" data-tip="新增 CAN BUS" @click="addBus()">
                <span aria-hidden="true">◉</span>
              </button>
            </template>
            <button class="can-icon-tool-btn" type="button" title="撤销" data-tip="撤销" :disabled="!canUndo" @click="undoNodes">
              <span aria-hidden="true">↶</span>
            </button>
            <button class="can-icon-tool-btn" type="button" title="重做" data-tip="重做" :disabled="!canRedo" @click="redoNodes">
              <span aria-hidden="true">↷</span>
            </button>
            <button class="can-icon-tool-btn" type="button" :title="isFullscreen ? '退出全屏 (Esc)' : '全屏查看 (Ctrl+Shift+F)'" :data-tip="isFullscreen ? '退出全屏 (Esc)' : '全屏查看 (Ctrl+Shift+F)'" @click="toggleFullscreen">
              <span aria-hidden="true">⛶</span>
            </button>
            <button class="can-icon-tool-btn danger" type="button" title="删除选中" data-tip="删除选中" :disabled="!hasAnySelectionForDelete" @click="deleteSelected">
              <span aria-hidden="true">🗑</span>
            </button>
          </div>

          <input
            ref="importInputRef"
            hidden
            type="file"
            accept=".dbc,text/plain"
            @change="handleDbcFileChosen"
          >
          <input
            ref="configImportInputRef"
            hidden
            type="file"
            accept=".json,application/json,text/plain"
            @change="handleConfigFileChosen"
          >
        </div>
        <span class="magnetic-grip" aria-hidden="true"></span>
      </div>

      <div class="can-arch-layout" :class="{ 'editor-active': ecuMessageEditor.active }">
        <div class="can-arch-canvas-card" :style="ecuMessageEditor.active ? { height: `${editorPanelHeight}px`, minHeight: '480px' } : {}">
          <div v-if="!ecuMessageEditor.active" class="can-arch-canvas-head">
            <strong>CAN 拓扑画布</strong>
            <div class="can-arch-head-actions">
              <span class="can-arch-meta">ECU {{ nodes.length }} 个 / BUS {{ buses.length }} 个 / 连线 {{ links.length }} 条</span>
              <button
                v-if="isSideCollapsed"
                class="btn btn-outline-secondary btn-sm can-side-toggle-btn"
                type="button"
                title="显示属性面板"
                @click="showSideCard"
              >
                ▶
              </button>
            </div>
          </div>

          <div
            v-if="!ecuMessageEditor.active"
            ref="canvasRef"
            class="can-arch-canvas"
            :class="{ 'is-panning': isCanvasPanning }"
            :style="{ height: `${canvasHeight}px` }"
            @pointerdown="onCanvasPointerDown"
            @pointerup="onCanvasPointerUp"
            @pointercancel="onCanvasPointerCancel"
            @lostpointercapture="onCanvasLostPointerCapture"
            @wheel="onCanvasWheel"
            @contextmenu.prevent="openCanvasContextMenu"
          >
            <div
              class="can-arch-scene-viewport"
              :style="{
                width: `${sceneViewportSize.width}px`,
                height: `${sceneViewportSize.height}px`,
              }"
            >
              <div
                class="can-arch-scene"
                :style="{
                  width: `${sceneSize.width}px`,
                  height: `${sceneSize.height}px`,
                  transform: `scale(${canvasZoom})`,
                }"
              >
                <svg class="can-link-layer" :width="sceneSize.width" :height="sceneSize.height" aria-hidden="true">
                  <g v-for="link in resolvedLinks" :key="link.id" class="can-link-item">
                    <path
                      v-if="selectedLinkId === link.id"
                      class="can-link-path-focus"
                      :d="link.path"
                      stroke="#ff8c4a"
                      stroke-width="9"
                      stroke-linejoin="round"
                      fill="none"
                    />
                    <path
                      class="can-link-path"
                      :class="{ selected: selectedLinkId === link.id }"
                      :d="link.path"
                      :stroke="link.color"
                      :stroke-linejoin="link.style === 'rounded' ? 'round' : 'miter'"
                      stroke-width="3"
                      stroke-dasharray="none"
                      fill="none"
                      @pointerdown.stop.prevent="onLinkPointerDown(link, $event)"
                      @dblclick.stop.prevent="onLinkDoubleClick(link, $event)"
                      @contextmenu.stop.prevent="onLinkContextMenu(link, $event)"
                    />
                    <path
                      class="can-link-hit"
                      :data-link-id="link.id"
                      :d="link.path"
                      stroke="rgba(0,0,0,0)"
                      stroke-width="14"
                      fill="none"
                      @pointerdown.stop.prevent="onLinkPointerDown(link, $event)"
                      @dblclick.stop.prevent="onLinkDoubleClick(link, $event)"
                      @contextmenu.stop.prevent="onLinkContextMenu(link, $event)"
                    />
                    <circle
                      v-for="(anchor, idx) in link.anchors"
                      :key="`${link.id}-a-${idx}`"
                      class="can-link-anchor"
                      :data-link-id="link.id"
                      :data-anchor-index="idx"
                      :class="{ selected: selectedLinkId === link.id }"
                      :cx="anchor.x"
                      :cy="anchor.y"
                      r="4"
                      @pointerdown.stop.prevent="onLinkAnchorPointerDown(link, idx, $event)"
                      @contextmenu.stop.prevent="onLinkAnchorContextMenu(link, idx, $event)"
                    />
                  </g>
                  <path
                    v-if="linkDraft"
                    class="can-link-draft"
                    :d="linkDraft.path"
                    stroke="#1d5fa3"
                    stroke-width="3.5"
                    stroke-dasharray="10 6"
                    stroke-linecap="round"
                    fill="none"
                  ></path>
                  <circle v-if="linkDraft" class="can-link-draft-tip" :cx="linkDraft.current.x" :cy="linkDraft.current.y" r="5"></circle>
                </svg>

                <div
                  v-for="node in nodes"
                  :key="node.id"
                  class="can-node-item"
                  :data-node-id="node.id"
                  :class="nodeCardClasses(node)"
                  :style="nodeCardStyle(node)"
                  @pointerdown="onNodePointerDown(node, $event)"
                  @dblclick.stop.prevent="openEcuMessageEditor(node)"
                  @pointermove="onNodePointerMove($event)"
                  @pointerleave="onNodePointerLeave(node, $event)"
                  @pointerup="onNodePointerUp(node, $event)"
                  @pointercancel="onNodePointerCancel($event)"
                  @lostpointercapture="onNodeLostPointerCapture($event)"
                  @contextmenu.prevent.stop="onNodeContextMenu(node, $event)"
                >
                  <div class="can-node-title-row">
                    <strong class="can-node-title">{{ node.name }}</strong>
                  </div>

                  <span
                    v-for="dot in nodeLinkDots(node)"
                    :key="dot.key"
                    class="can-node-link-dot"
                    :style="{ left: `${dot.left}px`, top: `${dot.top}px` }"
                  ></span>

                  <div class="can-node-protocol-groups">
                    <div
                      v-for="group in nodeProtocolGroups(node)"
                      :key="group.key"
                      class="can-protocol-group"
                      :class="group.rowClass"
                    >
                      <span class="can-pill" :class="group.badgeClass">{{ group.label }}</span>
                      <span v-if="group.showAddress !== false" class="can-protocol-addr" :class="{ 'is-empty': !group.addressText }">
                        {{ group.addressText || '未配置地址' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  v-for="bus in buses"
                  :key="bus.id"
                  class="can-bus-item"
                  :data-bus-id="bus.id"
                  :class="busCardClasses(bus)"
                  :style="busCardStyle(bus)"
                  @pointerdown="onBusPointerDown(bus, $event)"
                  @pointermove="onBusPointerMove($event, bus)"
                  @pointerleave="onBusPointerLeave(bus)"
                  @pointerup="onBusPointerUp(bus, $event)"
                  @pointercancel="onBusPointerCancel($event)"
                  @lostpointercapture="onBusLostPointerCapture($event)"
                  @contextmenu.prevent.stop="onBusContextMenu(bus, $event)"
                >
                  <span class="can-bus-name">{{ bus.name }}</span>
                  <span class="can-bus-baud">{{ bus.baudRate || DEFAULT_BUS_BAUD }}k</span>
                </div>

                <div
                  v-if="selectionRect"
                  class="can-selection-rect"
                  :style="{
                    left: `${selectionRect.left}px`,
                    top: `${selectionRect.top}px`,
                    width: `${selectionRect.width}px`,
                    height: `${selectionRect.height}px`,
                  }"
                ></div>

                <div v-if="nodes.length === 0 && buses.length === 0" class="can-arch-empty">
                  还没有 ECU 或 CAN BUS，点击工具栏开始搭建。
                </div>
              </div>
            </div>
          </div>
          <EcuMessageEditor
            v-if="ecuMessageEditor.active"
            ref="ecuMessageEditorRef"
            :ecu="ecuMessageEditor.ecu"
            :bus-tabs="ecuMessageEditorBusTabs"
            :height="editorPanelHeight"
            :ecu-nodes="nodes"
            @close="closeEcuMessageEditor"
            @switch-ecu="switchEcuInEditor"
          />
          <aside v-if="!ecuMessageEditor.active && !isSideCollapsed" class="can-arch-side-card can-arch-side-card-floating">
            <div class="can-arch-canvas-head">
              <strong>{{ sidePanelTitle }}</strong>
              <button
                class="btn btn-outline-secondary btn-sm can-side-toggle-btn"
                type="button"
                title="隐藏属性面板"
                @click="hideSideCard"
              >
                ◀
              </button>
            </div>

            <div v-if="singleSelectedLink" class="can-node-form">
              <div class="mb-2">
                <div class="form-label mb-1">起点</div>
                <div class="can-side-hint p-0">{{ describeLinkEndpoint(singleSelectedLink.fromType, singleSelectedLink.fromId) }}</div>
              </div>
              <div class="mb-2">
                <div class="form-label mb-1">终点</div>
                <div class="can-side-hint p-0">{{ describeLinkEndpoint(singleSelectedLink.toType, singleSelectedLink.toId) }}</div>
              </div>

              <label class="form-label mb-1" for="can-link-style">线型</label>
              <select id="can-link-style" v-model="linkEditor.style" class="form-select form-select-sm">
                <option value="polyline">折线（可加锚点）</option>
                <option value="curve">曲线</option>
                <option value="rounded">圆角折线</option>
                <option value="orthogonal">直角折线</option>
              </select>

              <div class="mt-2">
                <div class="form-label mb-1">应用协议</div>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="linkEditor.protocols.includes(canProtocols.GENERIC_STD)"
                    :disabled="!canLinkUseProtocol(canProtocols.GENERIC_STD) && !linkEditor.protocols.includes(canProtocols.GENERIC_STD)"
                    @change="toggleLinkEditorProtocol(canProtocols.GENERIC_STD, $event.target.checked)"
                  >
                  Generic 标准帧
                </label>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="linkEditor.protocols.includes(canProtocols.GENERIC_EXT)"
                    :disabled="!canLinkUseProtocol(canProtocols.GENERIC_EXT) && !linkEditor.protocols.includes(canProtocols.GENERIC_EXT)"
                    @change="toggleLinkEditorProtocol(canProtocols.GENERIC_EXT, $event.target.checked)"
                  >
                  Generic 扩展帧
                </label>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="linkEditor.protocols.includes(canProtocols.J1939)"
                    :disabled="!canLinkUseProtocol(canProtocols.J1939) && !linkEditor.protocols.includes(canProtocols.J1939)"
                    @change="toggleLinkEditorProtocol(canProtocols.J1939, $event.target.checked)"
                  >
                  J1939
                </label>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="linkEditor.protocols.includes(canProtocols.CANOPEN)"
                    :disabled="!canLinkUseProtocol(canProtocols.CANOPEN) && !linkEditor.protocols.includes(canProtocols.CANOPEN)"
                    @change="toggleLinkEditorProtocol(canProtocols.CANOPEN, $event.target.checked)"
                  >
                  CANopen
                </label>
                <div class="can-side-hint p-0 mt-1">
                  连线协议仅可选择该 ECU 已启用的协议。
                </div>
              </div>

              <div class="mt-2" v-if="linkEditor.protocols.includes(canProtocols.J1939)">
                <label class="form-label mb-1" for="can-link-j1939">J1939 NmStationAddress（多个用逗号分隔）</label>
                <input
                  id="can-link-j1939"
                  v-model="linkEditor.j1939AddressesInput"
                  class="form-control form-control-sm"
                  type="text"
                  :disabled="resolveLinkAllowedJ1939Addresses(singleSelectedLink).length === 0"
                  :placeholder="`可用: ${resolveLinkAllowedJ1939Addresses(singleSelectedLink).join(', ') || '无'}`"
                >
              </div>

              <div class="mt-2" v-if="linkEditor.protocols.includes(canProtocols.CANOPEN)">
                <label class="form-label mb-1" for="can-link-canopen">CANopen 节点号（多个用逗号分隔）</label>
                <input
                  id="can-link-canopen"
                  v-model="linkEditor.canopenNodeIdsInput"
                  class="form-control form-control-sm"
                  type="text"
                  :disabled="resolveLinkAllowedCanopenNodeIds(singleSelectedLink).length === 0"
                  :placeholder="`可用: ${resolveLinkAllowedCanopenNodeIds(singleSelectedLink).join(', ') || '无'}`"
                >
              </div>

              <div class="d-flex gap-2 mt-3 align-items-center">
                <button class="btn btn-outline-secondary btn-sm" type="button" @click="addAnchorToSelectedLink">添加锚点</button>
                <button class="btn btn-outline-danger btn-sm" type="button" @click="deleteSelectedLink">删除连线</button>
              </div>
            </div>

            <div v-else-if="singleSelectedBus" class="can-node-form">
              <label class="form-label mb-1" for="can-bus-name">BUS 名称</label>
              <input id="can-bus-name" v-model="busDraft.name" class="form-control form-control-sm" maxlength="32" type="text">

              <label class="form-label mb-1 mt-2" for="can-bus-baud">波特率（kbps）</label>
              <input id="can-bus-baud" v-model="busDraft.baudRate" class="form-control form-control-sm" type="number" min="10" max="10000" step="10">

              <label class="form-label mb-1 mt-2" for="can-bus-color">总线颜色</label>
              <input id="can-bus-color" v-model="busDraft.color" class="form-control form-control-color form-control-sm" type="color">

              <div class="mt-2">
                <div class="form-label mb-1">当前总线协议（自动识别）</div>
                <div v-if="busProtocolsForSelected.length === 0" class="can-side-hint p-0">暂无连接连线协议</div>
                <div v-else class="can-node-protocol-groups">
                  <div v-for="proto in busProtocolsForSelected" :key="proto" class="can-protocol-group" :class="protocolRowClass(proto)">
                    <span class="can-pill" :class="protocolBadgeClass(proto)">{{ protocolLabel(proto) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="singleSelectedNode" class="can-node-form">
              <label class="form-label mb-1" for="can-node-name">ECU 名称</label>
              <input id="can-node-name" v-model="draft.name" class="form-control form-control-sm" maxlength="40" type="text">

              <label class="form-label mb-1 mt-2" for="can-node-note">备注</label>
              <textarea id="can-node-note" v-model="draft.note" class="form-control form-control-sm" rows="2"></textarea>

              <div class="mt-2">
                <div class="form-label mb-1">协议</div>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="draft.protocols.includes(canProtocols.GENERIC_STD)"
                    @change="toggleDraftProtocol(canProtocols.GENERIC_STD, $event.target.checked)"
                  >
                  Generic 标准帧
                </label>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="draft.protocols.includes(canProtocols.GENERIC_EXT)"
                    @change="toggleDraftProtocol(canProtocols.GENERIC_EXT, $event.target.checked)"
                  >
                  Generic 扩展帧
                </label>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="draft.protocols.includes(canProtocols.J1939)"
                    @change="toggleDraftProtocol(canProtocols.J1939, $event.target.checked)"
                  >
                  J1939
                </label>
                <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :checked="draft.protocols.includes(canProtocols.CANOPEN)"
                    @change="toggleDraftProtocol(canProtocols.CANOPEN, $event.target.checked)"
                  >
                  CANopen
                </label>
              </div>

              <div class="mt-2" v-if="draft.protocols.includes(canProtocols.J1939)">
                <label class="form-label mb-1" for="can-node-j1939">J1939 NmStationAddress（多个用逗号分隔）</label>
                <input id="can-node-j1939" v-model="draft.j1939AddressesInput" class="form-control form-control-sm" type="text" placeholder="如: 19, 130">
              </div>

              <div class="mt-2" v-if="draft.protocols.includes(canProtocols.CANOPEN)">
                <label class="form-label mb-1" for="can-node-canopen">CANopen 节点号（多个用逗号分隔）</label>
                <input id="can-node-canopen" v-model="draft.canopenNodeIdsInput" class="form-control form-control-sm" type="text" placeholder="如: 1, 2, 127">
              </div>

              <div class="mt-2">
                <label class="form-label mb-1" for="can-node-base-color">ECU 颜色基底</label>
                <div class="can-base-color-row">
                  <input id="can-node-base-color" v-model="draft.baseColor" class="form-control form-control-color form-control-sm" type="color">
                  <input v-model="draft.baseColor" class="form-control form-control-sm" type="text" maxlength="7" placeholder="#D85F3F">
                </div>
              </div>

              <div v-if="formErrors.length > 0" class="can-form-error mt-2">
                <div v-for="err in formErrors" :key="err">{{ err }}</div>
              </div>
              <div v-if="formWarnings.length > 0" class="can-form-warning mt-2">
                <div v-for="warn in formWarnings" :key="warn">{{ warn }}</div>
              </div>

              <div class="d-flex gap-2 mt-3 align-items-center">
                <button class="btn btn-outline-secondary btn-sm" type="button" @click="resetDraft">重置</button>
              </div>
            </div>

            <div v-else-if="selectedIds.length > 1" class="can-side-hint">
              已选中 {{ selectedIds.length }} 个 ECU。可执行批量导出或删除。单选 ECU 可编辑属性。
            </div>

            <div v-else class="can-side-hint">
              请先在画布中选中一个 ECU。
            </div>
          </aside>

          <div class="can-arch-status can-arch-status-floating" :class="{ error: Boolean(statusError) }">
            {{ floatingStatusText }}
          </div>

          <div
            class="can-arch-height-resizer"
            title="拖拽调整画布高度"
            @pointerdown.stop.prevent="onCanvasResizePointerDown"
          ></div>
        </div>
      </div>

      <div v-if="!isFullscreen" class="can-arch-helper-panel">
        <div class="can-arch-canvas-head">
          <strong>J1939 PGN/ID 辅助工具</strong>
        </div>
        <J1939Feature :active="true" />
      </div>
    </div>

    <div v-if="importModalOpen" class="can-import-modal" @click.self="closeImportModal">
      <div class="can-import-card" role="dialog" aria-modal="true" aria-label="DBC 节点导入向导" @keydown.capture="handleImportModalKeydown">
        <div class="can-import-head">
          <strong>DBC 节点导入向导</strong>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="closeImportModal">关闭</button>
        </div>
        <div v-if="importStage === 'choose'" class="can-import-chooser">
          <div class="can-import-dropzone" @click="openImportPicker" @dragover.prevent @drop.prevent="handleImportDrop">
            <strong>拖放 DBC 文件到这里，或点击下方按钮选择文件</strong>
            <p>解析后会显示识别到的 ECU 列表，并允许你逐项勾选导入。</p>
          </div>
          <div class="d-flex gap-2 mt-3 justify-content-end">
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="closeImportModal">取消</button>
            <button class="btn btn-primary btn-sm" type="button" @click="openImportPicker">选择 DBC 文件</button>
          </div>
        </div>

        <div v-else>
          <p class="can-import-note">
            识别到 {{ importCandidates.length }} 个 ECU，当前已选择 {{ importSelectedCount }} 个。
          </p>

          <div class="mb-3 can-import-target-row">
            <div>
              <div class="form-label mb-1">导入目标</div>
              <select v-model="importTarget.connectionMode" class="form-select form-select-sm">
                <option value="existing" :disabled="buses.length === 0">连接到已有 CAN BUS</option>
                <option value="new">新建 CAN BUS</option>
              </select>
            </div>
            <div>
              <div class="form-label mb-1">目标配置</div>
              <select
                v-if="importTarget.connectionMode === 'existing'"
                v-model="importTarget.busId"
                class="form-select form-select-sm"
                :disabled="buses.length === 0"
              >
                <option v-for="bus in buses" :key="bus.id" :value="bus.id">{{ bus.name }}</option>
              </select>
              <input
                v-else
                v-model="importTarget.newBusName"
                class="form-control form-control-sm"
                type="text"
                maxlength="32"
                placeholder="例如：CAN_IMPORT"
              >
            </div>
          </div>

          <div class="d-flex align-items-center gap-2 mb-2">
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="selectAllImportCandidates">全选（Alt+A）</button>
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="clearAllImportCandidates">取消全选（Alt+Q）</button>
          </div>

          <div class="can-import-list">
            <div class="can-import-group">
              <button class="can-import-group-head" type="button" @click="toggleImportCandidateGroup('new')">
                <span>{{ importReviewState.newExpanded ? '▾' : '▸' }} 新增 ECU（{{ newImportCandidates.length }}）</span>
              </button>
              <div v-if="importReviewState.newExpanded">
                <div class="can-import-row can-import-row-head">
                  <span>导入</span>
                  <span>ECU 名称</span>
                  <span>协议</span>
                  <span>地址/节点号</span>
                  <span>处理方式</span>
                </div>
                <div
                  v-for="candidate in newImportCandidates"
                  :key="candidate.id"
                  class="can-import-row"
                >
                  <span>
                    <input v-model="candidate.selected" class="form-check-input" type="checkbox">
                  </span>
                  <span>{{ candidate.name }}</span>
                  <span>
                    <span v-if="candidate.protocols.length === 0" class="can-pill can-pill-neutral">Generic</span>
                    <span v-for="protocol in candidate.protocols" :key="protocol" class="can-pill" :class="protocolBadgeClass(protocol)">
                      {{ protocolLabel(protocol) }}
                    </span>
                  </span>
                  <span>
                    <span v-if="candidate.j1939Addresses.length > 0">J1939: {{ candidate.j1939Addresses.join(', ') }}</span>
                    <span v-if="candidate.canopenNodeIds.length > 0" class="d-block">CANopen: {{ candidate.canopenNodeIds.join(', ') }}</span>
                    <span v-if="candidate.j1939Addresses.length === 0 && candidate.canopenNodeIds.length === 0">-</span>
                  </span>
                  <span>
                    <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                      <input
                        :checked="candidate.resolveMode === 'create'"
                        class="form-check-input"
                        type="radio"
                        :name="`resolve-${candidate.id}`"
                        @change="setImportCandidateResolveMode(candidate, 'create')"
                      >
                      新增 ECU
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                      <input
                        :checked="candidate.resolveMode === 'merge'"
                        class="form-check-input"
                        type="radio"
                        :name="`resolve-${candidate.id}`"
                        @change="setImportCandidateResolveMode(candidate, 'merge')"
                        :disabled="existingNodeNameOptions.length === 0"
                      >
                      归并到已有 ECU
                    </label>
                    <select
                      v-if="candidate.resolveMode === 'merge'"
                      v-model="candidate.mergeNodeName"
                      class="form-select form-select-sm"
                      :disabled="existingNodeNameOptions.length === 0"
                    >
                      <option v-for="name in existingNodeNameOptions" :key="`existing-new-${candidate.id}-${name}`" :value="name">{{ name }}</option>
                    </select>
                  </span>
                </div>
              </div>
            </div>

            <div class="can-import-group mt-2">
              <button class="can-import-group-head" type="button" @click="toggleImportCandidateGroup('conflict')">
                <span>{{ importReviewState.conflictExpanded ? '▾' : '▸' }} 同名 ECU（{{ conflictImportCandidates.length }}）</span>
              </button>
              <div v-if="importReviewState.conflictExpanded">
                <div v-if="conflictImportCandidates.length > 0" class="can-form-warning px-2 py-1">
                  下面 ECU 名称已存在，可选择“同名合并（并集）”或“重命名新建”。
                </div>
                <div class="can-import-row can-import-row-head">
                  <span>导入</span>
                  <span>ECU 名称</span>
                  <span>协议</span>
                  <span>地址/节点号</span>
                  <span>冲突处理</span>
                </div>
                <div
                  v-for="candidate in conflictImportCandidates"
                  :key="candidate.id"
                  class="can-import-row"
                >
                  <span>
                    <input v-model="candidate.selected" class="form-check-input" type="checkbox">
                  </span>
                  <span>{{ candidate.name }}</span>
                  <span>
                    <span v-if="candidate.protocols.length === 0" class="can-pill can-pill-neutral">Generic</span>
                    <span v-for="protocol in candidate.protocols" :key="protocol" class="can-pill" :class="protocolBadgeClass(protocol)">
                      {{ protocolLabel(protocol) }}
                    </span>
                  </span>
                  <span>
                    <span v-if="candidate.j1939Addresses.length > 0">J1939: {{ candidate.j1939Addresses.join(', ') }}</span>
                    <span v-if="candidate.canopenNodeIds.length > 0" class="d-block">CANopen: {{ candidate.canopenNodeIds.join(', ') }}</span>
                    <span v-if="candidate.j1939Addresses.length === 0 && candidate.canopenNodeIds.length === 0">-</span>
                  </span>
                  <span>
                    <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                      <input
                        :checked="candidate.resolveMode === 'merge'"
                        class="form-check-input"
                        type="radio"
                        :name="`resolve-${candidate.id}`"
                        @change="setImportCandidateResolveMode(candidate, 'merge')"
                      >
                      同名合并（并集）
                    </label>
                    <label class="form-check-label d-flex align-items-center gap-2 mb-1">
                      <input
                        :checked="candidate.resolveMode === 'create'"
                        class="form-check-input"
                        type="radio"
                        :name="`resolve-${candidate.id}`"
                        @change="setImportCandidateResolveMode(candidate, 'create')"
                      >
                      重命名新建
                    </label>
                    <input
                      v-if="candidate.resolveMode === 'create'"
                      v-model="candidate.rename"
                      class="form-control form-control-sm"
                      type="text"
                      maxlength="40"
                      placeholder="重命名后导入"
                    >
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="d-flex gap-2 mt-3 justify-content-end">
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="closeImportModal">取消</button>
            <button class="btn btn-primary btn-sm" type="button" @click="confirmImportCandidates">确认导入</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="dbcExportModalOpen" class="can-import-modal can-export-modal" @click.self="closeDbcExportModal">
      <div class="can-import-card can-export-card" role="dialog" aria-modal="true" aria-label="DBC 导出选项">
        <div class="can-import-head can-export-head">
          <strong>DBC 导出选项</strong>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="closeDbcExportModal">关闭</button>
        </div>

        <p class="can-import-note can-export-note">
          <template v-if="pendingDbcExport.busGroups.length > 1">
            当前选中关联多个 CAN BUS。请勾选要导出的 CAN BUS，系统会按每个 CAN BUS 分别生成 DBC。
          </template>
          <template v-else-if="pendingDbcExport.busGroups.length === 1">
            当前选中关联 1 个 CAN BUS。请按该 BUS 的协议类型确认导出策略。
          </template>
          <template v-else>
            当前选中同时包含 J1939 与其他协议。请选择要导出的 DBC 组。
          </template>
        </p>

        <div v-if="pendingDbcExport.busGroups.length > 0" class="can-export-option-list mb-2">
          <div class="form-label mb-1">选择需要导出的 CAN BUS</div>
          <div
            v-for="group in pendingDbcExport.busGroups"
            :key="`export-bus-${group.busId}`"
            class="can-export-bus-block mb-2"
          >
            <label class="form-check-label d-flex align-items-center gap-2 mb-1 can-export-option-item">
              <input
                class="form-check-input can-export-check"
                type="checkbox"
                :checked="group.selected"
                @change="toggleDbcExportBusSelection(group.busId, $event.target.checked)"
              >
              {{ group.busName }}（ECU {{ group.nodeCount }}）
            </label>

            <div v-if="group.selected" class="can-export-bus-protocols ps-4">
              <label v-if="group.requiresProtocolSelection" class="form-check-label d-flex align-items-center gap-2 mb-1 can-export-option-item">
                <input
                  class="form-check-input can-export-check"
                  type="checkbox"
                  :checked="group.includeOthers"
                  @change="toggleDbcExportGroupProtocol(group.busId, 'others', $event.target.checked)"
                >
                导出其他协议（{{ group.otherCount }} 个 ECU）
              </label>

              <div v-if="group.requiresProtocolSelection" class="d-flex align-items-center gap-2 mb-1">
                <label class="form-check-label d-flex align-items-center gap-2 mb-0 can-export-option-item">
                  <input
                    class="form-check-input can-export-check"
                    type="checkbox"
                    :checked="group.includeJ1939"
                    @change="toggleDbcExportGroupProtocol(group.busId, 'j1939', $event.target.checked)"
                  >
                  导出 J1939（{{ group.j1939Count }} 个 ECU）
                </label>
                <select
                  v-if="group.includeJ1939"
                  class="form-select form-select-sm can-export-j1939-select"
                  :value="group.j1939Mode"
                  @change="updateDbcExportGroupJ1939Mode(group.busId, $event.target.value)"
                >
                  <option value="dedicated">J1939 专用</option>
                  <option value="downgrade">退化合并</option>
                </select>
              </div>

              <div v-else-if="group.hasJ1939" class="d-flex align-items-center gap-2 mb-1">
                <span class="can-side-hint p-0">仅包含 J1939，导出方式：</span>
                <select
                  class="form-select form-select-sm can-export-j1939-select"
                  :value="group.j1939Mode"
                  @change="updateDbcExportGroupJ1939Mode(group.busId, $event.target.value)"
                >
                  <option value="dedicated">J1939 专用</option>
                  <option value="downgrade">退化合并</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="can-export-option-list">
          <label class="form-check-label d-flex align-items-center gap-2 mb-2 can-export-option-item">
            <input v-if="pendingDbcExport.j1939Count > 0" v-model="dbcExportSelection.includeJ1939" class="form-check-input can-export-check" type="checkbox">
            导出 J1939 DBC（{{ pendingDbcExport.j1939Count }} 个 ECU）
          </label>
          <label class="form-check-label d-flex align-items-center gap-2 mb-2 can-export-option-item">
            <input v-if="pendingDbcExport.otherCount > 0" v-model="dbcExportSelection.includeOthers" class="form-check-input can-export-check" type="checkbox">
            导出其他协议 DBC（{{ pendingDbcExport.otherCount }} 个 ECU）
          </label>
        </div>

        <div class="d-flex gap-2 mt-3 justify-content-end">
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="closeDbcExportModal">取消</button>
          <button class="btn btn-primary btn-sm" type="button" :disabled="!canConfirmDbcExport" @click="confirmDbcExportSelection">确认导出</button>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenu.open"
      class="can-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button v-if="contextMenu.target === 'canvas'" class="can-context-menu-item" type="button" @click="addNodeAtContextMenu">
        在此新增 ECU
      </button>
      <button v-if="contextMenu.target === 'canvas'" class="can-context-menu-item" type="button" @click="addBusAtContextMenu">
        在此新增 CAN BUS
      </button>
      <button v-if="contextMenu.target === 'canvas'" class="can-context-menu-item" type="button" @click="pasteAtContextMenu">
        粘贴
      </button>
      <button v-if="contextMenu.target === 'node' || contextMenu.target === 'bus'" class="can-context-menu-item" type="button" @click="copyCurrentSelection">
        复制
      </button>
      <button
        v-if="(contextMenu.target === 'node' || contextMenu.target === 'bus' || contextMenu.target === 'link' || (contextMenu.target === 'canvas' && hasAnySelectionForExport)) && hasAnySelectionForExport"
        class="can-context-menu-item"
        type="button"
        @click="exportSelectedNodesFromContextMenu"
      >
        导出选中 DBC
      </button>
      <button v-if="contextMenu.target === 'link' && canAddAnchorInContextMenu" class="can-context-menu-item" type="button" @click="addAnchorAtContextMenu">
        添加锚点
      </button>
      <button v-if="contextMenu.target === 'link'" class="can-context-menu-item danger" type="button" @click="deleteSelectedLink">
        删除连线
      </button>
      <button v-if="contextMenu.target === 'anchor'" class="can-context-menu-item danger" type="button" @click="deleteAnchorAtContextMenu">
        删除锚点
      </button>
      <button v-if="contextMenu.target === 'node'" class="can-context-menu-item" type="button" @click="deleteSelectedNodes">
        删除 ECU
      </button>
      <button v-if="contextMenu.target === 'bus'" class="can-context-menu-item" type="button" @click="deleteSelectedBus">
        删除 CAN BUS
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { J1939Feature } from '@/features/j1939';
import { useJ1939ModuleInit } from '@/app/composables/useJ1939ModuleInit.js';
import { useBusSelection } from '@/features/can-arch/app/composables/useBusSelection.js';
import { useBoxSelection } from '@/features/can-arch/app/composables/useBoxSelection.js';
import { useCanvasPan } from '@/features/can-arch/app/composables/useCanvasPan.js';
import { useDbcExportSelection } from '@/features/can-arch/app/composables/useDbcExportSelection.js';
import { useImportReview } from '@/features/can-arch/app/composables/useImportReview.js';
import EcuMessageEditor from '@/features/can-arch/ui/components/EcuMessageEditor.vue';
import {
  canProtocols,
  parseDbcNodes,
  serializeNodesToDbc,
  validateCanNodeDraft,
} from '@/features/can-arch/services/can-arch-dbc.js';
import {
  AUTO_SAVE_INTERVAL_MS,
  BUS_COLOR_POOL,
  BUS_RADIUS,
  CONFIG_SCHEMA,
  CONFIG_VERSION,
  DEFAULT_BUS_BAUD,
  DEFAULT_NODE_BASE_COLOR,
  HISTORY_LIMIT,
  LINK_STYLE_OPTIONS,
  NODE_EDGE_LINK_HIT_THRESHOLD,
  NODE_HEIGHT,
  NODE_WIDTH,
  STORAGE_KEY,
} from '@/features/can-arch/domain/can-arch-constants.js';
import {
  buildLinkGeometryPath as geometryBuildLinkGeometryPath,
  buildOrthogonalPoints as geometryBuildOrthogonalPoints,
  buildPolylinePath as geometryBuildPolylinePath,
  buildRoundedOrthogonalPath as geometryBuildRoundedOrthogonalPath,
  distancePointToSegment as geometryDistancePointToSegment,
  intersectsBus as geometryIntersectsBus,
  intersectsNode as geometryIntersectsNode,
  rectFromPoints as geometryRectFromPoints,
  resolveBusAnchorFromDirection as geometryResolveBusAnchorFromDirection,
  resolveModuleAnchorPoint as geometryResolveModuleAnchorPoint,
  resolveNodeAnchorByEdge as geometryResolveNodeAnchorByEdge,
  resolveNodeAnchorFromDirection as geometryResolveNodeAnchorFromDirection,
  resolveNodeEdgeAnchorFromPointer as geometryResolveNodeEdgeAnchorFromPointer,
} from '@/features/can-arch/domain/can-arch-geometry.js';
import {
  addAnchorToLink as domainAddAnchorToLink,
  ensureControlAnchorsForLink as domainEnsureControlAnchorsForLink,
  findBusByPoint as domainFindBusByPoint,
  findNodeByPoint as domainFindNodeByPoint,
  nodeLinkDots as domainNodeLinkDots,
  resolveLinkEndpointsForGeometry as domainResolveLinkEndpointsForGeometry,
} from '@/features/can-arch/domain/can-arch-link-geometry.js';
import {
  normalizeIntegerList as domainNormalizeIntegerList,
  normalizeLinkStyle as domainNormalizeLinkStyle,
  normalizeProtocolsList as domainNormalizeProtocolsList,
} from '@/features/can-arch/domain/can-arch-normalizers.js';
import {
  parseHexColor,
  normalizeNodeBaseColor,
  mixWithWhite,
  mixWithBlack,
  buildNodeCardStyle,
  buildBusCardStyle,
} from '@/features/can-arch/domain/can-arch-colors.js';
import {
  nodeProtocolGroups as domainNodeProtocolGroups,
  resolveNodeDefaultProtocols as domainResolveNodeDefaultProtocols,
  resolveNodeDefaultJ1939Addresses as domainResolveNodeDefaultJ1939Addresses,
  resolveNodeDefaultCanopenNodeIds as domainResolveNodeDefaultCanopenNodeIds,
  resolveLinkAllowedProtocols as domainResolveLinkAllowedProtocols,
  resolveLinkAllowedJ1939Addresses as domainResolveLinkAllowedJ1939Addresses,
  resolveLinkAllowedCanopenNodeIds as domainResolveLinkAllowedCanopenNodeIds,
  normalizeLinkProtocolsByNode as domainNormalizeLinkProtocolsByNode,
  normalizeLinkJ1939AddressesByNode as domainNormalizeLinkJ1939AddressesByNode,
  normalizeLinkCanopenNodeIdsByNode as domainNormalizeLinkCanopenNodeIdsByNode,
  pruneNodeConnectedLinkCapabilities as domainPruneNodeConnectedLinkCapabilities,
} from '@/features/can-arch/domain/can-arch-protocols.js';
import {
  createNodeName,
  createBusName,
  ensureUniqueLabel,
} from '@/features/can-arch/domain/can-arch-naming.js';
import {
  buildDbcBusGroups,
  buildNodeProjections,
  splitExportNodesByProtocol,
  executeDbcExport as executeDbcExportCore,
} from '@/features/can-arch/services/can-arch-dbc-export.js';
import {
  downloadTextFile,
  downloadBlobFile,
  buildArchitectureSvg,
  exportArchitecturePng as serviceExportArchitecturePng,
  buildTimestampTag,
} from '@/features/can-arch/services/can-arch-export.js';
import {
  cloneNodesSnapshot,
  cloneBusesSnapshot,
  cloneLinksSnapshot,
  buildTopologySnapshot as cloneTopologySnapshot,
  hydrateNodes,
  hydrateBuses,
  hydrateLinks,
  extractTopologyFromConfigPayload,
} from '@/features/can-arch/domain/can-arch-topology.js';
import { escapeXml } from '@/features/can-arch/domain/can-arch-xml.js';
import { useMagneticHeader } from '@/features/can-arch/app/composables/useMagneticHeader.js';
import { useNodeOperations } from '@/features/can-arch/app/composables/useNodeOperations.js';

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const SUPPORTED_CAN_PROTOCOLS = [
  canProtocols.GENERIC_STD,
  canProtocols.GENERIC_EXT,
  canProtocols.J1939,
  canProtocols.CANOPEN,
];

const nodes = ref([]);
const buses = ref([]);
const links = ref([]);
const selectedIds = ref([]);
const selectedBusIds = ref([]);
const selectedBusId = ref('');
const selectedLinkId = ref('');
const selectedIdSet = computed(() => new Set(selectedIds.value));
const canvasRef = ref(null);
const ecuMessageEditorRef = ref(null);
const importInputRef = ref(null);
const configImportInputRef = ref(null);

const importModalOpen = ref(false);
const importStage = ref('choose');
const importCandidates = ref([]);
const importTarget = reactive({
  connectionMode: 'existing',
  busId: '',
  newBusName: '',
});
const importReviewState = reactive({
  newExpanded: true,
  conflictExpanded: true,
});
const statusMessage = ref('准备就绪。');
const statusError = ref('');
const historyPast = ref([]);
const historyFuture = ref([]);
const historySuspend = ref(false);
const contextMenu = ref({
  open: false,
  x: 0,
  y: 0,
  target: 'canvas',
  nodeId: null,
  linkId: null,
  anchorIndex: -1,
  canvasPoint: null,
});
const isFullscreen = ref(false);
const isSideCollapsed = ref(false);
const {
  magneticHeader,
  isHeaderPeeking,
  enableMagneticHeader,
  disableMagneticHeader,
  toggleMagneticHeader,
  initMagneticHeader,
  teardownMagneticHeader,
} = useMagneticHeader({
  isFullscreen,
  canvasRef,
  canvasHeight: ref(620),
  onHeightSync: () => {
    if (!isFullscreen.value) return;
    const el = ecuMessageEditor.active ? ecuMessageEditorRef.value?.$el : canvasRef.value;
    if (!el) return;
    const bounds = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const available = Math.floor(vh - bounds.top - 10);
    const h = Math.max(320, available);
    canvasHeight.value = h;
    if (ecuMessageEditor.active) {
      editorPanelHeight.value = h;
    }
  },
});
const canvasZoom = ref(1);
const canvasHeight = ref(620);
const nonFullscreenCanvasHeight = ref(620);
const activeTopMenu = ref('');
const activeLinkStyle = ref('polyline');
const exportPrefs = reactive({
  includeBackground: true,
  autoCrop: true,
});
const ecuMessageEditor = reactive({
  active: false,
  ecuId: '',
  ecu: null,
});

const editorPanelHeight = ref(620);

const formErrors = ref([]);
const formWarnings = ref([]);

const draft = reactive({
  name: '',
  note: '',
  protocols: [],
  j1939AddressesInput: '',
  canopenNodeIdsInput: '',
  baseColor: DEFAULT_NODE_BASE_COLOR,
});

const busDraft = reactive({
  name: '',
  baudRate: DEFAULT_BUS_BAUD,
  color: BUS_COLOR_POOL[0],
});

const linkEditor = reactive({
  style: 'polyline',
  protocols: [],
  j1939AddressesInput: '',
  canopenNodeIdsInput: '',
});

const linkHoverNodeEdge = reactive({
  nodeId: '',
  edge: '',
});
const linkHoverBusId = ref('');
const linkDraftTarget = ref(null);
const linkDraftVersion = ref(0);

let dragState = null;
let canvasResizeState = null;
let busDragState = null;
let linkDraftState = null;
let linkAnchorDragState = null;
let deleteKeyBound = false;
let autoSaveTimerId = null;
let draftApplyTimerId = null;
let busDraftApplyTimerId = null;
let isSyncingDraft = false;
let isSyncingBusDraft = false;
let isSyncingLinkEditor = false;
let draftHistoryNodeId = null;
let busDraftHistoryBusId = null;
let linkEditorHistoryLinkId = null;

function bumpLinkDraftVersion() {
  linkDraftVersion.value += 1;
}

const {
  selectedBusIdSet,
  setBusSelection,
  clearBusSelection,
} = useBusSelection({
  buses,
  selectedBusIds,
  selectedBusId,
  syncBusDraftFromSelected: () => syncBusDraftFromSelected(),
});

const {
  selectionRect,
  isBoxSelecting,
  startBoxSelection,
  stopBoxSelection,
} = useBoxSelection({
  nodes,
  buses,
  selectedIds,
  selectedBusIds,
  setBusSelection,
  setStatus: (message) => setStatus(message),
  resolvePointerInCanvas: (event) => resolvePointerInCanvas(event),
  rectFromPoints: (a, b) => rectFromPoints(a, b),
  intersectsNode: (rect, node) => intersectsNode(rect, node),
  intersectsBus: (rect, bus) => intersectsBus(rect, bus),
  syncBusDraftFromSelected: () => syncBusDraftFromSelected(),
  syncDraftFromSelected: () => syncDraftFromSelected(),
});

const {
  isCanvasPanning,
  isPanning,
  startCanvasPan,
  stopCanvasPan,
  onCanvasPanPointerCancel,
  onCanvasPanLostCapture,
} = useCanvasPan({
  nodes,
  buses,
  links,
  selectedIds,
  clearBusSelection,
  syncDraftFromSelected: () => syncDraftFromSelected(),
  syncBusDraftFromSelected: () => syncBusDraftFromSelected(),
  pushHistorySnapshot: () => pushHistorySnapshot(),
  persistNodes: () => persistNodes(),
  nowIso: () => nowIso(),
});

const nodeOps = useNodeOperations({
  nodes,
  links,
  buses,
  selectedIds,
  selectedBusIds,
  selectedLinkId,
  pushHistorySnapshot: () => pushHistorySnapshot(),
  persistNodes: () => persistNodes(),
  closeContextMenu: () => closeContextMenu(),
  syncDraftFromSelected: () => syncDraftFromSelected(),
  syncBusDraftFromSelected: () => syncBusDraftFromSelected(),
  syncLinkEditorFromSelected: () => syncLinkEditorFromSelected(),
  setStatus: (message, isError) => setStatus(message, isError),
  createNodeName,
  createBusName,
  nextNodePosition: () => nextNodePosition(),
  nextBusPosition: () => nextBusPosition(),
  normalizeBusColor,
  ensureUniqueLabel,
  normalizeLinkStyle,
  normalizeProtocolsList,
  normalizeIntegerList,
  BUS_COLOR_POOL,
  DEFAULT_BUS_BAUD,
  NODE_WIDTH,
  NODE_HEIGHT,
  BUS_RADIUS,
  canvasZoom,
  contextMenu,
  getCanvasBounds: () => getCanvasBounds(),
  setBusSelection,
  clearBusSelection,
});

const singleSelectedNode = computed(() => {
  if (selectedIds.value.length !== 1) return null;
  return nodes.value.find((item) => item.id === selectedIds.value[0]) || null;
});

const singleSelectedBus = computed(() => {
  if (selectedBusIds.value.length !== 1) return null;
  return buses.value.find((item) => item.id === selectedBusIds.value[0]) || null;
});

const singleSelectedLink = computed(() => {
  if (!selectedLinkId.value) return null;
  return links.value.find((item) => item.id === selectedLinkId.value) || null;
});

const sidePanelTitle = computed(() => {
  if (singleSelectedLink.value) return '连线属性面板';
  if (singleSelectedBus.value) return 'CAN BUS 属性面板';
  return 'ECU 属性面板';
});

const hasAnySelectionForDelete = computed(() => {
  if (ecuMessageEditor.active) {
    return Boolean(ecuMessageEditorRef.value?.hasSelection);
  }
  return Boolean(selectedLinkId.value) || selectedIds.value.length > 0 || selectedBusIds.value.length > 0;
});

const hasAnySelectionForExport = computed(() => {
  return Boolean(selectedLinkId.value) || selectedIds.value.length > 0 || selectedBusIds.value.length > 0;
});

const {
  dbcExportModalOpen,
  dbcExportSelection,
  pendingDbcExport,
  canConfirmDbcExport,
  closeDbcExportModal,
  syncPendingDbcExportCountsByBusSelection,
  toggleDbcExportBusSelection,
  toggleDbcExportGroupProtocol,
  updateDbcExportGroupJ1939Mode,
  openDbcExportForBusGroups,
  openDbcExportForProtocolSplit,
} = useDbcExportSelection();

const {
  newImportCandidates,
  conflictImportCandidates,
  importSelectedCount,
  existingNodeNameOptions,
  resolveCandidateMergeNodeName,
  setImportCandidateResolveMode,
  toggleImportCandidateGroup,
  selectAllImportCandidates,
  clearAllImportCandidates,
  handleImportModalKeydown,
  buildImportCandidatesFromParsed,
} = useImportReview({
  importCandidates,
  importReviewState,
  nodes,
  importModalOpen,
  importStage,
});

const floatingStatusText = computed(() => {
  if (statusError.value) return statusError.value;
  if (selectionRect.value) {
    const ecuCount = selectedIds.value.length;
    const busCount = selectedBusIds.value.length;
    const totalCount = ecuCount + busCount;
    return `框选中：已选 ${totalCount} 项（ECU ${ecuCount} 个，CAN BUS ${busCount} 个）。`;
  }
  return statusMessage.value;
});

const ecuMessageEditorBusTabs = computed(() => {
  if (!ecuMessageEditor.active || !ecuMessageEditor.ecuId) return [];
  const currentNode = nodes.value.find((item) => item.id === ecuMessageEditor.ecuId);
  if (!currentNode) return [];
  const tabs = [];
  for (const bus of buses.value) {
    const peerIds = new Set();
    for (const link of links.value) {
      const linkBusId = resolveLinkBusId(link);
      if (linkBusId !== bus.id) continue;
      const linkNodeId = resolveLinkNodeId(link);
      if (!linkNodeId) continue;
      if (linkNodeId === currentNode.id) continue;
      const peer = nodes.value.find((item) => item.id === linkNodeId);
      if (!peer) continue;
      peerIds.add(peer.id);
    }

    const connectedToBus = links.value.some((link) => resolveLinkBusId(link) === bus.id && resolveLinkNodeId(link) === currentNode.id);
    if (!connectedToBus) continue;

    tabs.push({
      busId: bus.id,
      busName: bus.name,
      peers: [...peerIds].map((id) => {
        const peer = nodes.value.find((item) => item.id === id);
        return {
          id,
          name: peer?.name || id,
        };
      }),
    });
  }
  return tabs;
});

const canAddAnchorInContextMenu = computed(() => {
  if (contextMenu.value.target !== 'link') return false;
  const linkId = contextMenu.value.linkId || selectedLinkId.value;
  if (!linkId) return false;
  const link = links.value.find((item) => item.id === linkId);
  return link?.style === 'polyline';
});

const busProtocolsForSelected = computed(() => {
  const bus = singleSelectedBus.value;
  if (!bus) return [];
  const protocolSet = new Set();
  for (const link of links.value) {
    const fromType = link.fromType || 'node';
    const toType = link.toType || 'bus';
    const fromId = link.fromId || link.nodeId;
    const toId = link.toId || link.busId;
    const hit = (fromType === 'bus' && fromId === bus.id) || (toType === 'bus' && toId === bus.id);
    if (!hit) continue;
    const normalizedLinkProtocols = normalizeProtocolsList(link.protocols);
    if (normalizedLinkProtocols.length > 0) {
      for (const protocol of normalizedLinkProtocols) {
        protocolSet.add(protocol);
      }
      continue;
    }

    // Backward compatibility for old link data without protocol metadata.
    const nodeId = fromType === 'node' ? fromId : (toType === 'node' ? toId : '');
    const node = nodes.value.find((item) => item.id === nodeId);
    for (const protocol of resolveNodeDefaultProtocols(node)) {
      protocolSet.add(protocol);
    }
  }
  return [...protocolSet];
});

function normalizeProtocolsList(value) {
  return domainNormalizeProtocolsList(value, SUPPORTED_CAN_PROTOCOLS);
}

function normalizeLinkStyle(styleInput) {
  return domainNormalizeLinkStyle(styleInput, LINK_STYLE_OPTIONS);
}

function normalizeIntegerList(value) {
  return domainNormalizeIntegerList(value);
}

function _findNodeById(id) {
  return nodes.value.find((item) => item.id === id);
}

function resolveNodeDefaultProtocols(node) {
  return domainResolveNodeDefaultProtocols(node);
}

function resolveLinkDefaultProtocols(link) {
  return domainResolveLinkAllowedProtocols(link, _findNodeById);
}

function resolveLinkAllowedProtocols(link) {
  return domainResolveLinkAllowedProtocols(link, _findNodeById);
}

function resolveNodeDefaultJ1939Addresses(node) {
  return domainResolveNodeDefaultJ1939Addresses(node);
}

function resolveNodeDefaultCanopenNodeIds(node) {
  return domainResolveNodeDefaultCanopenNodeIds(node);
}

function resolveLinkAllowedJ1939Addresses(link) {
  return domainResolveLinkAllowedJ1939Addresses(link, _findNodeById);
}

function resolveLinkAllowedCanopenNodeIds(link) {
  return domainResolveLinkAllowedCanopenNodeIds(link, _findNodeById);
}

function normalizeLinkProtocolsByNode(link, protocolsInput) {
  return domainNormalizeLinkProtocolsByNode(link, protocolsInput, _findNodeById);
}

function normalizeLinkJ1939AddressesByNode(link, protocolsInput, addressesInput) {
  return domainNormalizeLinkJ1939AddressesByNode(link, protocolsInput, addressesInput, _findNodeById);
}

function normalizeLinkCanopenNodeIdsByNode(link, protocolsInput, addressesInput) {
  return domainNormalizeLinkCanopenNodeIdsByNode(link, protocolsInput, addressesInput, _findNodeById);
}

function pruneNodeConnectedLinkCapabilities(nodeId, allowedProtocols, allowedJ1939Addresses, allowedCanopenNodeIds) {
  return domainPruneNodeConnectedLinkCapabilities(
    nodeId,
    allowedProtocols,
    allowedJ1939Addresses,
    allowedCanopenNodeIds,
    links.value,
  );
}

function canLinkUseProtocol(protocol) {
  const link = singleSelectedLink.value;
  if (!link) return true;
  return resolveLinkAllowedProtocols(link).includes(protocol);
}

function resolveNodeAnchorByEdge(node, edge, offsetRatio) {
  return geometryResolveNodeAnchorByEdge(node, edge, offsetRatio, NODE_WIDTH, NODE_HEIGHT);
}

function resolveModuleByRef(type, id) {
  if (type === 'node') {
    return nodes.value.find((item) => item.id === id) || null;
  }
  if (type === 'bus') {
    return buses.value.find((item) => item.id === id) || null;
  }
  return null;
}

function resolveNodeAnchorFromDirection(node, targetPoint) {
  return geometryResolveNodeAnchorFromDirection(node, targetPoint, NODE_WIDTH, NODE_HEIGHT);
}

function resolveBusAnchorFromDirection(bus, targetPoint) {
  return geometryResolveBusAnchorFromDirection(bus, targetPoint, BUS_RADIUS);
}

function resolveModuleAnchorPoint(type, module, anchorEdge, anchorOffset, targetPoint) {
  return geometryResolveModuleAnchorPoint(
    type,
    module,
    anchorEdge,
    anchorOffset,
    targetPoint,
    NODE_WIDTH,
    NODE_HEIGHT,
    BUS_RADIUS,
  );
}

function resolveLinkEndpointsForGeometry(link) {
  return domainResolveLinkEndpointsForGeometry(link, resolveModuleByRef);
}

function ensureControlAnchorsForLink(link) {
  domainEnsureControlAnchorsForLink(link, resolveModuleByRef, normalizeLinkStyle);
}

function buildOrthogonalPoints(start, end) {
  return geometryBuildOrthogonalPoints(start, end);
}

function buildPolylinePath(points) {
  return geometryBuildPolylinePath(points);
}

function buildRoundedOrthogonalPath(points, radius = 14) {
  return geometryBuildRoundedOrthogonalPath(points, radius);
}

function buildLinkGeometryPath(style, start, end, anchors) {
  return geometryBuildLinkGeometryPath(style, start, end, anchors, normalizeLinkStyle);
}

const resolvedLinks = computed(() => {
  const geometries = [];
  for (const link of links.value) {
    const fromType = link.fromType || 'node';
    const toType = link.toType || 'bus';
    const fromId = link.fromId || link.nodeId;
    const toId = link.toId || link.busId;
    const fromModule = resolveModuleByRef(fromType, fromId);
    const toModule = resolveModuleByRef(toType, toId);
    if (!fromModule || !toModule) continue;

    const fromCenter = fromType === 'node'
      ? { x: fromModule.position.x + NODE_WIDTH / 2, y: fromModule.position.y + NODE_HEIGHT / 2 }
      : { x: fromModule.position.x + BUS_RADIUS, y: fromModule.position.y + BUS_RADIUS };
    const toCenter = toType === 'node'
      ? { x: toModule.position.x + NODE_WIDTH / 2, y: toModule.position.y + NODE_HEIGHT / 2 }
      : { x: toModule.position.x + BUS_RADIUS, y: toModule.position.y + BUS_RADIUS };

    const start = resolveModuleAnchorPoint(fromType, fromModule, link.fromAnchorEdge, link.fromAnchorOffset, toCenter);
    const end = resolveModuleAnchorPoint(toType, toModule, link.toAnchorEdge, link.toAnchorOffset, fromCenter);
    if (!start || !end) continue;

    const style = normalizeLinkStyle(link.style);
    const rendered = buildLinkGeometryPath(style, start, end, link.anchors);
    const busColor = fromType === 'bus'
      ? normalizeBusColor(fromModule.color, BUS_COLOR_POOL[0])
      : toType === 'bus'
        ? normalizeBusColor(toModule.color, BUS_COLOR_POOL[0])
        : '#395f89';

    geometries.push({
      id: link.id,
      fromType,
      fromId,
      toType,
      toId,
      style,
      path: rendered.path,
      anchors: rendered.anchors,
      color: busColor,
      start,
      end,
    });
  }
  return geometries;
});

function nodeLinkDots(node) {
  return domainNodeLinkDots(node, resolvedLinks.value);
}

const linkDraft = computed(() => {
  linkDraftVersion.value;
  if (!linkDraftState) return null;
  const draftStyle = normalizeLinkStyle(activeLinkStyle.value);
  const rendered = buildLinkGeometryPath(draftStyle, linkDraftState.start, linkDraftState.current, []);
  return {
    start: linkDraftState.start,
    current: linkDraftState.current,
    path: rendered.path,
  };
});

const canUndo = computed(() => historyPast.value.length > 0);
const canRedo = computed(() => historyFuture.value.length > 0);

const panelClassList = computed(() => ({
  active: props.active,
  'is-fullscreen': isFullscreen.value,
  'side-collapsed': isSideCollapsed.value,
  'magnetic-header': magneticHeader.value,
  'header-peeking': isHeaderPeeking.value,
}));

const sceneSize = computed(() => {
  const bounds = getCanvasBounds();
  const viewportWidth = bounds ? Math.max(420, Math.floor(bounds.width / canvasZoom.value)) : 420;
  const viewportHeight = bounds ? Math.max(420, Math.floor(bounds.height / canvasZoom.value)) : 420;

  let maxX = viewportWidth;
  let maxY = viewportHeight;
  for (const node of nodes.value) {
    maxX = Math.max(maxX, Math.round(node.position.x + NODE_WIDTH + 40));
    maxY = Math.max(maxY, Math.round(node.position.y + NODE_HEIGHT + 40));
  }
  for (const bus of buses.value) {
    maxX = Math.max(maxX, Math.round(bus.position.x + BUS_RADIUS * 2 + 40));
    maxY = Math.max(maxY, Math.round(bus.position.y + BUS_RADIUS * 2 + 40));
  }

  return {
    width: Math.max(420, maxX),
    height: Math.max(420, maxY),
  };
});

const sceneViewportSize = computed(() => ({
  width: Math.max(420, Math.round(sceneSize.value.width * canvasZoom.value)),
  height: Math.max(420, Math.round(sceneSize.value.height * canvasZoom.value)),
}));

function hideSideCard() {
  isSideCollapsed.value = true;
}

function showSideCard() {
  isSideCollapsed.value = false;
}

function toggleTopMenu(menuName) {
  activeTopMenu.value = activeTopMenu.value === menuName ? '' : menuName;
  if (activeTopMenu.value && magneticHeader.value) {
    isHeaderPeeking.value = true;
  }
}

function closeTopMenu() {
  activeTopMenu.value = '';
}

function runMenuAction(action) {
  closeTopMenu();
  action?.();
}

function onDocumentPointerDown(event) {
  if (event.target?.closest?.('.can-arch-menubar')) return;
  if (!event.target?.closest?.('.can-node-item')) {
    linkHoverNodeEdge.nodeId = '';
    linkHoverNodeEdge.edge = '';
  }
  if (!event.target?.closest?.('.can-bus-item')) {
    linkHoverBusId.value = '';
  }
  closeTopMenu();
}

function protocolLabel(protocol) {
  if (protocol === canProtocols.GENERIC_STD) return 'Generic(Std)';
  if (protocol === canProtocols.GENERIC_EXT) return 'Generic(Ext)';
  return protocol === canProtocols.CANOPEN ? 'CANopen' : protocol;
}

function protocolBadgeClass(protocol) {
  if (protocol === canProtocols.GENERIC_STD || protocol === canProtocols.GENERIC_EXT) return 'can-pill-neutral';
  return protocol === canProtocols.CANOPEN ? 'can-pill-canopen' : 'can-pill-j1939';
}

function protocolRowClass(protocol) {
  if (protocol === canProtocols.GENERIC_STD || protocol === canProtocols.GENERIC_EXT) return 'generic';
  if (protocol === canProtocols.CANOPEN) return 'canopen';
  if (protocol === canProtocols.J1939) return 'j1939';
  return 'generic';
}

function nodeCardStyle(node) {
  return buildNodeCardStyle(node);
}

function nodeProtocolGroups(node) {
  const groups = domainNodeProtocolGroups(node);
  if (groups.length === 0) {
    return [{
      key: 'generic',
      label: 'Generic(Std)',
      addressText: '',
      showAddress: false,
      badgeClass: 'can-pill-neutral',
      rowClass: 'generic',
    }];
  }
  return groups;
}

function nodeCardClasses(node) {
  const isDropTarget = linkDraftTarget.value?.type === 'node' && linkDraftTarget.value?.id === node.id;
  const isEdgeHot = linkHoverNodeEdge.nodeId === node.id;
  return {
    selected: selectedIdSet.value.has(node.id),
    'has-j1939': node.protocols.includes(canProtocols.J1939) || node.j1939Addresses.length > 0,
    'has-canopen': node.protocols.includes(canProtocols.CANOPEN) || node.canopenNodeIds.length > 0,
    'link-drop-target': isDropTarget,
    'link-edge-hot': isEdgeHot,
    'link-edge-left': isEdgeHot && linkHoverNodeEdge.edge === 'left',
    'link-edge-right': isEdgeHot && linkHoverNodeEdge.edge === 'right',
    'link-edge-top': isEdgeHot && linkHoverNodeEdge.edge === 'top',
    'link-edge-bottom': isEdgeHot && linkHoverNodeEdge.edge === 'bottom',
  };
}

function busCardClasses(bus) {
  return {
    selected: selectedBusIdSet.value.has(bus.id),
    'link-rim-hot': linkHoverBusId.value === bus.id,
    'link-drop-target': linkDraftTarget.value?.type === 'bus' && linkDraftTarget.value?.id === bus.id,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function findBusByPoint(point, excludeBusId = '') {
  return domainFindBusByPoint(point, buses.value, excludeBusId);
}

function findNodeByPoint(point, excludeNodeId = '') {
  return domainFindNodeByPoint(point, nodes.value, excludeNodeId);
}

function resolveDropTargetFromEvent(event, fromRef) {
  const point = resolvePointerInCanvas(event);
  const domHit = document.elementFromPoint(event.clientX, event.clientY);

  if (fromRef?.type === 'node') {
    const busEl = domHit?.closest?.('.can-bus-item');
    const busId = busEl?.getAttribute?.('data-bus-id') || '';
    if (busId && (!fromRef || fromRef.id !== busId)) {
      return { type: 'bus', id: busId };
    }
    const bus = findBusByPoint(point, '');
    if (bus) return { type: 'bus', id: bus.id };
    return null;
  }

  if (fromRef?.type === 'bus') {
    const nodeEl = domHit?.closest?.('.can-node-item');
    const nodeId = nodeEl?.getAttribute?.('data-node-id') || '';
    if (nodeId && (!fromRef || fromRef.id !== nodeId)) {
      return { type: 'node', id: nodeId };
    }
    const node = findNodeByPoint(point, '');
    if (node) return { type: 'node', id: node.id };
    return null;
  }

  return null;
}

function deleteSelectedLink() {
  return nodeOps.deleteSelectedLink();
}

function applyActiveStyleToSelectedLink() {
  setSelectedLinkStyle(activeLinkStyle.value, {
    updateToolbar: false,
    showStatus: true,
  });
}

function setSelectedLinkStyle(styleInput, options = {}) {
  if (!selectedLinkId.value) return;
  const target = links.value.find((item) => item.id === selectedLinkId.value);
  if (!target) return;
  const style = normalizeLinkStyle(styleInput);
  if (target.style === style) return;
  if (linkEditorHistoryLinkId !== target.id) {
    pushHistorySnapshot();
    linkEditorHistoryLinkId = target.id;
  }
  target.style = style;
  ensureControlAnchorsForLink(target);
  if (options.updateToolbar !== false) {
    activeLinkStyle.value = style;
  }
  persistNodes();
  if (options.showStatus !== false) {
    setStatus('已更新连线样式。');
  }
}

function setSelectedLinkProtocols(protocolsInput, options = {}) {
  if (!selectedLinkId.value) return;
  const target = links.value.find((item) => item.id === selectedLinkId.value);
  if (!target) return;

  const normalized = normalizeLinkProtocolsByNode(target, protocolsInput);
  const normalizedJ1939 = normalizeLinkJ1939AddressesByNode(target, normalized, target.j1939Addresses);
  const normalizedCanopen = normalizeLinkCanopenNodeIdsByNode(target, normalized, target.canopenNodeIds);
  const sameProtocols = JSON.stringify(normalizeProtocolsList(target.protocols)) === JSON.stringify(normalized);
  const sameJ1939 = JSON.stringify(normalizeIntegerList(target.j1939Addresses)) === JSON.stringify(normalizedJ1939);
  const sameCanopen = JSON.stringify(normalizeIntegerList(target.canopenNodeIds)) === JSON.stringify(normalizedCanopen);
  if (sameProtocols && sameJ1939 && sameCanopen) {
    return;
  }

  if (linkEditorHistoryLinkId !== target.id) {
    pushHistorySnapshot();
    linkEditorHistoryLinkId = target.id;
  }

  target.protocols = [...normalized];
  target.j1939Addresses = [...normalizedJ1939];
  target.canopenNodeIds = [...normalizedCanopen];
  persistNodes();
  if (options.showStatus !== false) {
    setStatus('已更新连线协议。');
  }
}

function setSelectedLinkAddresses(j1939AddressesInput, canopenNodeIdsInput, options = {}) {
  if (!selectedLinkId.value) return;
  const target = links.value.find((item) => item.id === selectedLinkId.value);
  if (!target) return;

  const normalizedJ1939 = normalizeLinkJ1939AddressesByNode(target, target.protocols, j1939AddressesInput);
  const normalizedCanopen = normalizeLinkCanopenNodeIdsByNode(target, target.protocols, canopenNodeIdsInput);
  const sameJ1939 = JSON.stringify(normalizeIntegerList(target.j1939Addresses)) === JSON.stringify(normalizedJ1939);
  const sameCanopen = JSON.stringify(normalizeIntegerList(target.canopenNodeIds)) === JSON.stringify(normalizedCanopen);
  if (sameJ1939 && sameCanopen) {
    return;
  }

  if (linkEditorHistoryLinkId !== target.id) {
    pushHistorySnapshot();
    linkEditorHistoryLinkId = target.id;
  }

  target.j1939Addresses = [...normalizedJ1939];
  target.canopenNodeIds = [...normalizedCanopen];
  persistNodes();
  if (options.showStatus !== false) {
    setStatus('已更新连线地址。');
  }
}

function distancePointToSegment(point, a, b) {
  return geometryDistancePointToSegment(point, a, b);
}

function addAnchorToLink(linkId, point) {
  const target = links.value.find((item) => item.id === linkId);
  const geometry = resolvedLinks.value.find((item) => item.id === linkId);
  if (!target || !geometry || !point) return;
  domainAddAnchorToLink(target, geometry, point, distancePointToSegment);
  persistNodes();
}

function onLinkPointerDown(link, event) {
  selectedLinkId.value = link.id;
  selectedIds.value = [];
  clearBusSelection({ sync: false });
  syncDraftFromSelected();
  syncBusDraftFromSelected();
  syncLinkEditorFromSelected();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
}

function onLinkContextMenu(link, event) {
  selectedLinkId.value = link.id;
  const point = resolvePointerInCanvas(event);
  openContextMenuAt(event.clientX, event.clientY, 'link', null, point, link.id);
  setStatus('已打开连线菜单。');
}

function onLinkAnchorContextMenu(link, anchorIndex, event) {
  selectedLinkId.value = link.id;
  syncLinkEditorFromSelected();
  const point = resolvePointerInCanvas(event);
  openContextMenuAt(event.clientX, event.clientY, 'anchor', null, point, link.id, anchorIndex);
  setStatus('已打开锚点菜单。');
}

function onLinkDoubleClick(link, event) {
  const point = resolvePointerInCanvas(event);
  if (!point) return;
  if (selectedLinkId.value !== link.id) {
    selectedLinkId.value = link.id;
  }
  pushHistorySnapshot();
  addAnchorToLink(link.id, point);
  setStatus('已添加连线锚点。');
}

function onLinkAnchorPointerDown(link, anchorIndex, event) {
  if (event.button !== 0) return;
  const point = resolvePointerInCanvas(event);
  if (!point) return;
  selectedLinkId.value = link.id;
  syncLinkEditorFromSelected();
  linkAnchorDragState = {
    linkId: link.id,
    anchorIndex,
    pointerId: event.pointerId,
    start: point,
    historyCaptured: false,
    pointerTarget: event.currentTarget,
  };
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onLinkAnchorPointerMove);
  window.addEventListener('pointerup', onLinkAnchorPointerUp);
  document.addEventListener('pointermove', onLinkAnchorPointerMove);
  document.addEventListener('pointerup', onLinkAnchorPointerUp);
}

function onLinkAnchorPointerMove(event) {
  if (!linkAnchorDragState || linkAnchorDragState.pointerId !== event.pointerId) return;
  const point = resolvePointerInCanvas(event);
  if (!point) return;
  const target = links.value.find((item) => item.id === linkAnchorDragState.linkId);
  if (!target || !Array.isArray(target.anchors)) return;
  if (!target.anchors[linkAnchorDragState.anchorIndex]) return;
  if (!linkAnchorDragState.historyCaptured) {
    pushHistorySnapshot();
    linkAnchorDragState.historyCaptured = true;
  }
  target.anchors[linkAnchorDragState.anchorIndex] = {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function onLinkAnchorPointerUp(event) {
  if (!linkAnchorDragState || (event && linkAnchorDragState.pointerId !== event.pointerId)) return;
  linkAnchorDragState.pointerTarget?.releasePointerCapture?.(linkAnchorDragState.pointerId);
  linkAnchorDragState = null;
  persistNodes();
  window.removeEventListener('pointermove', onLinkAnchorPointerMove);
  window.removeEventListener('pointerup', onLinkAnchorPointerUp);
  document.removeEventListener('pointermove', onLinkAnchorPointerMove);
  document.removeEventListener('pointerup', onLinkAnchorPointerUp);
}

function addAnchorAtContextMenu() {
  if (!selectedLinkId.value || !contextMenu.value.canvasPoint) return;
  const link = links.value.find((item) => item.id === selectedLinkId.value);
  if (!link || link.style !== 'polyline') return;
  pushHistorySnapshot();
  addAnchorToLink(selectedLinkId.value, contextMenu.value.canvasPoint);
  closeContextMenu();
  setStatus('已添加连线锚点。');
}

function deleteAnchorAtContextMenu() {
  const linkId = contextMenu.value.linkId || selectedLinkId.value;
  const anchorIndex = Number(contextMenu.value.anchorIndex);
  if (!linkId || !Number.isInteger(anchorIndex) || anchorIndex < 0) return;
  const link = links.value.find((item) => item.id === linkId);
  if (!link || !Array.isArray(link.anchors) || !link.anchors[anchorIndex]) return;
  pushHistorySnapshot();
  link.anchors.splice(anchorIndex, 1);
  persistNodes();
  closeContextMenu();
  setStatus('已删除锚点。');
}

function addAnchorToSelectedLink() {
  if (!selectedLinkId.value) return;
  const geometry = resolvedLinks.value.find((item) => item.id === selectedLinkId.value);
  if (!geometry) return;
  const point = {
    x: Math.round((geometry.start.x + geometry.end.x) / 2),
    y: Math.round((geometry.start.y + geometry.end.y) / 2),
  };
  pushHistorySnapshot();
  addAnchorToLink(selectedLinkId.value, point);
  setStatus('已添加连线锚点。');
}

function copyCurrentSelection() {
  return nodeOps.copyCurrentSelection();
}

function pasteClipboard(point = null) {
  return nodeOps.pasteClipboard(point);
}

function getCanvasBounds() {
  return canvasRef.value?.getBoundingClientRect() || null;
}

function nextNodePosition() {
  const baseX = 20;
  const baseY = 20;
  const stepX = 18;
  const stepY = 14;

  function occupiedByAnchor(candidate) {
    return nodes.value.some((node) => (
      Math.abs(node.position.x - candidate.x) < 12 &&
      Math.abs(node.position.y - candidate.y) < 12
    ));
  }

  for (let i = 0; i < 14; i += 1) {
    const candidate = {
      x: baseX + i * stepX,
      y: baseY + i * stepY,
    };
    if (!occupiedByAnchor(candidate)) {
      return candidate;
    }
  }

  return {
    x: baseX,
    y: baseY,
  };
}

function nextBusPosition() {
  const baseX = 80;
  const baseY = 40;
  const stepX = 92;
  const stepY = 18;
  for (let i = 0; i < 12; i += 1) {
    const candidate = { x: baseX + i * stepX, y: baseY + i * stepY };
    const occupied = buses.value.some((bus) => (
      Math.abs(bus.position.x - candidate.x) < BUS_RADIUS * 2 &&
      Math.abs(bus.position.y - candidate.y) < BUS_RADIUS * 2
    ));
    if (!occupied) return candidate;
  }
  return { x: baseX, y: baseY };
}

const busCardStyle = buildBusCardStyle;

function normalizeBusColor(value, fallback = BUS_COLOR_POOL[0]) {
  return normalizeNodeBaseColor(value, fallback);
}

function persistNodes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nodes: cloneNodesSnapshot(nodes.value),
      buses: cloneBusesSnapshot(buses.value),
      links: cloneLinksSnapshot(links.value),
    }));
  } catch (_) {
    // Ignore storage errors.
  }
}

function buildArchitectureConfig() {
  return {
    schema: CONFIG_SCHEMA,
    version: CONFIG_VERSION,
    exportedAt: nowIso(),
    nodes: cloneNodesSnapshot(nodes.value),
    buses: cloneBusesSnapshot(buses.value),
    links: cloneLinksSnapshot(links.value),
  };
}

function exportArchitectureConfig() {
  const config = buildArchitectureConfig();
  const text = JSON.stringify(config, null, 2);
  const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadTextFile(`can-arch-config-${dateTag}.json`, text);
  setStatus(`已导出架构配置（${nodes.value.length} 个 ECU，${buses.value.length} 个 BUS）。`);
}

function triggerConfigImportDialog() {
  configImportInputRef.value?.click();
}

function exportArchitectureSvg() {
  const result = buildArchitectureSvg({
    nodes: nodes.value,
    buses: buses.value,
    resolvedLinks: resolvedLinks.value,
    includeBackground: exportPrefs.includeBackground,
    crop: exportPrefs.autoCrop,
    sceneSize: sceneSize.value,
  });
  downloadTextFile(`can-arch-${buildTimestampTag()}.svg`, result.svg);
  setStatus(`已导出 SVG（${exportPrefs.includeBackground ? '含背景' : '透明背景'}，${exportPrefs.autoCrop ? '自动裁剪' : '不裁剪'}）。`);
}

async function exportArchitecturePng() {
  try {
    const svgResult = buildArchitectureSvg({
      nodes: nodes.value,
      buses: buses.value,
      resolvedLinks: resolvedLinks.value,
      includeBackground: exportPrefs.includeBackground,
      crop: exportPrefs.autoCrop,
      sceneSize: sceneSize.value,
    });
    const pngBlob = await serviceExportArchitecturePng(svgResult, exportPrefs);
    downloadBlobFile(`can-arch-${buildTimestampTag()}.png`, pngBlob);
    setStatus(`已导出 PNG（${exportPrefs.includeBackground ? '含背景' : '透明背景'}，${exportPrefs.autoCrop ? '自动裁剪' : '不裁剪'}）。`);
  } catch (error) {
    setStatus(`导出 PNG 失败: ${error?.message || error}`, true);
  }
}

async function handleConfigFileChosen(event) {
  const input = event.target;
  const file = input?.files?.[0];
  input.value = '';
  if (!file) return;

  const confirmed = window.confirm('导入将覆盖当前画布，是否继续？');
  if (!confirmed) {
    setStatus('已取消导入架构配置。');
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const incoming = extractTopologyFromConfigPayload(payload);
    pushHistorySnapshot();
    nodes.value = hydrateNodes(incoming.nodes);
    buses.value = hydrateBuses(incoming.buses);
    links.value = hydrateLinks(incoming.links, nodes.value, buses.value);
    selectedIds.value = [];
    clearBusSelection({ sync: false });
    selectedLinkId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
    persistNodes();
    closeContextMenu();
    setStatus(`已导入架构配置（${nodes.value.length} 个 ECU，${buses.value.length} 个 BUS）。`);
  } catch (error) {
    setStatus(`导入架构配置失败: ${error?.message || error}`, true);
  }
}

function startAutoSaveTimer() {
  if (autoSaveTimerId) return;
  autoSaveTimerId = window.setInterval(() => {
    persistNodes();
  }, AUTO_SAVE_INTERVAL_MS);
}

function stopAutoSaveTimer() {
  if (!autoSaveTimerId) return;
  window.clearInterval(autoSaveTimerId);
  autoSaveTimerId = null;
}

function stopDraftApplyTimer() {
  if (!draftApplyTimerId) return;
  window.clearTimeout(draftApplyTimerId);
  draftApplyTimerId = null;
}

function takeTopologySnapshot() {
  return cloneTopologySnapshot({
    nodes: nodes.value,
    buses: buses.value,
    links: links.value,
  });
}

function pushHistorySnapshot() {
  if (historySuspend.value) return;
  historyPast.value.push(takeTopologySnapshot());
  if (historyPast.value.length > HISTORY_LIMIT) {
    historyPast.value.shift();
  }
  historyFuture.value = [];
}

function applyHistoryState(snapshot, statusText) {
  historySuspend.value = true;
  nodes.value = hydrateNodes(snapshot?.nodes || [], { nextNodePosition });
  buses.value = hydrateBuses(snapshot?.buses || [], { nextBusPosition });
  links.value = hydrateLinks(snapshot?.links || [], nodes.value, buses.value);
  selectedIds.value = [];
  clearBusSelection({ sync: false });
  selectedLinkId.value = '';
  syncDraftFromSelected();
  syncBusDraftFromSelected();
  persistNodes();
  historySuspend.value = false;
  setStatus(statusText);
}

function undoNodes() {
  if (historyPast.value.length === 0) return;
  const previous = historyPast.value.pop();
  historyFuture.value.push(takeTopologySnapshot());
  applyHistoryState(previous, '已撤销上一步操作。');
}

function redoNodes() {
  if (historyFuture.value.length === 0) return;
  const next = historyFuture.value.pop();
  historyPast.value.push(takeTopologySnapshot());
  applyHistoryState(next, '已重做上一步操作。');
}

function loadNodes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      nodes.value = [];
      buses.value = [];
      links.value = [];
      selectedLinkId.value = '';
      return;
    }
    const payload = JSON.parse(raw);
    const snapshot = extractTopologyFromConfigPayload(payload);
    nodes.value = hydrateNodes(snapshot.nodes, { nextNodePosition });
    buses.value = hydrateBuses(snapshot.buses, { nextBusPosition });
    links.value = hydrateLinks(snapshot.links, nodes.value, buses.value);
    selectedLinkId.value = '';
  } catch (_) {
    nodes.value = [];
    buses.value = [];
    links.value = [];
    selectedLinkId.value = '';
  }
}

function closeContextMenu() {
  contextMenu.value.open = false;
  contextMenu.value.target = 'canvas';
  contextMenu.value.nodeId = null;
  contextMenu.value.linkId = null;
  contextMenu.value.anchorIndex = -1;
  contextMenu.value.canvasPoint = null;
}

function openContextMenuAt(x, y, target = 'canvas', nodeId = null, canvasPoint = null, linkId = null, anchorIndex = -1) {
  contextMenu.value = {
    open: true,
    x,
    y,
    target,
    nodeId,
    linkId,
    anchorIndex,
    canvasPoint,
  };
}

function openCanvasContextMenu(event) {
  const point = resolvePointerInCanvas(event);
  if (!point) return;
  openContextMenuAt(event.clientX, event.clientY, 'canvas', null, point);
  setStatus('已打开画布右键菜单。');
}

function onNodeContextMenu(node, event) {
  selectedLinkId.value = '';
  clearBusSelection({ sync: false });
  syncBusDraftFromSelected();
  if (!selectedIds.value.includes(node.id)) {
    selectedIds.value = [node.id];
    syncDraftFromSelected();
  }
  const point = resolvePointerInCanvas(event);
  openContextMenuAt(event.clientX, event.clientY, 'node', node.id, point);
  setStatus(`已打开 ECU 右键菜单：${node.name}`);
}

function setStatus(message, isError = false) {
  if (isError) {
    statusError.value = message;
    return;
  }
  statusError.value = '';
  statusMessage.value = message;
}

function syncDraftFromSelected() {
  isSyncingDraft = true;
  stopDraftApplyTimer();
  draftHistoryNodeId = null;
  formErrors.value = [];
  formWarnings.value = [];
  const node = singleSelectedNode.value;
  if (!node) {
    draft.name = '';
    draft.note = '';
    draft.protocols = [];
    draft.j1939AddressesInput = '';
    draft.canopenNodeIdsInput = '';
    draft.baseColor = DEFAULT_NODE_BASE_COLOR;
    isSyncingDraft = false;
    return;
  }

  draft.name = node.name;
  draft.note = node.note || '';
  draft.protocols = [...node.protocols];
  draft.j1939AddressesInput = node.j1939Addresses.join(', ');
  draft.canopenNodeIdsInput = node.canopenNodeIds.join(', ');
  draft.baseColor = normalizeNodeBaseColor(node.baseColor);
  isSyncingDraft = false;
}

function syncBusDraftFromSelected() {
  isSyncingBusDraft = true;
  if (busDraftApplyTimerId) {
    window.clearTimeout(busDraftApplyTimerId);
    busDraftApplyTimerId = null;
  }
  busDraftHistoryBusId = null;
  const bus = singleSelectedBus.value;
  if (!bus) {
    busDraft.name = '';
    busDraft.baudRate = DEFAULT_BUS_BAUD;
    busDraft.color = BUS_COLOR_POOL[0];
    isSyncingBusDraft = false;
    return;
  }
  busDraft.name = bus.name;
  busDraft.baudRate = bus.baudRate;
  busDraft.color = normalizeBusColor(bus.color);
  isSyncingBusDraft = false;
}

function describeLinkEndpoint(type, id) {
  if (!id) return '-';
  if (type === 'node') {
    const node = nodes.value.find((item) => item.id === id);
    return node ? `ECU: ${node.name}` : 'ECU: 已删除';
  }
  const bus = buses.value.find((item) => item.id === id);
  return bus ? `CAN BUS: ${bus.name}` : 'CAN BUS: 已删除';
}

function syncLinkEditorFromSelected() {
  isSyncingLinkEditor = true;
  linkEditorHistoryLinkId = null;
  const link = singleSelectedLink.value;
  if (!link) {
    linkEditor.style = 'polyline';
    linkEditor.protocols = [];
    linkEditor.j1939AddressesInput = '';
    linkEditor.canopenNodeIdsInput = '';
    isSyncingLinkEditor = false;
    return;
  }
  const style = normalizeLinkStyle(link.style);
  ensureControlAnchorsForLink(link);
  const protocols = normalizeLinkProtocolsByNode(link, link.protocols);
  const j1939Addresses = normalizeLinkJ1939AddressesByNode(link, protocols, link.j1939Addresses);
  const canopenNodeIds = normalizeLinkCanopenNodeIdsByNode(link, protocols, link.canopenNodeIds);
  linkEditor.style = style;
  linkEditor.protocols = protocols.length > 0 ? [...protocols] : resolveLinkDefaultProtocols(link);
  linkEditor.j1939AddressesInput = j1939Addresses.join(', ');
  linkEditor.canopenNodeIdsInput = canopenNodeIds.join(', ');
  activeLinkStyle.value = style;
  isSyncingLinkEditor = false;
}

function toggleLinkEditorProtocol(protocol, checked) {
  if (checked) {
    if (!linkEditor.protocols.includes(protocol)) {
      linkEditor.protocols = [...linkEditor.protocols, protocol];
    }
    return;
  }
  linkEditor.protocols = linkEditor.protocols.filter((token) => token !== protocol);
}

function selectOnly(nodeId) {
  return nodeOps.selectOnly(nodeId);
}

function selectBusOnly(busId) {
  return nodeOps.selectBusOnly(busId);
}

function resolveSpawnPosition(position) {
  return nodeOps.resolveSpawnPosition(position);
}

function addNode(position) {
  return nodeOps.addNode(position);
}

function addBus(position) {
  return nodeOps.addBus(position);
}

function addBusAtContextMenu() {
  return nodeOps.addBusAtContextMenu();
}

function pasteAtContextMenu() {
  return nodeOps.pasteAtContextMenu();
}

function addNodeAtContextMenu() {
  return nodeOps.addNodeAtContextMenu();
}

function toggleFullscreen() {
  if (!isFullscreen.value) {
    nonFullscreenCanvasHeight.value = canvasHeight.value;
    isFullscreen.value = true;
    nextTick(() => {
      syncFullscreenCanvasHeight();
    });
    closeContextMenu();
    return;
  }

  isFullscreen.value = !isFullscreen.value;
  canvasHeight.value = nonFullscreenCanvasHeight.value;
  closeContextMenu();
}

function openEcuMessageEditor(node) {
  if (!node?.id) return;
  ecuMessageEditor.ecuId = node.id;
  ecuMessageEditor.ecu = node;
  ecuMessageEditor.active = true;
  setStatus(`进入 ECU 报文编辑：${node.name}`);
  if (isFullscreen.value) {
    nextTick(() => {
      syncFullscreenCanvasHeight();
    });
  } else {
    const vh = window.innerHeight || document.documentElement.clientHeight || 900;
    const headerEl = document.querySelector('.can-arch-header');
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const topOffset = headerH + 160;
    const available = Math.floor(vh - topOffset);
    const h = Math.max(480, Math.min(available, 900));
    canvasHeight.value = h;
    editorPanelHeight.value = h;
  }
}

function closeEcuMessageEditor() {
  const name = ecuMessageEditor.ecu?.name || 'ECU';
  ecuMessageEditor.active = false;
  ecuMessageEditor.ecuId = '';
  ecuMessageEditor.ecu = null;
  setStatus(`已返回 CAN 画布（${name} 报文编辑已关闭）。`);
  if (isFullscreen.value) {
    nextTick(() => {
      syncFullscreenCanvasHeight();
    });
  }
}

function switchEcuInEditor(targetEcuId) {
  const node = nodes.value.find((item) => item.id === targetEcuId);
  if (!node) return;
  ecuMessageEditor.ecuId = node.id;
  ecuMessageEditor.ecu = node;
  setStatus(`切换到 ECU 报文编辑：${node.name}`);
}

function syncFullscreenCanvasHeight() {
  if (!isFullscreen.value) return;
  const editorEl = ecuMessageEditor.active ? ecuMessageEditorRef.value?.$el : null;
  const canvasElement = editorEl || canvasRef.value;
  if (!canvasElement) return;
  const bounds = canvasElement.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const available = Math.floor(viewportHeight - bounds.top - 10);
  const h = Math.max(320, available);
  canvasHeight.value = h;
  if (ecuMessageEditor.active) {
    editorPanelHeight.value = h;
  }
}

function onWindowResize() {
  if (!isFullscreen.value) return;
  syncFullscreenCanvasHeight();
}

function deleteSelectedNodes(options = {}) {
  return nodeOps.deleteSelectedNodes(options);
}

function deleteSelectedBus(options = {}) {
  return nodeOps.deleteSelectedBus(options);
}

function deleteSelected() {
  if (ecuMessageEditor.active) {
    ecuMessageEditorRef.value?.deleteSelection?.();
    return;
  }
  return nodeOps.deleteSelected();
}

function connectModules(fromRef, toRef, options = {}) {
  if (!fromRef?.type || !fromRef?.id || !toRef?.type || !toRef?.id) return false;
  if (fromRef.type === toRef.type && fromRef.id === toRef.id) return false;
  const isNodeBusPair = (fromRef.type === 'node' && toRef.type === 'bus') || (fromRef.type === 'bus' && toRef.type === 'node');
  if (!isNodeBusPair) return false;
  const exists = links.value.some((item) => {
    const fromType = item.fromType || 'node';
    const toType = item.toType || 'bus';
    const fromId = item.fromId || item.nodeId;
    const toId = item.toId || item.busId;
    const sameOrder = fromType === fromRef.type && fromId === fromRef.id && toType === toRef.type && toId === toRef.id;
    const reverseOrder = fromType === toRef.type && fromId === toRef.id && toType === fromRef.type && toId === fromRef.id;
    return sameOrder || reverseOrder;
  });
  if (exists) return false;

  const fromEdge = ['left', 'right', 'top', 'bottom'].includes(options?.fromAnchor?.edge) ? options.fromAnchor.edge : 'auto';
  const fromOffset = Number.isFinite(Number(options?.fromAnchor?.offset)) ? Math.max(0, Math.min(1, Number(options.fromAnchor.offset))) : 0.5;
  const toEdge = ['left', 'right', 'top', 'bottom'].includes(options?.toAnchor?.edge) ? options.toAnchor.edge : 'auto';
  const toOffset = Number.isFinite(Number(options?.toAnchor?.offset)) ? Math.max(0, Math.min(1, Number(options.toAnchor.offset))) : 0.5;
  const style = normalizeLinkStyle(options?.style || activeLinkStyle.value);
  const sourceNode = fromRef.type === 'node'
    ? nodes.value.find((item) => item.id === fromRef.id)
    : nodes.value.find((item) => item.id === toRef.id);
  const defaultProtocols = resolveNodeDefaultProtocols(sourceNode);
  const defaultJ1939Addresses = defaultProtocols.includes(canProtocols.J1939)
    ? resolveNodeDefaultJ1939Addresses(sourceNode)
    : [];
  const defaultCanopenNodeIds = defaultProtocols.includes(canProtocols.CANOPEN)
    ? resolveNodeDefaultCanopenNodeIds(sourceNode)
    : [];

  links.value.push({
    id: crypto.randomUUID(),
    fromType: fromRef.type,
    fromId: fromRef.id,
    toType: toRef.type,
    toId: toRef.id,
    fromAnchorEdge: fromEdge,
    fromAnchorOffset: fromOffset,
    toAnchorEdge: toEdge,
    toAnchorOffset: toOffset,
    style,
    protocols: [...defaultProtocols],
    j1939Addresses: [...defaultJ1939Addresses],
    canopenNodeIds: [...defaultCanopenNodeIds],
    anchors: [],
  });
  ensureControlAnchorsForLink(links.value[links.value.length - 1]);
  persistNodes();
  return true;
}

function toggleDraftProtocol(protocol, checked) {
  if (checked) {
    if (!draft.protocols.includes(protocol)) {
      draft.protocols = [...draft.protocols, protocol];
    }
    return;
  }
  draft.protocols = draft.protocols.filter((token) => token !== protocol);
}

function resetDraft() {
  syncDraftFromSelected();
}

function applyDraftToSelectedNode(manual = false) {
  const target = singleSelectedNode.value;
  if (!target) return;

  const result = validateCanNodeDraft(draft);
  formErrors.value = result.errors;
  formWarnings.value = result.warnings;

  if (result.errors.length > 0) {
    if (manual) {
      setStatus('节点属性校验失败，请先修正。', true);
    }
    return;
  }

  const duplicatedName = nodes.value.find(
    (item) => item.id !== target.id && item.name === result.normalized.name
  );
  if (duplicatedName) {
    formErrors.value = ['节点名称重复，请使用不同名称。'];
    if (manual) {
      setStatus('节点名称重复。', true);
    }
    return;
  }

  const normalizedBaseColor = normalizeNodeBaseColor(draft.baseColor);
  const changed = target.name !== result.normalized.name ||
    target.note !== result.normalized.note ||
    JSON.stringify(target.protocols) !== JSON.stringify(result.normalized.protocols) ||
    JSON.stringify(target.j1939Addresses) !== JSON.stringify(result.normalized.j1939Addresses) ||
    JSON.stringify(target.canopenNodeIds) !== JSON.stringify(result.normalized.canopenNodeIds) ||
    normalizeNodeBaseColor(target.baseColor) !== normalizedBaseColor;

  if (!changed) {
    if (manual) {
      setStatus('属性没有变化。');
    }
    return;
  }

  if (draftHistoryNodeId !== target.id) {
    pushHistorySnapshot();
    draftHistoryNodeId = target.id;
  }

  target.name = result.normalized.name;
  target.note = result.normalized.note;
  target.protocols = result.normalized.protocols;
  target.j1939Addresses = result.normalized.j1939Addresses;
  target.canopenNodeIds = result.normalized.canopenNodeIds;
  target.baseColor = normalizedBaseColor;
  target.updatedAt = nowIso();

  // ECU能力减少时，连线只做删减，不会补充新增协议或地址。
  pruneNodeConnectedLinkCapabilities(
    target.id,
    result.normalized.protocols,
    result.normalized.j1939Addresses,
    result.normalized.canopenNodeIds
  );

  persistNodes();
  if (manual) {
    setStatus(`已保存节点 ${target.name}`);
  }
}

function scheduleDraftAutoApply() {
  if (isSyncingDraft) return;
  if (!singleSelectedNode.value) return;
  stopDraftApplyTimer();
  draftApplyTimerId = window.setTimeout(() => {
    draftApplyTimerId = null;
    applyDraftToSelectedNode(false);
  }, 220);
}

function applyBusDraftToSelected() {
  const bus = singleSelectedBus.value;
  if (!bus) return;
  const normalizedName = String(busDraft.name || '').trim();
  if (!normalizedName) return;
  const normalizedBaud = Math.max(10, Math.round(Number(busDraft.baudRate) || DEFAULT_BUS_BAUD));
  const normalizedColor = normalizeBusColor(busDraft.color, bus.color);

  const duplicatedName = buses.value.find((item) => item.id !== bus.id && item.name === normalizedName);
  if (duplicatedName) return;

  const changed = bus.name !== normalizedName ||
    bus.baudRate !== normalizedBaud ||
    normalizeBusColor(bus.color) !== normalizedColor;
  if (!changed) return;

  if (busDraftHistoryBusId !== bus.id) {
    pushHistorySnapshot();
    busDraftHistoryBusId = bus.id;
  }

  bus.name = normalizedName;
  bus.baudRate = normalizedBaud;
  bus.color = normalizedColor;
  persistNodes();
}

function scheduleBusDraftAutoApply() {
  if (isSyncingBusDraft) return;
  if (!singleSelectedBus.value) return;
  if (busDraftApplyTimerId) {
    window.clearTimeout(busDraftApplyTimerId);
  }
  busDraftApplyTimerId = window.setTimeout(() => {
    busDraftApplyTimerId = null;
    applyBusDraftToSelected();
  }, 220);
}

function saveDraft() {
  applyDraftToSelectedNode(true);
}

function resolvePointerInCanvas(event) {
  const bounds = getCanvasBounds();
  if (!bounds) return null;
  const scrollLeft = canvasRef.value?.scrollLeft || 0;
  const scrollTop = canvasRef.value?.scrollTop || 0;
  return {
    x: (event.clientX - bounds.left + scrollLeft) / canvasZoom.value,
    y: (event.clientY - bounds.top + scrollTop) / canvasZoom.value,
  };
}

function resolveNodeEdgeAnchorFromPointer(node, pointer) {
  return geometryResolveNodeEdgeAnchorFromPointer(
    node,
    pointer,
    NODE_WIDTH,
    NODE_HEIGHT,
    NODE_EDGE_LINK_HIT_THRESHOLD,
  );
}

function onNodeLinkPointerDown(node, event, edgeAnchor = null) {
  if (event.button !== 0) return;
  const startAnchor = edgeAnchor || {
    edge: 'right',
    offset: 0.5,
    point: resolveNodeAnchorByEdge(node, 'right', 0.5),
  };
  linkDraftState = {
    fromType: 'node',
    fromId: node.id,
    pointerId: event.pointerId,
    fromAnchorEdge: startAnchor.edge,
    fromAnchorOffset: startAnchor.offset,
    start: { ...startAnchor.point },
    current: { ...startAnchor.point },
    pointerTarget: event.currentTarget,
  };
  bumpLinkDraftVersion();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onNodeLinkPointerMove);
  window.addEventListener('pointerup', onNodeLinkPointerUp);
  document.addEventListener('pointermove', onNodeLinkPointerMove);
  document.addEventListener('pointerup', onNodeLinkPointerUp);
}

function onNodeLinkPointerMove(event) {
  if (!linkDraftState || linkDraftState.pointerId !== event.pointerId) return;
  const point = resolvePointerInCanvas(event);
  if (!point) return;
  const fromRef = { type: linkDraftState.fromType, id: linkDraftState.fromId };
  const target = resolveDropTargetFromEvent(event, fromRef);
  linkDraftTarget.value = target;
  linkDraftState.current = { x: point.x, y: point.y };
  bumpLinkDraftVersion();
}

function clearNodeLinkDraft() {
  if (!linkDraftState) return;
  linkDraftState.pointerTarget?.releasePointerCapture?.(linkDraftState.pointerId);
  linkDraftState = null;
  bumpLinkDraftVersion();
  linkDraftTarget.value = null;
  linkHoverNodeEdge.nodeId = '';
  linkHoverNodeEdge.edge = '';
  linkHoverBusId.value = '';
  window.removeEventListener('pointermove', onNodeLinkPointerMove);
  window.removeEventListener('pointerup', onNodeLinkPointerUp);
  document.removeEventListener('pointermove', onNodeLinkPointerMove);
  document.removeEventListener('pointerup', onNodeLinkPointerUp);
}

function onNodeLinkPointerUp(event) {
  if (!linkDraftState || linkDraftState.pointerId !== event.pointerId) return;
  const fromRef = { type: linkDraftState.fromType, id: linkDraftState.fromId };
  const toRef = resolveDropTargetFromEvent(event, fromRef);
  const fromAnchorEdge = linkDraftState.fromAnchorEdge || 'auto';
  const fromAnchorOffset = Number.isFinite(Number(linkDraftState.fromAnchorOffset)) ? Number(linkDraftState.fromAnchorOffset) : 0.5;
  clearNodeLinkDraft();
  if (!toRef) {
    setStatus('未命中目标 CAN BUS / ECU，请拖到目标模块上再松手。', true);
    return;
  }
  pushHistorySnapshot();
  const created = connectModules(fromRef, toRef, {
    fromAnchor: {
      edge: fromAnchorEdge,
      offset: fromAnchorOffset,
    },
    style: activeLinkStyle.value,
  });
  if (!created) {
    setStatus('仅支持 ECU 与 CAN BUS 连线，且不允许重复。', true);
    return;
  }
  const target = resolveModuleByRef(toRef.type, toRef.id);
  const targetName = toRef.type === 'node' ? target?.name || 'ECU' : target?.name || 'CAN BUS';
  setStatus(`已建立连线到 ${targetName}。`);
}

function onCanvasWheel(event) {
  if (!event.ctrlKey) return;
  event.preventDefault();

  const canvasElement = canvasRef.value;
  const bounds = getCanvasBounds();
  if (!canvasElement || !bounds) return;

  const oldZoom = canvasZoom.value;
  const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
  const nextZoom = Math.min(2.5, Math.max(0.5, Number((oldZoom + zoomDelta).toFixed(2))));
  if (nextZoom === oldZoom) return;

  const offsetX = event.clientX - bounds.left;
  const offsetY = event.clientY - bounds.top;
  const logicalX = (offsetX + canvasElement.scrollLeft) / oldZoom;
  const logicalY = (offsetY + canvasElement.scrollTop) / oldZoom;

  canvasZoom.value = nextZoom;
  canvasElement.scrollLeft = Math.max(0, logicalX * nextZoom - offsetX);
  canvasElement.scrollTop = Math.max(0, logicalY * nextZoom - offsetY);
  setStatus(`画布缩放：${Math.round(nextZoom * 100)}%`);
}

function onCanvasResizePointerDown(event) {
  if (isFullscreen.value) return;
  if (event.button !== 0) return;

  const currentHeight = ecuMessageEditor.active
    ? Number(editorPanelHeight.value) || 620
    : Number(canvasHeight.value) || 620;

  canvasResizeState = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight: currentHeight,
    pointerTarget: event.currentTarget,
  };

  event.currentTarget?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onCanvasResizePointerMove);
  window.addEventListener('pointerup', onCanvasResizePointerUp);
  document.addEventListener('pointermove', onCanvasResizePointerMove);
  document.addEventListener('pointerup', onCanvasResizePointerUp);
}

function onCanvasResizePointerMove(event) {
  if (!canvasResizeState || canvasResizeState.pointerId !== event.pointerId) return;
  const dy = event.clientY - canvasResizeState.startY;
  const newHeight = Math.max(320, Math.round(canvasResizeState.startHeight + dy));
  canvasHeight.value = newHeight;
  if (ecuMessageEditor.active) {
    editorPanelHeight.value = newHeight;
  }
}

function onCanvasResizePointerUp(event) {
  if (!canvasResizeState) return;
  if (event && canvasResizeState.pointerId !== event.pointerId) return;

  canvasResizeState.pointerTarget?.releasePointerCapture?.(canvasResizeState.pointerId);
  canvasResizeState = null;
  window.removeEventListener('pointermove', onCanvasResizePointerMove);
  window.removeEventListener('pointerup', onCanvasResizePointerUp);
  document.removeEventListener('pointermove', onCanvasResizePointerMove);
  document.removeEventListener('pointerup', onCanvasResizePointerUp);
}

function onNodePointerDown(node, event) {
  if (dragState) {
    onDragPointerUp();
  }
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  closeContextMenu();
  linkHoverBusId.value = '';
  linkDraftTarget.value = null;
  selectedLinkId.value = '';
  if (selectedBusIds.value.length > 0) {
    clearBusSelection({ sync: false });
    syncBusDraftFromSelected();
  }

  const pointerPoint = resolvePointerInCanvas(event);
  const edgeAnchor = resolveNodeEdgeAnchorFromPointer(node, pointerPoint);
  if (edgeAnchor) {
    linkHoverNodeEdge.nodeId = node.id;
    linkHoverNodeEdge.edge = edgeAnchor.edge;
    if (!selectedIds.value.includes(node.id)) {
      selectedIds.value = [node.id];
      syncDraftFromSelected();
    }
    onNodeLinkPointerDown(node, event, edgeAnchor);
    return;
  }
  linkHoverNodeEdge.nodeId = '';
  linkHoverNodeEdge.edge = '';

  const additive = event.ctrlKey || event.metaKey;

  if (additive) {
    const exists = selectedIds.value.includes(node.id);
    if (exists) {
      selectedIds.value = selectedIds.value.filter((item) => item !== node.id);
    } else {
      selectedIds.value = [...selectedIds.value, node.id];
    }
    syncDraftFromSelected();
    return;
  }

  const isAlreadySelected = selectedIds.value.includes(node.id);
  if (!isAlreadySelected) {
    selectedIds.value = [node.id];
    syncDraftFromSelected();
  }

  const dragIds = selectedIds.value.includes(node.id) ? [...selectedIds.value] : [node.id];
  const startPoint = pointerPoint || resolvePointerInCanvas(event);
  if (!startPoint) return;

  const startMap = new Map();
  for (const id of dragIds) {
    const found = nodes.value.find((item) => item.id === id);
    if (!found) continue;
    startMap.set(id, { x: found.position.x, y: found.position.y });
  }

  dragState = {
    startX: startPoint.x,
    startY: startPoint.y,
    dragIds,
    startMap,
    pointerId: event.pointerId,
    pointerTarget: event.currentTarget,
    historyCaptured: false,
  };

  event.currentTarget?.setPointerCapture?.(event.pointerId);
  setStatus(`开始拖拽 ${node.name}`);

  window.addEventListener('pointermove', onDragPointerMove);
  window.addEventListener('pointerup', onDragPointerUp);
  document.addEventListener('pointermove', onDragPointerMove);
  document.addEventListener('pointerup', onDragPointerUp);
}

function onNodePointerMove(event) {
  if (dragState && dragState.pointerId === event.pointerId) {
    onDragPointerMove(event);
    return;
  }
  const nodeId = event.currentTarget?.getAttribute?.('data-node-id') || '';
  if (!nodeId) return;
  const node = nodes.value.find((item) => item.id === nodeId);
  if (!node) return;
  updateNodeEdgeHover(node, event);
}

function updateNodeEdgeHover(node, event) {
  if (dragState || linkDraftState || busDragState) return;
  const point = resolvePointerInCanvas(event);
  const edgeAnchor = resolveNodeEdgeAnchorFromPointer(node, point);
  if (edgeAnchor) {
    linkHoverNodeEdge.nodeId = node.id;
    linkHoverNodeEdge.edge = edgeAnchor.edge;
    return;
  }
  if (linkHoverNodeEdge.nodeId === node.id) {
    linkHoverNodeEdge.nodeId = '';
    linkHoverNodeEdge.edge = '';
  }
}

function onNodePointerLeave(node) {
  if (linkHoverNodeEdge.nodeId === node.id) {
    linkHoverNodeEdge.nodeId = '';
    linkHoverNodeEdge.edge = '';
  }
}

function onNodePointerUp(node, event) {
  if (event.button === 0 && dragState && dragState.pointerId === event.pointerId) {
    onDragPointerUp();
    return;
  }
  if (event.button !== 2) return;
  event.preventDefault();
  event.stopPropagation();
  onNodeContextMenu(node, event);
}

function onNodePointerCancel(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  onDragPointerUp();
}

function onNodeLostPointerCapture(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  onDragPointerUp();
}

function resolveBusRimAnchorFromPointer(bus, pointer) {
  if (!pointer) return null;
  const cx = bus.position.x + BUS_RADIUS;
  const cy = bus.position.y + BUS_RADIUS;
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < BUS_RADIUS - 16 || dist > BUS_RADIUS + 16) return null;
  const length = dist || 1;
  return {
    point: {
      x: cx + (dx / length) * BUS_RADIUS,
      y: cy + (dy / length) * BUS_RADIUS,
    },
  };
}

function onBusPointerDown(bus, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  closeContextMenu();
  linkHoverNodeEdge.nodeId = '';
  linkHoverNodeEdge.edge = '';
  linkDraftTarget.value = null;

  const pointerPoint = resolvePointerInCanvas(event);
  const rimAnchor = resolveBusRimAnchorFromPointer(bus, pointerPoint);
  if (rimAnchor) {
    selectedIds.value = [];
    setBusSelection([bus.id], { sync: false });
    selectedLinkId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
    linkDraftState = {
      fromType: 'bus',
      fromId: bus.id,
      pointerId: event.pointerId,
      fromAnchorEdge: 'auto',
      fromAnchorOffset: 0.5,
      start: { ...rimAnchor.point },
      current: { ...rimAnchor.point },
      pointerTarget: event.currentTarget,
    };
    bumpLinkDraftVersion();
    linkHoverBusId.value = bus.id;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onNodeLinkPointerMove);
    window.addEventListener('pointerup', onNodeLinkPointerUp);
    document.addEventListener('pointermove', onNodeLinkPointerMove);
    document.addEventListener('pointerup', onNodeLinkPointerUp);
    return;
  }

  const additive = event.ctrlKey || event.metaKey;
  if (additive) {
    const next = selectedBusIdSet.value.has(bus.id)
      ? selectedBusIds.value.filter((id) => id !== bus.id)
      : [...selectedBusIds.value, bus.id];
    setBusSelection(next, { sync: false });
    selectedIds.value = [];
    selectedLinkId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
    return;
  }

  selectBusOnly(bus.id);

  busDragState = {
    pointerId: event.pointerId,
    pointerTarget: event.currentTarget,
    busId: bus.id,
    startX: event.clientX,
    startY: event.clientY,
    originX: bus.position.x,
    originY: bus.position.y,
    moved: false,
    historyCaptured: false,
  };

  event.currentTarget?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onBusPointerMove);
  window.addEventListener('pointerup', onBusPointerUpCapture);
  document.addEventListener('pointermove', onBusPointerMove);
  document.addEventListener('pointerup', onBusPointerUpCapture);
}

function onBusPointerMove(event, busArg = null) {
  if (busDragState && busDragState.pointerId === event.pointerId) {
    const dx = event.clientX - busDragState.startX;
    const dy = event.clientY - busDragState.startY;
    if (!busDragState.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      busDragState.moved = true;
    }
    if (busDragState.moved && !busDragState.historyCaptured) {
      pushHistorySnapshot();
      busDragState.historyCaptured = true;
    }
    const bus = buses.value.find((item) => item.id === busDragState.busId);
    if (!bus) return;
    bus.position.x = Math.round(busDragState.originX + dx / canvasZoom.value);
    bus.position.y = Math.round(busDragState.originY + dy / canvasZoom.value);
    return;
  }

  if (linkDraftState || dragState) return;
  const bus = busArg || (() => {
    const busId = event.currentTarget?.getAttribute?.('data-bus-id') || '';
    return buses.value.find((item) => item.id === busId) || null;
  })();
  if (!bus) return;
  const point = resolvePointerInCanvas(event);
  const rimAnchor = resolveBusRimAnchorFromPointer(bus, point);
  if (rimAnchor) {
    linkHoverBusId.value = bus.id;
  } else if (linkHoverBusId.value === bus.id) {
    linkHoverBusId.value = '';
  }
}

function onBusPointerLeave(bus) {
  if (linkHoverBusId.value === bus.id) {
    linkHoverBusId.value = '';
  }
}

function finishBusDrag() {
  if (!busDragState) return;
  busDragState.pointerTarget?.releasePointerCapture?.(busDragState.pointerId);
  busDragState = null;
  persistNodes();
  window.removeEventListener('pointermove', onBusPointerMove);
  window.removeEventListener('pointerup', onBusPointerUpCapture);
  document.removeEventListener('pointermove', onBusPointerMove);
  document.removeEventListener('pointerup', onBusPointerUpCapture);
}

function onBusPointerUpCapture(event) {
  if (!busDragState || busDragState.pointerId !== event.pointerId) return;
  finishBusDrag();
}

function onBusPointerUp(bus, event) {
  if (event.button !== 2) return;
  event.preventDefault();
  event.stopPropagation();
  onBusContextMenu(bus, event);
}

function onBusPointerCancel(event) {
  if (!busDragState || busDragState.pointerId !== event.pointerId) return;
  finishBusDrag();
}

function onBusLostPointerCapture(event) {
  if (!busDragState || busDragState.pointerId !== event.pointerId) return;
  finishBusDrag();
}

function onBusContextMenu(bus, event) {
  if (!selectedBusIdSet.value.has(bus.id)) {
    selectBusOnly(bus.id);
  }
  const point = resolvePointerInCanvas(event);
  openContextMenuAt(event.clientX, event.clientY, 'bus', bus.id, point);
  setStatus(`已打开 CAN BUS 右键菜单：${bus.name}`);
}

function onDragPointerMove(event) {
  if (!dragState) return;
  const point = resolvePointerInCanvas(event);
  if (!point) return;

  const dx = point.x - dragState.startX;
  const dy = point.y - dragState.startY;

  if (!dragState.historyCaptured && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
    pushHistorySnapshot();
    dragState.historyCaptured = true;
  }

  for (const nodeId of dragState.dragIds) {
    const node = nodes.value.find((item) => item.id === nodeId);
    const start = dragState.startMap.get(nodeId);
    if (!node || !start) continue;

    node.position.x = Math.round(start.x + dx);
    node.position.y = Math.round(start.y + dy);
    node.updatedAt = nowIso();
  }
}

function onDragPointerUp() {
  if (!dragState) return;
  const movedCount = dragState.dragIds.length;
  dragState.pointerTarget?.releasePointerCapture?.(dragState.pointerId);
  dragState = null;
  persistNodes();
  setStatus(`已结束拖拽（${movedCount} 个 ECU）。`);
  window.removeEventListener('pointermove', onDragPointerMove);
  window.removeEventListener('pointerup', onDragPointerUp);
  document.removeEventListener('pointermove', onDragPointerMove);
  document.removeEventListener('pointerup', onDragPointerUp);
}

function onDragPointerCancel() {
  onDragPointerUp();
}

function rectFromPoints(a, b) {
  return geometryRectFromPoints(a, b);
}

function intersectsNode(rect, node) {
  return geometryIntersectsNode(rect, node, NODE_WIDTH, NODE_HEIGHT);
}

function intersectsBus(rect, bus) {
  return geometryIntersectsBus(rect, bus, BUS_RADIUS);
}

function onCanvasPointerDown(event) {
  if (isBoxSelecting.value || isPanning()) return;
  if (event.button !== 0) return;
  if (
    event.target?.closest?.('.can-node-item') ||
    event.target?.closest?.('.can-bus-item') ||
    event.target?.closest?.('.can-link-hit') ||
    event.target?.closest?.('.can-link-path') ||
    event.target?.closest?.('.can-link-anchor')
  ) return;

  const canvasElement = canvasRef.value;
  if (!canvasElement) return;

  event.preventDefault();
  closeContextMenu();
  selectedLinkId.value = '';
  linkHoverNodeEdge.nodeId = '';
  linkHoverNodeEdge.edge = '';
  linkHoverBusId.value = '';
  linkDraftTarget.value = null;

  if (event.shiftKey) {
    startBoxSelection(event);
    return;
  }

  startCanvasPan(event);
}

function onCanvasPointerUp(event) {
  if (event.button !== 2) return;
  if (event.target?.closest?.('.can-node-item') || event.target?.closest?.('.can-bus-item')) return;
  event.preventDefault();
  openCanvasContextMenu(event);
}

function onCanvasLostPointerCapture(event) {
  onCanvasPanLostCapture(event);
}

function onCanvasPointerCancel() {
  onCanvasPanPointerCancel();
}

function onDocumentContextMenuCapture(event) {
  if (!props.active) return;
  const canvasElement = canvasRef.value;
  if (!canvasElement) return;

  const target = event.target;
  if (!canvasElement.contains(target)) return;

  const anchorElement = target?.closest?.('.can-link-anchor');
  if (anchorElement) {
    event.preventDefault();
    event.stopPropagation();
    const linkId = anchorElement.getAttribute('data-link-id');
    const anchorIndex = Number.parseInt(anchorElement.getAttribute('data-anchor-index') || '-1', 10);
    const link = links.value.find((item) => item.id === linkId);
    if (link && Number.isInteger(anchorIndex) && anchorIndex >= 0) {
      onLinkAnchorContextMenu(link, anchorIndex, event);
      return;
    }
  }

  const linkElement = target?.closest?.('.can-link-hit');
  if (linkElement) {
    event.preventDefault();
    event.stopPropagation();
    const linkId = linkElement.getAttribute('data-link-id');
    const link = links.value.find((item) => item.id === linkId);
    if (link) {
      onLinkContextMenu(link, event);
      return;
    }
  }

  const nodeElement = target?.closest?.('.can-node-item');
  if (nodeElement) {
    event.preventDefault();
    event.stopPropagation();
    const nodeId = nodeElement.getAttribute('data-node-id');
    const node = nodes.value.find((item) => item.id === nodeId);
    if (node) {
      onNodeContextMenu(node, event);
    }
    return;
  }

  const busElement = target?.closest?.('.can-bus-item');
  if (busElement) {
    event.preventDefault();
    event.stopPropagation();
    const busId = busElement.getAttribute('data-bus-id');
    const bus = buses.value.find((item) => item.id === busId);
    if (bus) {
      onBusContextMenu(bus, event);
    }
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  openCanvasContextMenu(event);
}

function resolveLinkNodeId(link) {
  const fromType = link?.fromType || 'node';
  const toType = link?.toType || 'bus';
  const fromId = link?.fromId || link?.nodeId;
  const toId = link?.toId || link?.busId;
  if (fromType === 'node') return fromId;
  if (toType === 'node') return toId;
  return '';
}

function resolveLinkBusId(link) {
  const fromType = link?.fromType || 'node';
  const toType = link?.toType || 'bus';
  const fromId = link?.fromId || link?.nodeId;
  const toId = link?.toId || link?.busId;
  if (fromType === 'bus') return fromId;
  if (toType === 'bus') return toId;
  return '';
}

function mergeProjection(map, node, protocolsInput, j1939Input, canopenInput) {
  if (!node?.id) return;
  if (!map.has(node.id)) {
    map.set(node.id, {
      node,
      protocols: new Set(),
      j1939Addresses: new Set(),
      canopenNodeIds: new Set(),
    });
  }

  const entry = map.get(node.id);
  const protocols = normalizeProtocolsList(protocolsInput);
  const j1939Addresses = normalizeIntegerList(j1939Input);
  const canopenNodeIds = normalizeIntegerList(canopenInput);
  for (const protocol of protocols) {
    entry.protocols.add(protocol);
  }
  for (const address of j1939Addresses) {
    entry.j1939Addresses.add(address);
  }
  for (const nodeId of canopenNodeIds) {
    entry.canopenNodeIds.add(nodeId);
  }
}

function buildProjectionFromNode(map, node) {
  if (!node) return;
  const protocols = resolveNodeDefaultProtocols(node);
  const j1939Addresses = protocols.includes(canProtocols.J1939)
    ? resolveNodeDefaultJ1939Addresses(node)
    : [];
  const canopenNodeIds = protocols.includes(canProtocols.CANOPEN)
    ? resolveNodeDefaultCanopenNodeIds(node)
    : [];
  mergeProjection(map, node, protocols, j1939Addresses, canopenNodeIds);
}

function buildProjectionFromLink(map, link) {
  if (!link) return;
  const nodeId = resolveLinkNodeId(link);
  if (!nodeId) return;
  const node = nodes.value.find((item) => item.id === nodeId);
  if (!node) return;

  const storedProtocols = normalizeProtocolsList(link.protocols);
  const protocols = storedProtocols.length > 0
    ? normalizeLinkProtocolsByNode(link, storedProtocols)
    : resolveLinkDefaultProtocols(link);

  let j1939Addresses = normalizeLinkJ1939AddressesByNode(link, protocols, link.j1939Addresses);
  let canopenNodeIds = normalizeLinkCanopenNodeIdsByNode(link, protocols, link.canopenNodeIds);

  if (storedProtocols.length === 0 && protocols.includes(canProtocols.J1939) && j1939Addresses.length === 0) {
    j1939Addresses = resolveLinkAllowedJ1939Addresses(link);
  }
  if (storedProtocols.length === 0 && protocols.includes(canProtocols.CANOPEN) && canopenNodeIds.length === 0) {
    canopenNodeIds = resolveLinkAllowedCanopenNodeIds(link);
  }

  mergeProjection(map, node, protocols, j1939Addresses, canopenNodeIds);
}

function finalizeProjectionMap(projections) {
  return [...projections.values()].map((entry) => {
    const protocols = [...entry.protocols];
    const finalProtocols = protocols.length > 0 ? protocols : [canProtocols.GENERIC_STD];
    const includesJ1939 = finalProtocols.includes(canProtocols.J1939);
    const includesCanopen = finalProtocols.includes(canProtocols.CANOPEN);
    return {
      ...entry.node,
      protocols: finalProtocols,
      j1939Addresses: includesJ1939 ? [...entry.j1939Addresses] : [],
      canopenNodeIds: includesCanopen ? [...entry.canopenNodeIds] : [],
    };
  });
}

function buildExportNodeProjections() {
  const projections = new Map();
  const selectedNodeSet = new Set(selectedIds.value);
  for (const node of nodes.value) {
    if (!selectedNodeSet.has(node.id)) continue;
    buildProjectionFromNode(projections, node);
  }

  if (selectedLinkId.value) {
    const link = links.value.find((item) => item.id === selectedLinkId.value);
    buildProjectionFromLink(projections, link);
  }

  if (selectedBusIds.value.length > 0) {
    const busSet = new Set(selectedBusIds.value);
    for (const link of links.value) {
      if (!busSet.has(resolveLinkBusId(link))) continue;
      buildProjectionFromLink(projections, link);
    }
  }

  return finalizeProjectionMap(projections);
}

function collectExportCandidateBusIds() {
  const busSet = new Set();
  const ordered = [];
  const pushBusId = (busId) => {
    if (!busId || busSet.has(busId)) return;
    if (!buses.value.find((item) => item.id === busId)) return;
    busSet.add(busId);
    ordered.push(busId);
  };

  for (const busId of selectedBusIds.value) {
    pushBusId(busId);
  }

  if (selectedLinkId.value) {
    const link = links.value.find((item) => item.id === selectedLinkId.value);
    pushBusId(resolveLinkBusId(link));
  }

  if (selectedIds.value.length > 0) {
    const selectedNodeSet = new Set(selectedIds.value);
    for (const link of links.value) {
      const nodeId = resolveLinkNodeId(link);
      if (!selectedNodeSet.has(nodeId)) continue;
      pushBusId(resolveLinkBusId(link));
    }
  }

  return ordered;
}

function buildExportNodeProjectionsForBus(busId) {
  if (!busId) return [];
  const projections = new Map();
  const selectedNodeSet = new Set(selectedIds.value);
  const selectedBusSet = new Set(selectedBusIds.value);
  const selectedLink = selectedLinkId.value
    ? links.value.find((item) => item.id === selectedLinkId.value)
    : null;

  for (const link of links.value) {
    const linkBusId = resolveLinkBusId(link);
    if (linkBusId !== busId) continue;
    const linkNodeId = resolveLinkNodeId(link);
    const fromSelectedBus = selectedBusSet.has(busId);
    const fromSelectedNode = selectedNodeSet.has(linkNodeId);
    const fromSelectedLink = Boolean(selectedLink && selectedLink.id === link.id);
    if (!fromSelectedBus && !fromSelectedNode && !fromSelectedLink) continue;
    buildProjectionFromLink(projections, link);
  }

  for (const node of nodes.value) {
    if (!selectedNodeSet.has(node.id)) continue;
    const touchesBus = links.value.some((link) => resolveLinkNodeId(link) === node.id && resolveLinkBusId(link) === busId);
    if (!touchesBus) continue;
    if (!projections.has(node.id)) {
      buildProjectionFromNode(projections, node);
    }
  }

  return finalizeProjectionMap(projections);
}

function buildDbcExportBusGroups() {
  const busIds = collectExportCandidateBusIds();
  const groups = [];

  for (const busId of busIds) {
    const bus = buses.value.find((item) => item.id === busId);
    if (!bus) continue;
    const exportNodes = buildExportNodeProjectionsForBus(busId);
    if (exportNodes.length === 0) continue;
    const { j1939Nodes, otherNodes } = splitExportNodesByProtocol(exportNodes);
    groups.push({
      busId,
      busName: bus.name,
      exportNodes,
      j1939Nodes,
      otherNodes,
      nodeCount: exportNodes.length,
      j1939Count: j1939Nodes.length,
      otherCount: otherNodes.length,
      hasJ1939: j1939Nodes.length > 0,
      hasOthers: otherNodes.length > 0,
      requiresProtocolSelection: j1939Nodes.length > 0 && otherNodes.length > 0,
      selected: true,
      includeJ1939: j1939Nodes.length > 0,
      includeOthers: otherNodes.length > 0,
      j1939Mode: 'dedicated',
    });
  }

  return groups;
}

function sanitizeFilenamePart(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || 'bus';
}



function downgradeJ1939NodesToStandard(nodesInput) {
  const list = Array.isArray(nodesInput) ? nodesInput : [];
  return list.map((node) => ({
    ...node,
    protocols: [canProtocols.GENERIC_EXT],
    j1939Addresses: [],
    canopenNodeIds: [],
  }));
}

function mergeStandardExportNodes(baseNodes, addonNodes) {
  const merged = new Map();
  const pushNode = (node) => {
    if (!node?.id) return;
    if (!merged.has(node.id)) {
      merged.set(node.id, {
        ...node,
        protocols: normalizeProtocolsList(node.protocols),
        j1939Addresses: [],
        canopenNodeIds: normalizeIntegerList(node.canopenNodeIds),
      });
      return;
    }
    const current = merged.get(node.id);
    current.protocols = [...new Set([
      ...normalizeProtocolsList(current.protocols),
      ...normalizeProtocolsList(node.protocols),
    ])];
    current.canopenNodeIds = [...new Set([
      ...normalizeIntegerList(current.canopenNodeIds),
      ...normalizeIntegerList(node.canopenNodeIds),
    ])];
  };

  for (const node of Array.isArray(baseNodes) ? baseNodes : []) {
    pushNode(node);
  }
  for (const node of Array.isArray(addonNodes) ? addonNodes : []) {
    pushNode(node);
  }
  return [...merged.values()].map((node) => ({
    ...node,
    protocols: node.protocols.length > 0 ? node.protocols : [canProtocols.GENERIC_STD],
  }));
}

function executeDbcExport(j1939Nodes, otherNodes, options = {}) {
  const includeJ1939 = options.includeJ1939 !== false;
  const includeOthers = options.includeOthers !== false;
  const j1939Mode = options.j1939Mode === 'downgrade' ? 'downgrade' : 'dedicated';
  const silentStatus = options.silentStatus === true;
  const dateTag = options.dateTag || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filenameBase = options.filenameBase || `can-arch-nodes-${dateTag}`;
  const canExportJ1939 = includeJ1939 && j1939Nodes.length > 0;
  const canExportOthers = includeOthers && otherNodes.length > 0;
  if (!canExportJ1939 && !canExportOthers) {
    if (!silentStatus) {
      setStatus('请至少选择一种协议导出。', true);
    }
    return null;
  }

  let exportedFiles = 0;

  if (canExportJ1939 && j1939Mode === 'downgrade') {
    const downgradedJ1939Nodes = downgradeJ1939NodesToStandard(j1939Nodes);
    const mergedNodes = mergeStandardExportNodes(
      canExportOthers ? otherNodes : [],
      downgradedJ1939Nodes,
    );
    const dbc = serializeNodesToDbc(mergedNodes, { profile: 'standard' });
    downloadTextFile(`${filenameBase}.dbc`, dbc);
    exportedFiles = 1;
    const mergedNodeCount = new Set(mergedNodes.map((item) => item.id)).size;
    if (!silentStatus) {
      setStatus(`已导出 1 个普通 DBC 文件（J1939 已退化），覆盖 ${mergedNodeCount} 个 ECU。`);
    }
    return {
      exportedFiles,
      exportedNodeIds: [...new Set(mergedNodes.map((item) => item.id))],
    };
  }

  const hasBothDedicated = canExportJ1939 && canExportOthers;
  if (canExportJ1939) {
    const dbc = serializeNodesToDbc(j1939Nodes, { profile: 'j1939' });
    const filename = hasBothDedicated
      ? `${filenameBase}-j1939.dbc`
      : `${filenameBase}.dbc`;
    downloadTextFile(filename, dbc);
    exportedFiles += 1;
  }

  if (canExportOthers) {
    const dbc = serializeNodesToDbc(otherNodes, { profile: 'standard' });
    const filename = hasBothDedicated
      ? `${filenameBase}-other.dbc`
      : `${filenameBase}.dbc`;
    downloadTextFile(filename, dbc);
    exportedFiles += 1;
  }

  const exportedNodes = new Set([
    ...j1939Nodes.map((item) => item.id),
    ...otherNodes.map((item) => item.id),
  ]).size;
  if (!silentStatus) {
    setStatus(`已导出 ${exportedFiles} 个 DBC 文件，覆盖 ${exportedNodes} 个 ECU。`);
  }
  return {
    exportedFiles,
    exportedNodeIds: [...new Set([
      ...j1939Nodes.map((item) => item.id),
      ...otherNodes.map((item) => item.id),
    ])],
  };
}

function confirmDbcExportSelection() {
  if (pendingDbcExport.busGroups.length > 0) {
    const selectedGroups = pendingDbcExport.busGroups.filter((group) => group.selected);
    if (selectedGroups.length === 0) {
      setStatus('请至少勾选一个 CAN BUS 导出。', true);
      return;
    }

    const invalidGroup = selectedGroups.find((group) => !group.includeJ1939 && !group.includeOthers);
    if (invalidGroup) {
      setStatus(`CAN BUS ${invalidGroup.busName} 未选择导出协议，请先选择协议或取消该 BUS。`, true);
      return;
    }

    const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    let exportedFiles = 0;
    const exportedNodeIds = new Set();
    for (const group of selectedGroups) {
      if (!group.includeJ1939 && !group.includeOthers) continue;
      const filenameBase = `can-arch-${sanitizeFilenamePart(group.busName)}-${dateTag}`;
      const result = executeDbcExport(group.j1939Nodes, group.otherNodes, {
        includeJ1939: group.includeJ1939,
        includeOthers: group.includeOthers,
        j1939Mode: group.j1939Mode,
        silentStatus: true,
        filenameBase,
        dateTag,
      });
      if (!result) continue;
      exportedFiles += result.exportedFiles;
      for (const nodeId of result.exportedNodeIds) {
        exportedNodeIds.add(nodeId);
      }
    }

    if (exportedFiles === 0) {
      setStatus('勾选的 CAN BUS 在当前协议组合下没有可导出内容。', true);
      return;
    }

    setStatus(`已按 ${selectedGroups.length} 个 CAN BUS 导出 ${exportedFiles} 个 DBC 文件，覆盖 ${exportedNodeIds.size} 个 ECU。`);
    closeDbcExportModal();
    return;
  }

  const result = executeDbcExport(
    pendingDbcExport.j1939Nodes,
    pendingDbcExport.otherNodes,
    {
      includeJ1939: dbcExportSelection.includeJ1939,
      includeOthers: dbcExportSelection.includeOthers,
      j1939Mode: dbcExportSelection.j1939Mode,
    }
  );
  if (!result) return;
  closeDbcExportModal();
}

function exportSelectedNodesFromContextMenu() {
  closeContextMenu();
  exportSelectedNodes();
}

function exportSelectedNodes() {
  const busGroups = buildDbcExportBusGroups();
  if (busGroups.length > 1) {
    openDbcExportForBusGroups(busGroups);
    return;
  }

  if (busGroups.length === 1) {
    const [group] = busGroups;
    if (group.hasJ1939) {
      openDbcExportForBusGroups(busGroups);
      return;
    }
  }

  const exportNodes = buildExportNodeProjections();
  if (exportNodes.length === 0) {
    setStatus('请先选中至少一个 ECU、CAN BUS 或连线再导出。', true);
    return;
  }

  const { j1939Nodes, otherNodes } = splitExportNodesByProtocol(exportNodes);
  if (j1939Nodes.length > 0 && otherNodes.length > 0) {
    openDbcExportForProtocolSplit(j1939Nodes, otherNodes);
    return;
  }

  executeDbcExport(j1939Nodes, otherNodes, {
    includeJ1939: true,
    includeOthers: true,
    j1939Mode: 'dedicated',
  });
}

function openImportPicker() {
  importInputRef.value?.click();
}

function triggerImportDialog() {
  importStage.value = 'choose';
  importCandidates.value = [];
  importTarget.connectionMode = buses.value.length > 0 ? 'existing' : 'new';
  importTarget.busId = selectedBusIds.value[0] || selectedBusId.value || buses.value[0]?.id || '';
  importTarget.newBusName = createBusName(new Set(buses.value.map((item) => item.name)));
  importReviewState.newExpanded = true;
  importReviewState.conflictExpanded = true;
  importModalOpen.value = true;
  closeContextMenu();
}

function closeImportModal() {
  importModalOpen.value = false;
  importCandidates.value = [];
  importStage.value = 'choose';
  importTarget.connectionMode = buses.value.length > 0 ? 'existing' : 'new';
  importTarget.busId = '';
  importTarget.newBusName = '';
  importReviewState.newExpanded = true;
  importReviewState.conflictExpanded = true;
}

function candidateDisplayName(candidate) {
  if (candidate.resolveMode === 'create' && candidate.conflict) {
    return String(candidate.rename || '').trim();
  }
  return String(candidate.name || '').trim();
}

function ensureUniqueName(baseName, usedNames) {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  let index = 2;
  while (usedNames.has(`${baseName}_${index}`)) {
    index += 1;
  }
  const name = `${baseName}_${index}`;
  usedNames.add(name);
  return name;
}

function buildImportTargetBus() {
  if (importTarget.connectionMode === 'existing') {
    const bus = buses.value.find((item) => item.id === importTarget.busId);
    if (!bus) return { error: '请选择一个已有 CAN BUS。' };
    return { busId: bus.id, busName: bus.name, createNewBus: false };
  }

  const requestedName = String(importTarget.newBusName || '').trim();
  if (!requestedName) {
    return { error: '新建 CAN BUS 名称不能为空。' };
  }

  const existingNames = new Set(buses.value.map((item) => item.name));
  const busName = ensureUniqueName(requestedName, existingNames);
  return { busId: '', busName, createNewBus: true };
}

function createImportLink(nodeId, busId, candidate) {
  const protocols = normalizeProtocolsList(candidate.protocols);
  const finalProtocols = protocols.length > 0 ? protocols : [canProtocols.GENERIC_STD];
  const j1939Addresses = finalProtocols.includes(canProtocols.J1939)
    ? normalizeIntegerList(candidate.j1939Addresses)
    : [];
  const canopenNodeIds = finalProtocols.includes(canProtocols.CANOPEN)
    ? normalizeIntegerList(candidate.canopenNodeIds)
    : [];

  links.value.push({
    id: crypto.randomUUID(),
    fromType: 'node',
    fromId: nodeId,
    toType: 'bus',
    toId: busId,
    fromAnchorEdge: 'auto',
    fromAnchorOffset: 0.5,
    toAnchorEdge: 'auto',
    toAnchorOffset: 0.5,
    style: normalizeLinkStyle(activeLinkStyle.value),
    protocols: [...finalProtocols],
    j1939Addresses: [...j1939Addresses],
    canopenNodeIds: [...canopenNodeIds],
    anchors: [],
  });
  ensureControlAnchorsForLink(links.value[links.value.length - 1]);
}

function findNodeBusLink(nodeId, busId) {
  return links.value.find((link) => resolveLinkNodeId(link) === nodeId && resolveLinkBusId(link) === busId) || null;
}

function mergeCandidateIntoNode(node, candidate) {
  if (!node || !candidate) return;
  const mergedProtocols = [...new Set([
    ...normalizeProtocolsList(node.protocols),
    ...normalizeProtocolsList(candidate.protocols),
  ])];
  const finalProtocols = mergedProtocols.length > 0 ? mergedProtocols : [canProtocols.GENERIC_STD];
  const hasJ1939 = finalProtocols.includes(canProtocols.J1939);
  const hasCanopen = finalProtocols.includes(canProtocols.CANOPEN);

  node.protocols = finalProtocols;
  node.j1939Addresses = hasJ1939
    ? [...new Set([
      ...normalizeIntegerList(node.j1939Addresses),
      ...normalizeIntegerList(candidate.j1939Addresses),
    ])]
    : [];
  node.canopenNodeIds = hasCanopen
    ? [...new Set([
      ...normalizeIntegerList(node.canopenNodeIds),
      ...normalizeIntegerList(candidate.canopenNodeIds),
    ])]
    : [];
  node.updatedAt = nowIso();
}

function mergeCandidateIntoLink(link, candidate) {
  if (!link || !candidate) return;
  const mergedProtocols = [...new Set([
    ...normalizeProtocolsList(link.protocols),
    ...normalizeProtocolsList(candidate.protocols),
  ])];
  const finalProtocols = mergedProtocols.length > 0 ? mergedProtocols : [canProtocols.GENERIC_STD];
  const hasJ1939 = finalProtocols.includes(canProtocols.J1939);
  const hasCanopen = finalProtocols.includes(canProtocols.CANOPEN);

  link.protocols = finalProtocols;
  link.j1939Addresses = hasJ1939
    ? [...new Set([
      ...normalizeIntegerList(link.j1939Addresses),
      ...normalizeIntegerList(candidate.j1939Addresses),
    ])]
    : [];
  link.canopenNodeIds = hasCanopen
    ? [...new Set([
      ...normalizeIntegerList(link.canopenNodeIds),
      ...normalizeIntegerList(candidate.canopenNodeIds),
    ])]
    : [];
}

function upsertImportLink(nodeId, busId, candidate) {
  const existed = findNodeBusLink(nodeId, busId);
  if (!existed) {
    createImportLink(nodeId, busId, candidate);
    return;
  }
  mergeCandidateIntoLink(existed, candidate);
}

function confirmImportCandidates() {
  const selected = importCandidates.value.filter((item) => item.selected);
  if (selected.length === 0) {
    setStatus('未选择任何节点导入。', true);
    return;
  }

  const target = buildImportTargetBus();
  if (target.error) {
    setStatus(target.error, true);
    return;
  }

  pushHistorySnapshot();
  const usedNames = new Set(nodes.value.map((node) => node.name));
  let targetBusId = target.busId;
  if (target.createNewBus) {
    const newBus = {
      id: crypto.randomUUID(),
      name: target.busName,
      baudRate: DEFAULT_BUS_BAUD,
      color: normalizeBusColor(BUS_COLOR_POOL[buses.value.length % BUS_COLOR_POOL.length]),
      position: nextBusPosition(),
    };
    buses.value.push(newBus);
    targetBusId = newBus.id;
  }

  let importedCount = 0;
  let mergedCount = 0;

  for (const candidate of selected) {
    if (candidate.resolveMode === 'merge') {
      const mergeNodeName = resolveCandidateMergeNodeName(candidate);
      if (!mergeNodeName) {
        setStatus('存在合并项未选择目标 ECU。', true);
        return;
      }
      const existingNode = nodes.value.find((node) => node.name === mergeNodeName);
      if (!existingNode) {
        setStatus(`未找到要合并的 ECU：${mergeNodeName}。`, true);
        return;
      }
      mergeCandidateIntoNode(existingNode, candidate);
      upsertImportLink(existingNode.id, targetBusId, candidate);
      mergedCount += 1;
      continue;
    }

    const baseName = candidateDisplayName(candidate);
    if (!baseName) {
      setStatus('存在空节点名，请先填写重命名。', true);
      return;
    }

    const name = ensureUniqueName(baseName, usedNames);
    const newNode = {
      id: crypto.randomUUID(),
      name,
      note: '',
      position: nextNodePosition(),
      protocols: [...candidate.protocols],
      j1939Addresses: [...candidate.j1939Addresses],
      canopenNodeIds: [...candidate.canopenNodeIds],
      baseColor: normalizeNodeBaseColor(candidate.baseColor),
      source: 'dbc-import',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    nodes.value.push(newNode);
    upsertImportLink(newNode.id, targetBusId, candidate);
    importedCount += 1;
  }

  setBusSelection([targetBusId], { sync: false });
  selectedIds.value = [];
  selectedLinkId.value = '';
  syncDraftFromSelected();
  syncBusDraftFromSelected();
  persistNodes();
  closeImportModal();
  setStatus(`已导入新增 ${importedCount} 个，合并 ${mergedCount} 个，并连接到 CAN BUS：${target.busName}。`);
}

async function handleDbcFileChosen(event) {
  const input = event.target;
  const file = input?.files?.[0];
  input.value = '';

  if (!file) return;

  await importDbcFile(file);
}

async function handleImportDrop(event) {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;

  await importDbcFile(file);
}

async function importDbcFile(file) {

  try {
    const text = await file.text();
    const parsed = parseDbcNodes(text);
    if (parsed.length === 0) {
      setStatus('未识别到 BU_ 节点，请检查 DBC 文件。', true);
      return;
    }

    importCandidates.value = buildImportCandidatesFromParsed(parsed);

    importStage.value = 'review';
    importTarget.connectionMode = buses.value.length > 0 ? 'existing' : 'new';
    importTarget.busId = selectedBusIds.value[0] || selectedBusId.value || buses.value[0]?.id || '';
    importTarget.newBusName = createBusName(new Set(buses.value.map((item) => item.name)));
    importReviewState.newExpanded = true;
    importReviewState.conflictExpanded = true;
    importModalOpen.value = true;
    setStatus(`解析成功，识别到 ${parsed.length} 个节点。`);
  } catch (error) {
    setStatus(`DBC 解析失败: ${error?.message || error}`, true);
  }
}

function handleDocumentKeydown(event) {
  if (!props.active) return;
  if (ecuMessageEditor.active) return;
  const target = event.target;
  const tagName = String(target?.tagName || '').toLowerCase();
  const editable = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;

  const isToggleFullscreen = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f';
  if (isToggleFullscreen) {
    event.preventDefault();
    toggleFullscreen();
    return;
  }

  if (editable) return;

  const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
  const isRedoY = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y';
  const isRedoShiftZ = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z';
  const isCopy = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'c';
  const isPaste = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'v';

  if (isCopy) {
    event.preventDefault();
    copyCurrentSelection();
    return;
  }

  if (isPaste) {
    event.preventDefault();
    pasteClipboard();
    return;
  }

  if (isUndo) {
    event.preventDefault();
    undoNodes();
    return;
  }

  if (isRedoY || isRedoShiftZ) {
    event.preventDefault();
    redoNodes();
    return;
  }

  if (event.key === 'Delete') {
    if (hasAnySelectionForDelete.value) {
      event.preventDefault();
      deleteSelected();
      return;
    }
  }

  if (event.key === 'Escape') {
    if (isFullscreen.value) {
      event.preventDefault();
      toggleFullscreen();
      return;
    }
    closeContextMenu();
  }
}

onMounted(() => {
  loadNodes();
  startAutoSaveTimer();
  setStatus('CAN 节点设计器已就绪。');
  window.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('keydown', handleDocumentKeydown);
  window.addEventListener('pointer.cancel', onDragPointerCancel);
  window.addEventListener('blur', onDragPointerCancel);
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('contextmenu', onDocumentContextMenuCapture, true);
  deleteKeyBound = true;
  initMagneticHeader();
});

onBeforeUnmount(() => {
  onDragPointerUp();
  finishBusDrag();
  onLinkAnchorPointerUp();
  clearNodeLinkDraft();
  stopCanvasPan();
  onCanvasResizePointerUp();
  stopBoxSelection();
  closeContextMenu();
  stopAutoSaveTimer();
  stopDraftApplyTimer();
  if (busDraftApplyTimerId) {
    window.clearTimeout(busDraftApplyTimerId);
    busDraftApplyTimerId = null;
  }
  if (deleteKeyBound) {
    window.removeEventListener('keydown', handleDocumentKeydown);
    deleteKeyBound = false;
  }
  window.removeEventListener('pointerdown', onDocumentPointerDown);
  window.removeEventListener('pointer.cancel', onDragPointerCancel);
  window.removeEventListener('blur', onDragPointerCancel);
  window.removeEventListener('resize', onWindowResize);
  document.removeEventListener('contextmenu', onDocumentContextMenuCapture, true);
  teardownMagneticHeader();
});

watch(
  () => props.active,
  (active, previousActive) => {
    if (active && !previousActive && !deleteKeyBound) {
      window.addEventListener('keydown', handleDocumentKeydown);
      deleteKeyBound = true;
    }
    if (!active && previousActive) {
      closeContextMenu();
    }
  }
);

watch(
  () => [
    draft.name,
    draft.note,
    draft.j1939AddressesInput,
    draft.canopenNodeIdsInput,
    draft.baseColor,
    draft.protocols.join('|'),
  ],
  () => {
    scheduleDraftAutoApply();
  }
);

watch(
  () => [busDraft.name, busDraft.baudRate, busDraft.color],
  () => {
    scheduleBusDraftAutoApply();
  }
);

watch(
  () => selectedLinkId.value,
  () => {
    syncLinkEditorFromSelected();
  }
);

watch(
  () => singleSelectedLink.value?.style,
  (style) => {
    if (!style || isSyncingLinkEditor) return;
    const normalized = normalizeLinkStyle(style);
    linkEditor.style = normalized;
    activeLinkStyle.value = normalized;
  }
);

watch(
  () => linkEditor.style,
  (style) => {
    if (isSyncingLinkEditor) return;
    setSelectedLinkStyle(style, {
      updateToolbar: true,
      showStatus: false,
    });
  }
);

watch(
  () => linkEditor.protocols.join('|'),
  () => {
    if (isSyncingLinkEditor) return;
    setSelectedLinkProtocols(linkEditor.protocols, {
      showStatus: false,
    });
  }
);

watch(
  () => [linkEditor.j1939AddressesInput, linkEditor.canopenNodeIdsInput],
  () => {
    if (isSyncingLinkEditor) return;
    setSelectedLinkAddresses(linkEditor.j1939AddressesInput, linkEditor.canopenNodeIdsInput, {
      showStatus: false,
    });
  }
);

useJ1939ModuleInit();
</script>