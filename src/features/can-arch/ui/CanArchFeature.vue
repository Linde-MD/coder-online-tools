<template>
  <section id="feature-can-arch" class="feature-panel" :class="panelClassList">
    <div class="can-arch-panel container-xl">
      <div class="can-arch-header">
        <div>
          <h2 class="can-arch-title">CAN 架构设计器</h2>
          <p class="can-arch-note mb-0">当前版本聚焦 ECU 建模：拖拽布局、协议配置、DBC 节点导入导出。</p>
        </div>
        <div class="can-arch-toolbar-wrap">
          <div class="can-arch-menubar" @click.stop>
            <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('file')">文件</button>
            <span class="can-menu-sep"></span>
            <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('edit')">编辑</button>
            <span class="can-menu-sep"></span>
            <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('view')">视图</button>
            <span class="can-menu-sep"></span>
            <button class="can-menu-text-btn" type="button" @click="toggleTopMenu('export')">导出</button>

            <div v-if="activeTopMenu === 'file'" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" @click="runMenuAction(triggerImportDialog)">导入 DBC</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(triggerConfigImportDialog)">导入架构 JSON</button>
            </div>

            <div v-if="activeTopMenu === 'edit'" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" :disabled="!canUndo" @click="runMenuAction(undoNodes)">撤销</button>
              <button class="can-top-menu-item" type="button" :disabled="!canRedo" @click="runMenuAction(redoNodes)">重做</button>
              <button class="can-top-menu-item danger" type="button" :disabled="!hasAnySelectionForDelete" @click="runMenuAction(deleteSelected)">删除选中</button>
            </div>

            <div v-if="activeTopMenu === 'view'" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" @click="runMenuAction(toggleFullscreen)">{{ isFullscreen ? '退出全屏' : '全屏查看' }}</button>
              <button v-if="isSideCollapsed" class="can-top-menu-item" type="button" @click="runMenuAction(showSideCard)">显示属性面板</button>
              <button v-else class="can-top-menu-item" type="button" @click="runMenuAction(hideSideCard)">隐藏属性面板</button>
            </div>

            <div v-if="activeTopMenu === 'export'" class="can-top-menu-panel">
              <button class="can-top-menu-item" type="button" @click="runMenuAction(exportArchitectureConfig)">导出架构 JSON</button>
              <button class="can-top-menu-item" type="button" @click="runMenuAction(exportSelectedNodes)" :disabled="selectedIds.length === 0">导出选中 DBC</button>
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
            <select v-model="activeLinkStyle" class="form-select form-select-sm can-link-style-select" title="连线样式" @change="applyActiveStyleToSelectedLink">
              <option value="straight">直线</option>
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
            <button class="can-icon-tool-btn" type="button" title="撤销" data-tip="撤销" :disabled="!canUndo" @click="undoNodes">
              <span aria-hidden="true">↶</span>
            </button>
            <button class="can-icon-tool-btn" type="button" title="重做" data-tip="重做" :disabled="!canRedo" @click="redoNodes">
              <span aria-hidden="true">↷</span>
            </button>
            <button class="can-icon-tool-btn" type="button" :title="isFullscreen ? '退出全屏' : '全屏查看'" :data-tip="isFullscreen ? '退出全屏' : '全屏查看'" @click="toggleFullscreen">
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
      </div>

      <div class="can-arch-layout">
        <div class="can-arch-canvas-card">
          <div class="can-arch-canvas-head">
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
                      class="can-link-path"
                      :class="{ selected: selectedLinkId === link.id }"
                      :d="link.path"
                      :stroke="link.color"
                      :stroke-linejoin="link.style === 'rounded' ? 'round' : 'miter'"
                      stroke-width="3"
                      stroke-dasharray="none"
                      fill="none"
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

            <div
              class="can-arch-height-resizer"
              title="拖拽调整画布高度"
              @pointerdown.stop.prevent="onCanvasResizePointerDown"
            ></div>
          </div>
          <aside v-if="!isSideCollapsed" class="can-arch-side-card can-arch-side-card-floating">
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
                <option value="straight">直线</option>
                <option value="polyline">折线（可加锚点）</option>
                <option value="curve">曲线</option>
                <option value="rounded">圆角折线</option>
                <option value="orthogonal">直角折线</option>
              </select>

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
                <div v-if="busProtocolsForSelected.length === 0" class="can-side-hint p-0">暂无连接 ECU</div>
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
                <span class="can-draft-auto-hint">已开启自动应用</span>
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
            {{ statusError || statusMessage }}
          </div>
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
      <div class="can-import-card" role="dialog" aria-modal="true" aria-label="DBC 节点导入向导">
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
            识别到 {{ importCandidates.length }} 个 ECU。默认勾选新增项，重名项需确认后再导入。
          </p>

          <div class="can-import-list">
            <div class="can-import-row can-import-row-head">
              <span>导入</span>
              <span>ECU 名称</span>
              <span>协议</span>
              <span>地址/节点号</span>
              <span>冲突处理</span>
            </div>
            <div
              v-for="candidate in importCandidates"
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
                <template v-if="candidate.conflict">
                  <div class="can-form-warning mb-1">同名 ECU 已存在</div>
                  <input
                    v-model="candidate.rename"
                    class="form-control form-control-sm"
                    type="text"
                    maxlength="40"
                    placeholder="重命名后导入"
                  >
                </template>
                <template v-else>新增</template>
              </span>
            </div>
          </div>

          <div class="d-flex gap-2 mt-3 justify-content-end">
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="closeImportModal">取消</button>
            <button class="btn btn-primary btn-sm" type="button" @click="confirmImportCandidates">确认导入</button>
          </div>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { J1939Feature } from '@/features/j1939';
import { useJ1939ModuleInit } from '@/app/composables/useJ1939ModuleInit.js';
import {
  canProtocols,
  parseDbcNodes,
  serializeNodesToDbc,
  validateCanNodeDraft,
} from '@/features/can-arch/services/can-arch-dbc.js';

const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const STORAGE_KEY = 'coderOnlineTools.canArch.nodes.v1';
const CONFIG_SCHEMA = 'can-arch-config';
const CONFIG_VERSION = 1;
const AUTO_SAVE_INTERVAL_MS = 12000;
const NODE_WIDTH = 150;
const NODE_HEIGHT = 88;
const BUS_RADIUS = 38;
const HISTORY_LIMIT = 80;
const DEFAULT_NODE_BASE_COLOR = '#d85f3f';
const DEFAULT_BUS_BAUD = 500;
const BUS_COLOR_POOL = ['#8e24aa', '#1e88e5', '#43a047', '#fb8c00', '#e53935', '#00897b', '#6d4c41'];

const nodes = ref([]);
const buses = ref([]);
const links = ref([]);
const selectedIds = ref([]);
const selectedBusId = ref('');
const selectedLinkId = ref('');
const clipboardPayload = ref(null);
const pasteSerial = ref(0);
const selectedIdSet = computed(() => new Set(selectedIds.value));
const canvasRef = ref(null);
const importInputRef = ref(null);
const configImportInputRef = ref(null);

const selectionRect = ref(null);
const importModalOpen = ref(false);
const importStage = ref('choose');
const importCandidates = ref([]);
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
const isCanvasPanning = ref(false);
const isSideCollapsed = ref(false);
const canvasZoom = ref(1);
const canvasHeight = ref(620);
const activeTopMenu = ref('');
const activeLinkStyle = ref('straight');
const exportPrefs = reactive({
  includeBackground: true,
  autoCrop: true,
});

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
  style: 'straight',
});

const linkHoverNodeEdge = reactive({
  nodeId: '',
  edge: '',
});
const linkHoverBusId = ref('');
const linkDraftTarget = ref(null);
const linkDraftVersion = ref(0);

let selectionState = null;
let dragState = null;
let canvasPanState = null;
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

const singleSelectedNode = computed(() => {
  if (selectedIds.value.length !== 1) return null;
  return nodes.value.find((item) => item.id === selectedIds.value[0]) || null;
});

const singleSelectedBus = computed(() => {
  if (!selectedBusId.value) return null;
  return buses.value.find((item) => item.id === selectedBusId.value) || null;
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
  return Boolean(selectedLinkId.value) || selectedIds.value.length > 0 || Boolean(selectedBusId.value);
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
    const nodeId = fromType === 'node' ? fromId : (toType === 'node' ? toId : '');
    const node = nodes.value.find((item) => item.id === nodeId);
    if (!node) continue;
    if (Array.isArray(node.protocols) && node.protocols.length > 0) {
      for (const protocol of node.protocols) {
        protocolSet.add(protocol);
      }
    } else {
      protocolSet.add(canProtocols.GENERIC_STD);
    }
  }
  return [...protocolSet];
});

function resolveNodeAnchorByEdge(node, edge, offsetRatio) {
  const ratio = Math.max(0, Math.min(1, Number.isFinite(Number(offsetRatio)) ? Number(offsetRatio) : 0.5));
  if (edge === 'left') {
    return {
      x: node.position.x,
      y: node.position.y + Math.round(NODE_HEIGHT * ratio),
    };
  }
  if (edge === 'top') {
    return {
      x: node.position.x + Math.round(NODE_WIDTH * ratio),
      y: node.position.y,
    };
  }
  if (edge === 'bottom') {
    return {
      x: node.position.x + Math.round(NODE_WIDTH * ratio),
      y: node.position.y + NODE_HEIGHT,
    };
  }
  return {
    x: node.position.x + NODE_WIDTH,
    y: node.position.y + Math.round(NODE_HEIGHT * ratio),
  };
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
  const center = {
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + NODE_HEIGHT / 2,
  };
  const dx = targetPoint.x - center.x;
  const dy = targetPoint.y - center.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx >= absDy) {
    const edge = dx >= 0 ? 'right' : 'left';
    const offset = Math.max(0, Math.min(1, (targetPoint.y - node.position.y) / NODE_HEIGHT));
    return resolveNodeAnchorByEdge(node, edge, offset);
  }
  const edge = dy >= 0 ? 'bottom' : 'top';
  const offset = Math.max(0, Math.min(1, (targetPoint.x - node.position.x) / NODE_WIDTH));
  return resolveNodeAnchorByEdge(node, edge, offset);
}

function resolveBusAnchorFromDirection(bus, targetPoint) {
  const cx = bus.position.x + BUS_RADIUS;
  const cy = bus.position.y + BUS_RADIUS;
  const dx = targetPoint.x - cx;
  const dy = targetPoint.y - cy;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: cx + (dx / length) * BUS_RADIUS,
    y: cy + (dy / length) * BUS_RADIUS,
  };
}

function resolveModuleAnchorPoint(type, module, anchorEdge, anchorOffset, targetPoint) {
  if (!module) return null;
  if (type === 'node') {
    if (['left', 'right', 'top', 'bottom'].includes(anchorEdge)) {
      return resolveNodeAnchorByEdge(module, anchorEdge, anchorOffset);
    }
    return resolveNodeAnchorFromDirection(module, targetPoint);
  }
  return resolveBusAnchorFromDirection(module, targetPoint);
}

function buildOrthogonalPoints(start, end) {
  const midX = (start.x + end.x) / 2;
  return [
    { x: start.x, y: start.y },
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    { x: end.x, y: end.y },
  ];
}

function buildPolylinePath(points) {
  if (!points || points.length < 2) return '';
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
}

function buildRoundedOrthogonalPath(points, radius = 14) {
  if (!points || points.length < 2) return '';
  if (points.length < 3) return buildPolylinePath(points);

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const abLen = Math.sqrt(ab.x * ab.x + ab.y * ab.y) || 1;
    const bcLen = Math.sqrt(bc.x * bc.x + bc.y * bc.y) || 1;
    const r = Math.max(0, Math.min(radius, abLen / 2, bcLen / 2));
    const p1 = { x: b.x - (ab.x / abLen) * r, y: b.y - (ab.y / abLen) * r };
    const p2 = { x: b.x + (bc.x / bcLen) * r, y: b.y + (bc.y / bcLen) * r };
    path += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function buildLinkGeometryPath(style, start, end, anchors) {
  const cleanAnchors = Array.isArray(anchors)
    ? anchors
      .map((item) => ({ x: Number(item?.x), y: Number(item?.y) }))
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
    : [];

  const points = [start, ...cleanAnchors, end];

  if (style === 'curve') {
    if (cleanAnchors.length === 0) {
      const dx = end.x - start.x;
      const control = {
        x: start.x + dx * 0.5,
        y: start.y,
      };
      return {
        path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        anchors: cleanAnchors,
      };
    }
    let path = `M ${start.x} ${start.y}`;
    let prev = start;
    for (let i = 0; i < cleanAnchors.length; i += 1) {
      const anchor = cleanAnchors[i];
      const next = i === cleanAnchors.length - 1 ? end : cleanAnchors[i + 1];
      const mid = {
        x: (anchor.x + next.x) / 2,
        y: (anchor.y + next.y) / 2,
      };
      if (i === 0) {
        path += ` Q ${anchor.x} ${anchor.y} ${mid.x} ${mid.y}`;
      } else {
        path += ` T ${mid.x} ${mid.y}`;
      }
      prev = mid;
    }
    if (prev.x !== end.x || prev.y !== end.y) {
      path += ` T ${end.x} ${end.y}`;
    }
    return {
      path,
      anchors: cleanAnchors,
    };
  }

  if (style === 'polyline') {
    return {
      path: buildPolylinePath(points),
      anchors: cleanAnchors,
    };
  }

  if (style === 'orthogonal') {
    if (cleanAnchors.length === 0) {
      const orthoPoints = buildOrthogonalPoints(start, end);
      return {
        path: buildPolylinePath(orthoPoints),
        anchors: [],
      };
    }
    const orthoPoints = [start];
    for (let i = 0; i < cleanAnchors.length; i += 1) {
      const a = cleanAnchors[i];
      const p = orthoPoints[orthoPoints.length - 1];
      orthoPoints.push({ x: a.x, y: p.y });
      orthoPoints.push({ x: a.x, y: a.y });
    }
    const last = orthoPoints[orthoPoints.length - 1];
    orthoPoints.push({ x: end.x, y: last.y });
    orthoPoints.push({ x: end.x, y: end.y });
    return {
      path: buildPolylinePath(orthoPoints),
      anchors: cleanAnchors,
    };
  }

  if (style === 'rounded') {
    if (cleanAnchors.length === 0) {
      const orthoPoints = buildOrthogonalPoints(start, end);
      return {
        path: buildRoundedOrthogonalPath(orthoPoints),
        anchors: [],
      };
    }
    const orthoPoints = [start];
    for (let i = 0; i < cleanAnchors.length; i += 1) {
      const a = cleanAnchors[i];
      const p = orthoPoints[orthoPoints.length - 1];
      orthoPoints.push({ x: a.x, y: p.y });
      orthoPoints.push({ x: a.x, y: a.y });
    }
    const last = orthoPoints[orthoPoints.length - 1];
    orthoPoints.push({ x: end.x, y: last.y });
    orthoPoints.push({ x: end.x, y: end.y });
    return {
      path: buildRoundedOrthogonalPath(orthoPoints),
      anchors: cleanAnchors,
    };
  }

  return {
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    anchors: [],
  };
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

    const style = ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(link.style)
      ? link.style
      : 'straight';
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
  const dots = [];
  for (const link of resolvedLinks.value) {
    if (link.fromType === 'node' && link.fromId === node.id) {
      const localX = link.start.x - node.position.x;
      const localY = link.start.y - node.position.y;
      dots.push({
        key: `dot-${link.id}-s`,
        left: Math.max(0, Math.min(NODE_WIDTH - 8, localX - 4)),
        top: Math.max(0, Math.min(NODE_HEIGHT - 8, localY - 4)),
      });
    }
    if (link.toType === 'node' && link.toId === node.id) {
      const localX = link.end.x - node.position.x;
      const localY = link.end.y - node.position.y;
      dots.push({
        key: `dot-${link.id}-e`,
        left: Math.max(0, Math.min(NODE_WIDTH - 8, localX - 4)),
        top: Math.max(0, Math.min(NODE_HEIGHT - 8, localY - 4)),
      });
    }
  }
  return dots;
}

const linkDraft = computed(() => {
  linkDraftVersion.value;
  if (!linkDraftState) return null;
  const draftStyle = ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(activeLinkStyle.value)
    ? activeLinkStyle.value
    : 'straight';
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

function parseHexColor(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function normalizeNodeBaseColor(value, fallback = DEFAULT_NODE_BASE_COLOR) {
  const parsed = parseHexColor(value);
  if (!parsed) return fallback;
  const toHex = (num) => Math.max(0, Math.min(255, num)).toString(16).padStart(2, '0');
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

function mixWithWhite(hex, ratio) {
  const parsed = parseHexColor(hex) || parseHexColor(DEFAULT_NODE_BASE_COLOR);
  const weight = Math.max(0, Math.min(1, ratio));
  const mix = (channel) => Math.round(channel + (255 - channel) * weight);
  const toHex = (num) => Math.max(0, Math.min(255, num)).toString(16).padStart(2, '0');
  return `#${toHex(mix(parsed.r))}${toHex(mix(parsed.g))}${toHex(mix(parsed.b))}`;
}

function mixWithBlack(hex, ratio) {
  const parsed = parseHexColor(hex) || parseHexColor(DEFAULT_NODE_BASE_COLOR);
  const weight = Math.max(0, Math.min(1, ratio));
  const mix = (channel) => Math.round(channel * (1 - weight));
  const toHex = (num) => Math.max(0, Math.min(255, num)).toString(16).padStart(2, '0');
  return `#${toHex(mix(parsed.r))}${toHex(mix(parsed.g))}${toHex(mix(parsed.b))}`;
}

function nodeCardStyle(node) {
  const base = normalizeNodeBaseColor(node.baseColor);
  return {
    transform: `translate(${node.position.x}px, ${node.position.y}px)`,
    '--node-border': mixWithBlack(base, 0.1),
    '--node-bg-top': mixWithWhite(base, 0.9),
    '--node-bg-bottom': mixWithWhite(base, 0.8),
  };
}

function nodeProtocolGroups(node) {
  const groups = [];
  const hasGenericStd = node.protocols.includes(canProtocols.GENERIC_STD);
  const hasGenericExt = node.protocols.includes(canProtocols.GENERIC_EXT);
  const hasJ1939 = node.protocols.includes(canProtocols.J1939) || node.j1939Addresses.length > 0;
  const hasCanopen = node.protocols.includes(canProtocols.CANOPEN) || node.canopenNodeIds.length > 0;

  if (hasGenericStd) {
    groups.push({
      key: 'generic-std',
      label: 'Generic(Std)',
      addressText: '',
      showAddress: false,
      badgeClass: 'can-pill-neutral',
      rowClass: 'generic',
    });
  }

  if (hasGenericExt) {
    groups.push({
      key: 'generic-ext',
      label: 'Generic(Ext)',
      addressText: '',
      showAddress: false,
      badgeClass: 'can-pill-neutral',
      rowClass: 'generic',
    });
  }

  if (hasJ1939) {
    groups.push({
      key: 'j1939',
      label: 'J1939',
      addressText: node.j1939Addresses.length > 0 ? node.j1939Addresses.join(', ') : '',
      showAddress: true,
      badgeClass: 'can-pill-j1939',
      rowClass: 'j1939',
    });
  }

  if (hasCanopen) {
    groups.push({
      key: 'canopen',
      label: 'CANopen',
      addressText: node.canopenNodeIds.length > 0 ? node.canopenNodeIds.join(', ') : '',
      showAddress: true,
      badgeClass: 'can-pill-canopen',
      rowClass: 'canopen',
    });
  }

  if (groups.length === 0) {
    groups.push({
      key: 'generic',
      label: 'Generic(Std)',
      addressText: '',
      showAddress: false,
      badgeClass: 'can-pill-neutral',
      rowClass: 'generic',
    });
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
    selected: selectedBusId.value === bus.id,
    'link-rim-hot': linkHoverBusId.value === bus.id,
    'link-drop-target': linkDraftTarget.value?.type === 'bus' && linkDraftTarget.value?.id === bus.id,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function createNodeName(existingNames) {
  let idx = 1;
  while (existingNames.has(`ECU_${idx}`)) {
    idx += 1;
  }
  return `ECU_${idx}`;
}

function createBusName(existingNames) {
  let idx = 1;
  while (existingNames.has(`CAN ${idx}`)) {
    idx += 1;
  }
  return `CAN ${idx}`;
}

function ensureUniqueLabel(baseName, usedNames) {
  const normalized = String(baseName || '').trim() || 'Item';
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return normalized;
  }
  let idx = 2;
  while (usedNames.has(`${normalized}_${idx}`)) {
    idx += 1;
  }
  const name = `${normalized}_${idx}`;
  usedNames.add(name);
  return name;
}

function findBusByPoint(point, excludeBusId = '') {
  if (!point) return null;
  let best = null;
  let bestDist = Infinity;
  for (const bus of buses.value) {
    if (excludeBusId && bus.id === excludeBusId) continue;
    const cx = bus.position.x + BUS_RADIUS;
    const cy = bus.position.y + BUS_RADIUS;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= BUS_RADIUS + 30 && dist < bestDist) {
      best = bus;
      bestDist = dist;
    }
  }
  return best;
}

function findNodeByPoint(point, excludeNodeId = '') {
  if (!point) return null;
  let best = null;
  let bestDist = Infinity;
  for (const node of nodes.value) {
    if (excludeNodeId && node.id === excludeNodeId) continue;
    const inside = point.x >= node.position.x - 10 && point.x <= node.position.x + NODE_WIDTH + 10 &&
      point.y >= node.position.y - 10 && point.y <= node.position.y + NODE_HEIGHT + 10;
    if (!inside) continue;
    const cx = node.position.x + NODE_WIDTH / 2;
    const cy = node.position.y + NODE_HEIGHT / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      best = node;
      bestDist = dist;
    }
  }
  return best;
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
  if (!selectedLinkId.value) return;
  pushHistorySnapshot();
  const id = selectedLinkId.value;
  links.value = links.value.filter((item) => item.id !== id);
  selectedLinkId.value = '';
  persistNodes();
  closeContextMenu();
  syncLinkEditorFromSelected();
  setStatus('已删除连线。');
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
  const style = ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(styleInput)
    ? styleInput
    : 'straight';
  if (target.style === style) return;
  if (linkEditorHistoryLinkId !== target.id) {
    pushHistorySnapshot();
    linkEditorHistoryLinkId = target.id;
  }
  target.style = style;
  if (style !== 'polyline') {
    target.anchors = [];
  }
  if (options.updateToolbar !== false) {
    activeLinkStyle.value = style;
  }
  persistNodes();
  if (options.showStatus !== false) {
    setStatus('已更新连线样式。');
  }
}

function distancePointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const ab2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  const proj = { x: a.x + abx * t, y: a.y + aby * t };
  const dx = point.x - proj.x;
  const dy = point.y - proj.y;
  return {
    dist: Math.sqrt(dx * dx + dy * dy),
    t,
  };
}

function addAnchorToLink(linkId, point) {
  const target = links.value.find((item) => item.id === linkId);
  const geometry = resolvedLinks.value.find((item) => item.id === linkId);
  if (!target || !geometry || !point) return;
  if (!Array.isArray(target.anchors)) target.anchors = [];

  const points = [geometry.start, ...(target.anchors || []), geometry.end];
  let insertIndex = target.anchors.length;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const hit = distancePointToSegment(point, points[i], points[i + 1]);
    if (hit.dist < bestDist) {
      bestDist = hit.dist;
      insertIndex = i;
    }
  }

  let nextAnchor = {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
  const overlapCount = target.anchors.filter((anchor) => {
    const dx = Number(anchor?.x) - nextAnchor.x;
    const dy = Number(anchor?.y) - nextAnchor.y;
    return Math.sqrt(dx * dx + dy * dy) < 8;
  }).length;
  if (overlapCount > 0) {
    nextAnchor = {
      x: nextAnchor.x + overlapCount * 12,
      y: nextAnchor.y + overlapCount * 8,
    };
  }

  target.anchors.splice(insertIndex, 0, nextAnchor);
  persistNodes();
}

function onLinkPointerDown(link, event) {
  selectedLinkId.value = link.id;
  selectedIds.value = [];
  selectedBusId.value = '';
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
  const nodeSet = new Set(selectedIds.value);
  const busSet = new Set(selectedBusId.value ? [selectedBusId.value] : []);

  if (nodeSet.size === 0 && busSet.size === 0) {
    setStatus('请先选中一个或多个模块再复制。', true);
    return;
  }

  const copiedNodes = nodes.value.filter((item) => nodeSet.has(item.id)).map((item) => ({ ...item, position: { ...item.position } }));
  const copiedBuses = buses.value.filter((item) => busSet.has(item.id)).map((item) => ({ ...item, position: { ...item.position } }));
  const copiedLinks = links.value
    .filter((item) => {
      const fromType = item.fromType || 'node';
      const toType = item.toType || 'bus';
      const fromId = item.fromId || item.nodeId;
      const toId = item.toId || item.busId;
      const fromPicked = fromType === 'node' ? nodeSet.has(fromId) : busSet.has(fromId);
      const toPicked = toType === 'node' ? nodeSet.has(toId) : busSet.has(toId);
      return fromPicked && toPicked;
    })
    .map((item) => ({ ...item }));

  clipboardPayload.value = {
    nodes: copiedNodes,
    buses: copiedBuses,
    links: copiedLinks,
  };
  setStatus(`已复制 ${copiedNodes.length} 个 ECU、${copiedBuses.length} 个 BUS。`);
}

function pasteClipboard(point = null) {
  const payload = clipboardPayload.value;
  if (!payload || (!payload.nodes?.length && !payload.buses?.length)) {
    setStatus('剪贴板为空，无法粘贴。', true);
    return;
  }

  pasteSerial.value += 1;
  const offset = 28 * pasteSerial.value;
  const allItems = [...payload.nodes, ...payload.buses];
  const minX = Math.min(...allItems.map((item) => item.position.x));
  const minY = Math.min(...allItems.map((item) => item.position.y));
  const shiftX = point ? Math.round(point.x - minX) : offset;
  const shiftY = point ? Math.round(point.y - minY) : offset;

  pushHistorySnapshot();

  const nodeNameSet = new Set(nodes.value.map((item) => item.name));
  const busNameSet = new Set(buses.value.map((item) => item.name));
  const nodeIdMap = new Map();
  const busIdMap = new Map();

  for (const sourceNode of payload.nodes) {
    const id = crypto.randomUUID();
    nodeIdMap.set(sourceNode.id, id);
    nodes.value.push({
      ...sourceNode,
      id,
      name: ensureUniqueLabel(sourceNode.name, nodeNameSet),
      position: {
        x: Math.round(sourceNode.position.x + shiftX),
        y: Math.round(sourceNode.position.y + shiftY),
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  for (const sourceBus of payload.buses) {
    const id = crypto.randomUUID();
    busIdMap.set(sourceBus.id, id);
    buses.value.push({
      ...sourceBus,
      id,
      name: ensureUniqueLabel(sourceBus.name, busNameSet),
      position: {
        x: Math.round(sourceBus.position.x + shiftX),
        y: Math.round(sourceBus.position.y + shiftY),
      },
    });
  }

  for (const sourceLink of payload.links) {
    const fromType = sourceLink.fromType || 'node';
    const toType = sourceLink.toType || 'bus';
    const sourceFromId = sourceLink.fromId || sourceLink.nodeId;
    const sourceToId = sourceLink.toId || sourceLink.busId;
    const fromId = fromType === 'node' ? nodeIdMap.get(sourceFromId) : busIdMap.get(sourceFromId);
    const toId = toType === 'node' ? nodeIdMap.get(sourceToId) : busIdMap.get(sourceToId);
    if (!fromId || !toId) continue;
    links.value.push({
      id: crypto.randomUUID(),
      fromType,
      fromId,
      toType,
      toId,
      fromAnchorEdge: sourceLink.fromAnchorEdge || sourceLink.anchorEdge || 'auto',
      fromAnchorOffset: Number.isFinite(Number(sourceLink.fromAnchorOffset)) ? Number(sourceLink.fromAnchorOffset) : (Number.isFinite(Number(sourceLink.anchorOffset)) ? Number(sourceLink.anchorOffset) : 0.5),
      toAnchorEdge: sourceLink.toAnchorEdge || 'auto',
      toAnchorOffset: Number.isFinite(Number(sourceLink.toAnchorOffset)) ? Number(sourceLink.toAnchorOffset) : 0.5,
      style: ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(sourceLink.style) ? sourceLink.style : 'straight',
      anchors: Array.isArray(sourceLink.anchors) ? sourceLink.anchors.map((item) => ({ x: Number(item?.x), y: Number(item?.y) })).filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y)) : [],
    });
  }

  persistNodes();
  setStatus(`已粘贴 ${payload.nodes.length} 个 ECU、${payload.buses.length} 个 BUS。`);
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

function normalizeBusColor(value, fallback = BUS_COLOR_POOL[0]) {
  return normalizeNodeBaseColor(value, fallback);
}

function busCardStyle(bus) {
  const color = normalizeBusColor(bus.color);
  return {
    transform: `translate(${bus.position.x}px, ${bus.position.y}px)`,
    '--bus-color': color,
    '--bus-color-soft': mixWithWhite(color, 0.22),
    '--bus-color-deep': mixWithBlack(color, 0.2),
  };
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

function extractTopologyFromConfigPayload(payload) {
  if (Array.isArray(payload)) {
    return { nodes: payload, buses: [], links: [] };
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.nodes)) {
    return {
      nodes: payload.nodes,
      buses: Array.isArray(payload.buses) ? payload.buses : [],
      links: Array.isArray(payload.links) ? payload.links : [],
    };
  }
  throw new Error('配置文件格式不正确，缺少 nodes 列表。');
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

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveExportBounds(crop, padding = 28) {
  if (!crop || nodes.value.length === 0) {
    return {
      x: 0,
      y: 0,
      width: Math.max(420, sceneSize.value.width),
      height: Math.max(420, sceneSize.value.height),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes.value) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
  }
  for (const bus of buses.value) {
    minX = Math.min(minX, bus.position.x);
    minY = Math.min(minY, bus.position.y);
    maxX = Math.max(maxX, bus.position.x + BUS_RADIUS * 2);
    maxY = Math.max(maxY, bus.position.y + BUS_RADIUS * 2);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 420, height: 420 };
  }

  const x = Math.floor(minX - padding);
  const y = Math.floor(minY - padding);
  const width = Math.max(1, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(1, Math.ceil(maxY - minY + padding * 2));
  return { x, y, width, height };
}

function buildArchitectureSvg(options = {}) {
  const includeBackground = options.includeBackground !== false;
  const crop = options.crop === true;
  const bounds = resolveExportBounds(crop);
  const width = bounds.width;
  const height = bounds.height;

  const nodeBlocks = nodes.value.map((node) => {
    const base = normalizeNodeBaseColor(node.baseColor);
    const borderColor = mixWithBlack(base, 0.1);
    const fillTop = mixWithWhite(base, 0.9);
    const fillBottom = mixWithWhite(base, 0.8);
    const accentStart = mixWithBlack(base, 0.12);
    const accentEnd = mixWithWhite(base, 0.2);
    const protocolLines = nodeProtocolGroups(node)
      .map((group) => `${group.label}: ${group.addressText || '未配置地址'}`)
      .slice(0, 2);
    const line2 = protocolLines[0] || '';
    const line3 = protocolLines[1] || '';

    const x = node.position.x - bounds.x;
    const y = node.position.y - bounds.y;

    return `
      <g transform="translate(${x}, ${y})">
        <defs>
          <linearGradient id="node-fill-${escapeXml(node.id)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fillTop}"/>
            <stop offset="100%" stop-color="${fillBottom}"/>
          </linearGradient>
          <linearGradient id="node-accent-${escapeXml(node.id)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${accentStart}"/>
            <stop offset="100%" stop-color="${accentEnd}"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="url(#node-fill-${escapeXml(node.id)})" stroke="${borderColor}"/>
        <rect x="0" y="0" width="8" height="${NODE_HEIGHT}" rx="8" fill="url(#node-accent-${escapeXml(node.id)})"/>
        <text x="14" y="24" font-size="13" font-weight="700" fill="#2f241c">${escapeXml(node.name)} ECU</text>
        ${line2 ? `<text x="14" y="48" font-size="11" fill="#5a4a3d">${escapeXml(line2)}</text>` : ''}
        ${line3 ? `<text x="14" y="66" font-size="11" fill="#6c6157">${escapeXml(line3)}</text>` : ''}
      </g>
    `;
  }).join('');

  const linkBlocks = resolvedLinks.value.map((link) => {
    const shiftedPath = String(link.path || '')
      .replace(/\bM\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `M ${Number(x) - bounds.x} ${Number(y) - bounds.y}`)
      .replace(/\bL\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `L ${Number(x) - bounds.x} ${Number(y) - bounds.y}`)
      .replace(/\bQ\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x1, y1, x2, y2) => `Q ${Number(x1) - bounds.x} ${Number(y1) - bounds.y} ${Number(x2) - bounds.x} ${Number(y2) - bounds.y}`);
    return `<path d="${shiftedPath}" stroke="${escapeXml(link.color)}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  }).join('');

  const busBlocks = buses.value.map((bus) => {
    const cx = bus.position.x + BUS_RADIUS - bounds.x;
    const cy = bus.position.y + BUS_RADIUS - bounds.y;
    const color = normalizeBusColor(bus.color);
    return `
      <g>
        <circle cx="${cx}" cy="${cy}" r="${BUS_RADIUS}" fill="${color}" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
        <text x="${cx}" y="${cy + 4}" font-size="11" font-weight="700" text-anchor="middle" fill="#ffffff">${escapeXml(bus.name.slice(0, 8))}</text>
      </g>
    `;
  }).join('');

  const backgroundLayer = includeBackground
    ? `
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg-grad)"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#grid)"/>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbf8f3"/>
      <stop offset="100%" stop-color="#f4ede4"/>
    </linearGradient>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(217,200,181,0.35)" stroke-width="1"/>
    </pattern>
  </defs>
  ${backgroundLayer}
  ${linkBlocks}
  ${busBlocks}
  ${nodeBlocks}
</svg>`;

  return { svg, width, height };
}

function exportArchitectureSvg() {
  const { svg } = buildArchitectureSvg({
    includeBackground: exportPrefs.includeBackground,
    crop: exportPrefs.autoCrop,
  });
  const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadTextFile(`can-arch-${dateTag}.svg`, svg);
  setStatus(`已导出 SVG（${exportPrefs.includeBackground ? '含背景' : '透明背景'}，${exportPrefs.autoCrop ? '自动裁剪' : '不裁剪'}）。`);
}

async function exportArchitecturePng() {
  try {
    const { svg, width, height } = buildArchitectureSvg({
      includeBackground: exportPrefs.includeBackground,
      crop: exportPrefs.autoCrop,
    });
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const image = new Image();

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(svgUrl);
      throw new Error('浏览器不支持 PNG 导出。');
    }

    context.drawImage(image, 0, 0, width, height);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    URL.revokeObjectURL(svgUrl);
    if (!pngBlob) {
      throw new Error('PNG 编码失败。');
    }

    const url = URL.createObjectURL(pngBlob);
    const anchor = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    anchor.href = url;
    anchor.download = `can-arch-${dateTag}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
    selectedBusId.value = '';
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

function cloneNodesSnapshot(source) {
  return source.map((item) => ({
    ...item,
    position: {
      x: Number(item.position?.x) || 0,
      y: Number(item.position?.y) || 0,
    },
    protocols: Array.isArray(item.protocols) ? [...item.protocols] : [],
    j1939Addresses: Array.isArray(item.j1939Addresses) ? [...item.j1939Addresses] : [],
    canopenNodeIds: Array.isArray(item.canopenNodeIds) ? [...item.canopenNodeIds] : [],
    baseColor: normalizeNodeBaseColor(item.baseColor),
  }));
}

function cloneBusesSnapshot(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    id: String(item?.id || crypto.randomUUID()),
    name: String(item?.name || 'CAN 1').trim() || 'CAN 1',
    baudRate: Number.isFinite(Number(item?.baudRate)) ? Number(item.baudRate) : DEFAULT_BUS_BAUD,
    color: normalizeBusColor(item?.color),
    position: {
      x: Number(item?.position?.x) || 0,
      y: Number(item?.position?.y) || 0,
    },
  }));
}

function cloneLinksSnapshot(source) {
  return (Array.isArray(source) ? source : []).map((item) => ({
    id: String(item?.id || crypto.randomUUID()),
    fromType: item?.fromType === 'bus' ? 'bus' : 'node',
    fromId: String(item?.fromId || item?.nodeId || ''),
    toType: item?.toType === 'node' ? 'node' : 'bus',
    toId: String(item?.toId || item?.busId || ''),
    fromAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.fromAnchorEdge)
      ? item.fromAnchorEdge
      : (['left', 'right', 'top', 'bottom'].includes(item?.anchorEdge) ? item.anchorEdge : 'auto'),
    fromAnchorOffset: Number.isFinite(Number(item?.fromAnchorOffset)) ? Number(item.fromAnchorOffset) : (Number.isFinite(Number(item?.anchorOffset)) ? Number(item.anchorOffset) : 0.5),
    toAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.toAnchorEdge) ? item.toAnchorEdge : 'auto',
    toAnchorOffset: Number.isFinite(Number(item?.toAnchorOffset)) ? Number(item.toAnchorOffset) : 0.5,
    style: ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(item?.style) ? item.style : 'straight',
    anchors: Array.isArray(item?.anchors)
      ? item.anchors
        .map((anchor) => ({ x: Number(anchor?.x), y: Number(anchor?.y) }))
        .filter((anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y))
      : [],
  }));
}

function cloneTopologySnapshot() {
  return {
    nodes: cloneNodesSnapshot(nodes.value),
    buses: cloneBusesSnapshot(buses.value),
    links: cloneLinksSnapshot(links.value),
  };
}

function pushHistorySnapshot() {
  if (historySuspend.value) return;
  historyPast.value.push(cloneTopologySnapshot());
  if (historyPast.value.length > HISTORY_LIMIT) {
    historyPast.value.shift();
  }
  historyFuture.value = [];
}

function applyHistoryState(snapshot, statusText) {
  historySuspend.value = true;
  nodes.value = hydrateNodes(snapshot?.nodes || []);
  buses.value = hydrateBuses(snapshot?.buses || []);
  links.value = hydrateLinks(snapshot?.links || [], nodes.value, buses.value);
  selectedIds.value = [];
  selectedBusId.value = '';
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
  historyFuture.value.push(cloneTopologySnapshot());
  applyHistoryState(previous, '已撤销上一步操作。');
}

function redoNodes() {
  if (historyFuture.value.length === 0) return;
  const next = historyFuture.value.pop();
  historyPast.value.push(cloneTopologySnapshot());
  applyHistoryState(next, '已重做上一步操作。');
}

function hydrateNodes(rawNodes) {
  const list = Array.isArray(rawNodes) ? rawNodes : [];
  return list
    .map((item) => ({
      id: String(item?.id || crypto.randomUUID()),
      name: String(item?.name || '').trim() || 'ECU',
      note: String(item?.note || ''),
      position: {
        x: Number.isFinite(Number(item?.position?.x)) ? Number(item.position.x) : 20,
        y: Number.isFinite(Number(item?.position?.y)) ? Number(item.position.y) : 20,
      },
      protocols: Array.isArray(item?.protocols)
        ? item.protocols.filter((token) => token === canProtocols.GENERIC_STD || token === canProtocols.GENERIC_EXT || token === canProtocols.J1939 || token === canProtocols.CANOPEN)
        : [],
      j1939Addresses: Array.isArray(item?.j1939Addresses)
        ? item.j1939Addresses.map((num) => Number.parseInt(num, 10)).filter((num) => Number.isInteger(num))
        : [],
      canopenNodeIds: Array.isArray(item?.canopenNodeIds)
        ? item.canopenNodeIds.map((num) => Number.parseInt(num, 10)).filter((num) => Number.isInteger(num))
        : [],
      baseColor: normalizeNodeBaseColor(item?.baseColor),
      createdAt: String(item?.createdAt || nowIso()),
      updatedAt: String(item?.updatedAt || nowIso()),
      source: item?.source === 'dbc-import' ? 'dbc-import' : 'manual',
    }))
    .filter((item) => Boolean(item.id));
}

function hydrateBuses(rawBuses) {
  const list = Array.isArray(rawBuses) ? rawBuses : [];
  return list
    .map((item, idx) => ({
      id: String(item?.id || crypto.randomUUID()),
      name: String(item?.name || `CAN ${idx + 1}`).trim() || `CAN ${idx + 1}`,
      baudRate: Number.isFinite(Number(item?.baudRate)) ? Math.max(10, Math.round(Number(item.baudRate))) : DEFAULT_BUS_BAUD,
      color: normalizeBusColor(item?.color, BUS_COLOR_POOL[idx % BUS_COLOR_POOL.length]),
      position: {
        x: Number.isFinite(Number(item?.position?.x)) ? Number(item.position.x) : nextBusPosition().x,
        y: Number.isFinite(Number(item?.position?.y)) ? Number(item.position.y) : nextBusPosition().y,
      },
    }))
    .filter((item) => Boolean(item.id));
}

function hydrateLinks(rawLinks, sourceNodes, sourceBuses) {
  const nodeIdSet = new Set((sourceNodes || []).map((item) => item.id));
  const busIdSet = new Set((sourceBuses || []).map((item) => item.id));
  const seen = new Set();
  return (Array.isArray(rawLinks) ? rawLinks : [])
    .map((item) => ({
      id: String(item?.id || crypto.randomUUID()),
      fromType: item?.fromType === 'bus' ? 'bus' : 'node',
      fromId: String(item?.fromId || item?.nodeId || ''),
      toType: item?.toType === 'node' ? 'node' : 'bus',
      toId: String(item?.toId || item?.busId || ''),
      fromAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.fromAnchorEdge)
        ? item.fromAnchorEdge
        : (['left', 'right', 'top', 'bottom'].includes(item?.anchorEdge) ? item.anchorEdge : 'auto'),
      fromAnchorOffset: Number.isFinite(Number(item?.fromAnchorOffset)) ? Number(item.fromAnchorOffset) : (Number.isFinite(Number(item?.anchorOffset)) ? Number(item.anchorOffset) : 0.5),
      toAnchorEdge: ['left', 'right', 'top', 'bottom'].includes(item?.toAnchorEdge) ? item.toAnchorEdge : 'auto',
      toAnchorOffset: Number.isFinite(Number(item?.toAnchorOffset)) ? Number(item.toAnchorOffset) : 0.5,
      style: ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(item?.style) ? item.style : 'straight',
      anchors: Array.isArray(item?.anchors)
        ? item.anchors
          .map((anchor) => ({ x: Number(anchor?.x), y: Number(anchor?.y) }))
          .filter((anchor) => Number.isFinite(anchor.x) && Number.isFinite(anchor.y))
        : [],
    }))
    .filter((item) => {
      const isNodeBusPair = (item.fromType === 'node' && item.toType === 'bus') || (item.fromType === 'bus' && item.toType === 'node');
      if (!isNodeBusPair) return false;
      const fromExists = item.fromType === 'node' ? nodeIdSet.has(item.fromId) : busIdSet.has(item.fromId);
      const toExists = item.toType === 'node' ? nodeIdSet.has(item.toId) : busIdSet.has(item.toId);
      return fromExists && toExists;
    })
    .filter((item) => {
      const keyA = `${item.fromType}:${item.fromId}`;
      const keyB = `${item.toType}:${item.toId}`;
      const key = keyA < keyB ? `${keyA}::${keyB}` : `${keyB}::${keyA}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    if (Array.isArray(payload)) {
      nodes.value = hydrateNodes(payload);
      buses.value = [];
      links.value = [];
      selectedLinkId.value = '';
      return;
    }
    nodes.value = hydrateNodes(payload?.nodes || []);
    buses.value = hydrateBuses(payload?.buses || []);
    links.value = hydrateLinks(payload?.links || [], nodes.value, buses.value);
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
  selectedBusId.value = '';
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
    linkEditor.style = 'straight';
    isSyncingLinkEditor = false;
    return;
  }
  const style = ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(link.style)
    ? link.style
    : 'straight';
  linkEditor.style = style;
  activeLinkStyle.value = style;
  isSyncingLinkEditor = false;
}

function selectOnly(nodeId) {
  selectedIds.value = [nodeId];
  selectedBusId.value = '';
  selectedLinkId.value = '';
  syncBusDraftFromSelected();
  syncDraftFromSelected();
}

function selectBusOnly(busId) {
  selectedBusId.value = busId;
  selectedIds.value = [];
  selectedLinkId.value = '';
  syncDraftFromSelected();
  syncBusDraftFromSelected();
}

function resolveSpawnPosition(position) {
  if (position instanceof Event) {
    return nextNodePosition();
  }
  const x = Number(position?.x);
  const y = Number(position?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return nextNodePosition();
  }
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
  };
}

function addNode(position) {
  pushHistorySnapshot();
  const spawn = resolveSpawnPosition(position);
  const existingNames = new Set(nodes.value.map((item) => item.name));
  const newNode = {
    id: crypto.randomUUID(),
    name: createNodeName(existingNames),
    note: '',
    position: spawn,
    protocols: [],
    j1939Addresses: [],
    canopenNodeIds: [],
    baseColor: DEFAULT_NODE_BASE_COLOR,
    source: 'manual',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  nodes.value.push(newNode);
  persistNodes();
  selectOnly(newNode.id);
  setStatus(`已新增节点 ${newNode.name}`);
  closeContextMenu();
}

function addBus(position) {
  pushHistorySnapshot();
  const existingNames = new Set(buses.value.map((item) => item.name));
  const spawn = position && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))
    ? { x: Math.round(Number(position.x)), y: Math.round(Number(position.y)) }
    : nextBusPosition();

  const bus = {
    id: crypto.randomUUID(),
    name: createBusName(existingNames),
    baudRate: DEFAULT_BUS_BAUD,
    color: normalizeBusColor(BUS_COLOR_POOL[buses.value.length % BUS_COLOR_POOL.length]),
    position: spawn,
  };

  buses.value.push(bus);
  persistNodes();
  selectBusOnly(bus.id);
  closeContextMenu();
  setStatus(`已新增 CAN BUS：${bus.name}`);
}

function addBusAtContextMenu() {
  const point = contextMenu.value.canvasPoint;
  if (!point) {
    addBus(nextBusPosition());
    return;
  }
  addBus({
    x: Math.round(point.x - BUS_RADIUS),
    y: Math.round(point.y - BUS_RADIUS),
  });
}

function pasteAtContextMenu() {
  const point = contextMenu.value.canvasPoint;
  pasteClipboard(point || null);
  closeContextMenu();
}

function addNodeAtContextMenu() {
  const point = contextMenu.value.canvasPoint;
  if (!point) {
    addNode(nextNodePosition());
    return;
  }

  const bounds = getCanvasBounds();
  const logicalWidth = bounds ? Math.floor(bounds.width / canvasZoom.value) : Infinity;
  const logicalHeight = bounds ? Math.floor(bounds.height / canvasZoom.value) : Infinity;
  const maxX = Number.isFinite(logicalWidth) ? Math.max(0, logicalWidth - NODE_WIDTH) : Infinity;
  const maxY = Number.isFinite(logicalHeight) ? Math.max(0, logicalHeight - NODE_HEIGHT) : Infinity;
  addNode({
    x: Math.max(0, Math.min(maxX, Math.round(point.x - NODE_WIDTH / 2))),
    y: Math.max(0, Math.min(maxY, Math.round(point.y - NODE_HEIGHT / 2))),
  });
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  closeContextMenu();
}

function deleteSelectedNodes() {
  if (selectedIds.value.length === 0) return;
  pushHistorySnapshot();
  const selected = new Set(selectedIds.value);
  nodes.value = nodes.value.filter((node) => !selected.has(node.id));
  links.value = links.value.filter((item) => {
    const fromType = item.fromType || 'node';
    const toType = item.toType || 'bus';
    const fromId = item.fromId || item.nodeId;
    const toId = item.toId || item.busId;
    if (fromType === 'node' && selected.has(fromId)) return false;
    if (toType === 'node' && selected.has(toId)) return false;
    return true;
  });
  selectedIds.value = [];
  selectedBusId.value = '';
  selectedLinkId.value = '';
  syncDraftFromSelected();
  syncBusDraftFromSelected();
  persistNodes();
  setStatus('已删除选中节点。');
  closeContextMenu();
}

function deleteSelectedBus() {
  if (!selectedBusId.value) return;
  pushHistorySnapshot();
  const busId = selectedBusId.value;
  buses.value = buses.value.filter((item) => item.id !== busId);
  links.value = links.value.filter((item) => {
    const fromType = item.fromType || 'node';
    const toType = item.toType || 'bus';
    const fromId = item.fromId || item.nodeId;
    const toId = item.toId || item.busId;
    if (fromType === 'bus' && fromId === busId) return false;
    if (toType === 'bus' && toId === busId) return false;
    return true;
  });
  selectedBusId.value = '';
  selectedLinkId.value = '';
  syncBusDraftFromSelected();
  persistNodes();
  setStatus('已删除 CAN BUS。');
  closeContextMenu();
}

function deleteSelected() {
  if (selectedLinkId.value) {
    deleteSelectedLink();
    return;
  }
  if (selectedIds.value.length > 0) {
    deleteSelectedNodes();
    return;
  }
  if (selectedBusId.value) {
    deleteSelectedBus();
  }
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
  const style = ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(options?.style)
    ? options.style
    : activeLinkStyle.value;

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
    anchors: [],
  });
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
  if (!pointer) return null;
  const localX = pointer.x - node.position.x;
  const localY = pointer.y - node.position.y;
  if (localX < 0 || localY < 0 || localX > NODE_WIDTH || localY > NODE_HEIGHT) return null;

  const edgeThreshold = 26;
  const distances = [
    { edge: 'left', dist: localX },
    { edge: 'right', dist: NODE_WIDTH - localX },
    { edge: 'top', dist: localY },
    { edge: 'bottom', dist: NODE_HEIGHT - localY },
  ].sort((a, b) => a.dist - b.dist);

  const nearest = distances[0];
  if (!nearest || nearest.dist > edgeThreshold) return null;

  if (nearest.edge === 'left' || nearest.edge === 'right') {
    return {
      edge: nearest.edge,
      offset: Math.max(0, Math.min(1, localY / NODE_HEIGHT)),
      point: resolveNodeAnchorByEdge(node, nearest.edge, localY / NODE_HEIGHT),
    };
  }

  return {
    edge: nearest.edge,
    offset: Math.max(0, Math.min(1, localX / NODE_WIDTH)),
    point: resolveNodeAnchorByEdge(node, nearest.edge, localX / NODE_WIDTH),
  };
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
  if (event.button !== 0) return;
  const canvasElement = canvasRef.value;
  if (!canvasElement) return;

  canvasResizeState = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight: canvasElement.clientHeight,
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
  canvasHeight.value = Math.max(320, Math.round(canvasResizeState.startHeight + dy));
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
  if (selectedBusId.value) {
    selectedBusId.value = '';
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
    selectedBusId.value = bus.id;
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
  selectBusOnly(bus.id);
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
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { left, top, width, height };
}

function intersectsNode(rect, node) {
  const nodeRect = {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + NODE_WIDTH,
    bottom: node.position.y + NODE_HEIGHT,
  };

  const selRect = {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
  };

  return !(
    nodeRect.right < selRect.left ||
    nodeRect.left > selRect.right ||
    nodeRect.bottom < selRect.top ||
    nodeRect.top > selRect.bottom
  );
}

function onCanvasPointerDown(event) {
  if (selectionState || canvasPanState) return;
  if (event.button !== 0) return;
  if (event.target?.closest?.('.can-node-item') || event.target?.closest?.('.can-bus-item')) return;

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
    const additive = event.ctrlKey || event.metaKey;
    const start = resolvePointerInCanvas(event);
    if (!start) return;

    if (!additive) {
      selectedIds.value = [];
      selectedBusId.value = '';
      syncBusDraftFromSelected();
      syncDraftFromSelected();
    }

    selectionState = {
      additive,
      start,
      baseline: new Set(selectedIds.value),
    };

    selectionRect.value = { left: start.x, top: start.y, width: 0, height: 0 };

    window.addEventListener('pointermove', onSelectionPointerMove);
    window.addEventListener('pointerup', onSelectionPointerUp);
    document.addEventListener('pointermove', onSelectionPointerMove);
    document.addEventListener('pointerup', onSelectionPointerUp);
    return;
  }

  canvasPanState = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startMap: new Map(nodes.value.map((item) => [item.id, { x: item.position.x, y: item.position.y }])),
    busStartMap: new Map(buses.value.map((item) => [item.id, { x: item.position.x, y: item.position.y }])),
    linkAnchorStartMap: new Map(links.value.map((item) => [
      item.id,
      Array.isArray(item.anchors)
        ? item.anchors.map((anchor) => ({ x: Number(anchor?.x) || 0, y: Number(anchor?.y) || 0 }))
        : [],
    ])),
    moved: false,
    historyCaptured: false,
    keepSelection: event.ctrlKey || event.metaKey,
    pointerTarget: event.currentTarget,
  };

  isCanvasPanning.value = true;
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove', onCanvasPanPointerMove);
  window.addEventListener('pointerup', onCanvasPanPointerUp);
  document.addEventListener('pointermove', onCanvasPanPointerMove);
  document.addEventListener('pointerup', onCanvasPanPointerUp);
}

function onCanvasPanPointerMove(event) {
  if (!canvasPanState) return;
  if (canvasPanState.pointerId !== event.pointerId) return;

  const dx = event.clientX - canvasPanState.startClientX;
  const dy = event.clientY - canvasPanState.startClientY;
  if (!canvasPanState.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
    canvasPanState.moved = true;
  }

  if (canvasPanState.moved && !canvasPanState.historyCaptured) {
    pushHistorySnapshot();
    canvasPanState.historyCaptured = true;
  }

  for (const node of nodes.value) {
    const start = canvasPanState.startMap.get(node.id);
    if (!start) continue;
    node.position.x = Math.round(start.x + dx);
    node.position.y = Math.round(start.y + dy);
    node.updatedAt = nowIso();
  }
  for (const bus of buses.value) {
    const start = canvasPanState.busStartMap.get(bus.id);
    if (!start) continue;
    bus.position.x = Math.round(start.x + dx);
    bus.position.y = Math.round(start.y + dy);
  }
  for (const link of links.value) {
    if (!Array.isArray(link.anchors) || link.anchors.length === 0) continue;
    const startAnchors = canvasPanState.linkAnchorStartMap.get(link.id) || [];
    link.anchors = startAnchors.map((anchor) => ({
      x: Math.round(anchor.x + dx),
      y: Math.round(anchor.y + dy),
    }));
  }
}

function onCanvasPanPointerUp(event) {
  if (!canvasPanState) return;
  if (event && canvasPanState.pointerId !== event.pointerId) return;

  const hadMoved = canvasPanState.moved;
  const keepSelection = canvasPanState.keepSelection;
  canvasPanState.pointerTarget?.releasePointerCapture?.(canvasPanState.pointerId);
  canvasPanState = null;
  isCanvasPanning.value = false;
  window.removeEventListener('pointermove', onCanvasPanPointerMove);
  window.removeEventListener('pointerup', onCanvasPanPointerUp);
  document.removeEventListener('pointermove', onCanvasPanPointerMove);
  document.removeEventListener('pointerup', onCanvasPanPointerUp);

  if (!hadMoved && !keepSelection) {
    selectedIds.value = [];
    selectedBusId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
    return;
  }

  if (hadMoved) {
    persistNodes();
  }
}

function onCanvasPanPointerCancel() {
  onCanvasPanPointerUp();
}

function onCanvasPanLostCapture(event) {
  if (!canvasPanState || canvasPanState.pointerId !== event.pointerId) return;
  onCanvasPanPointerUp();
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

function onSelectionPointerMove(event) {
  if (!selectionState) return;
  const point = resolvePointerInCanvas(event);
  if (!point) return;

  const rect = rectFromPoints(selectionState.start, point);
  selectionRect.value = rect;

  const hitIds = nodes.value
    .filter((node) => intersectsNode(rect, node))
    .map((node) => node.id);

  if (selectionState.additive) {
    const merged = new Set(selectionState.baseline);
    for (const id of hitIds) merged.add(id);
    selectedIds.value = [...merged];
  } else {
    selectedIds.value = hitIds;
  }
}

function onSelectionPointerUp() {
  selectionState = null;
  selectionRect.value = null;
  if (selectedIds.value.length > 0) {
    selectedBusId.value = '';
    syncBusDraftFromSelected();
  }
  syncDraftFromSelected();
  window.removeEventListener('pointermove', onSelectionPointerMove);
  window.removeEventListener('pointerup', onSelectionPointerUp);
  document.removeEventListener('pointermove', onSelectionPointerMove);
  document.removeEventListener('pointerup', onSelectionPointerUp);
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

function buildExportNodes() {
  const selected = new Set(selectedIds.value);
  return nodes.value.filter((node) => selected.has(node.id));
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportSelectedNodes() {
  const exportNodes = buildExportNodes();
  if (exportNodes.length === 0) {
    setStatus('请先选中至少一个节点再导出。', true);
    return;
  }

  const dbc = serializeNodesToDbc(exportNodes);
  const dateTag = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadTextFile(`can-arch-nodes-${dateTag}.dbc`, dbc);
  setStatus(`已导出 ${exportNodes.length} 个节点。`);
}

function openImportPicker() {
  importInputRef.value?.click();
}

function triggerImportDialog() {
  importStage.value = 'choose';
  importCandidates.value = [];
  importModalOpen.value = true;
  closeContextMenu();
}

function closeImportModal() {
  importModalOpen.value = false;
  importCandidates.value = [];
  importStage.value = 'choose';
}

function candidateDisplayName(candidate) {
  if (candidate.conflict) {
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

function confirmImportCandidates() {
  const selected = importCandidates.value.filter((item) => item.selected);
  if (selected.length === 0) {
    setStatus('未选择任何节点导入。', true);
    return;
  }

  pushHistorySnapshot();
  const usedNames = new Set(nodes.value.map((node) => node.name));
  let importedCount = 0;

  for (const candidate of selected) {
    const baseName = candidateDisplayName(candidate);
    if (!baseName) {
      setStatus('存在空节点名，请先填写重命名。', true);
      return;
    }

    const name = ensureUniqueName(baseName, usedNames);
    nodes.value.push({
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
    });
    importedCount += 1;
  }

  persistNodes();
  closeImportModal();
  setStatus(`已导入 ${importedCount} 个节点。`);
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

    const existingNames = new Set(nodes.value.map((node) => node.name));
    importCandidates.value = parsed.map((node, idx) => {
      const conflict = existingNames.has(node.name);
      return {
        id: `import-${idx}-${node.name}`,
        name: node.name,
        protocols: node.protocols || [],
        j1939Addresses: node.j1939Addresses || [],
        canopenNodeIds: node.canopenNodeIds || [],
        baseColor: DEFAULT_NODE_BASE_COLOR,
        conflict,
        rename: conflict ? `${node.name}_import` : node.name,
        selected: !conflict,
      };
    });

    importStage.value = 'review';
    importModalOpen.value = true;
    setStatus(`解析成功，识别到 ${parsed.length} 个节点。`);
  } catch (error) {
    setStatus(`DBC 解析失败: ${error?.message || error}`, true);
  }
}

function handleDocumentKeydown(event) {
  if (!props.active) return;
  const target = event.target;
  const tagName = String(target?.tagName || '').toLowerCase();
  const editable = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;
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
    closeContextMenu();
  }
}

onMounted(() => {
  loadNodes();
  startAutoSaveTimer();
  setStatus('CAN 节点设计器已就绪。');
  window.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('keydown', handleDocumentKeydown);
  window.addEventListener('pointercancel', onDragPointerCancel);
  window.addEventListener('blur', onDragPointerCancel);
  document.addEventListener('contextmenu', onDocumentContextMenuCapture, true);
  deleteKeyBound = true;
});

onBeforeUnmount(() => {
  onDragPointerUp();
  finishBusDrag();
  onLinkAnchorPointerUp();
  clearNodeLinkDraft();
  onCanvasPanPointerUp();
  onCanvasResizePointerUp();
  onSelectionPointerUp();
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
  window.removeEventListener('pointercancel', onDragPointerCancel);
  window.removeEventListener('blur', onDragPointerCancel);
  document.removeEventListener('contextmenu', onDocumentContextMenuCapture, true);
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
    const normalized = ['straight', 'polyline', 'curve', 'rounded', 'orthogonal'].includes(style)
      ? style
      : 'straight';
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

useJ1939ModuleInit();
</script>
