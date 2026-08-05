<template>
  <div class="ecu-msg-editor" ref="editorRef" :style="{ height: `${height || 620}px`, minHeight: '400px' }" @contextmenu.prevent>
    <div class="ecu-msg-editor-head">
      <button class="ecu-msg-back-icon" type="button" title="返回画布" @click="$emit('close')">
        <span aria-hidden="true">↩</span>
      </button>
      <div class="ecu-msg-ecu-switch">
        <select
          class="ecu-msg-ecu-select"
          :value="ecu?.id"
          @change="(e) => onEcuSwitch(e.target.value)"
        >
          <option v-for="n in ecuNodes" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </div>
      <div class="ecu-msg-tabs" role="tablist" aria-label="CAN BUS 标签页">
        <button
          v-for="(tab, idx) in busTabs"
          :key="tab.busId"
          class="ecu-msg-tab"
          :class="{ active: activeBusId === tab.busId }"
          type="button"
          role="tab"
          :aria-selected="activeBusId === tab.busId"
          @click="activeBusId = tab.busId"
        >
          <span class="ecu-msg-tab-index">{{ idx + 1 }}</span>
          <span class="ecu-msg-tab-name">{{ tab.busName }}</span>
        </button>
      </div>
      <button
        v-if="activeTab"
        class="ecu-msg-filter-toggle"
        type="button"
        :title="filterPanelOpen ? '隐藏过滤器' : '显示过滤器'"
        @click="filterPanelOpen = !filterPanelOpen"
      >
        <span aria-hidden="true">⚙</span>
      </button>
    </div>

    <EcuMessageFilterPanel
      v-if="activeTab"
      v-show="filterPanelOpen"
      :peer-options="peerOptions"
      :protocol-options="protocolOptions"
      :filter-peer-ids="filterPeerIds"
      :filter-protocols="filterProtocols"
      :boundary-ref="editorRef"
      @update:filter-peer-ids="(val) => (filterPeerIds = val)"
      @update:filter-protocols="(val) => (filterProtocols = val)"
      @close="filterPanelOpen = false"
    />

    <div v-if="!activeTab" class="ecu-msg-empty">当前 ECU 未连接任何 CAN BUS。</div>

    <div v-else class="ecu-msg-main">
      <div class="ecu-msg-body" :style="bodyStyle">
        <button
          v-if="collapsedLeft"
          class="ecu-msg-rail left"
          type="button"
          title="展开接收区"
          @click="collapsedLeft = false"
        >
          ▶ 接收报文
        </button>

        <section
          v-if="!collapsedLeft"
          class="ecu-msg-pane rx"
          :style="{ flex: `0 0 ${leftPaneWidth}` }"
          @contextmenu.prevent="openPaneContextMenu('rx', $event)"
        >
          <div class="ecu-msg-pane-head">
            <strong>接收报文</strong>
            <span class="ecu-msg-count">共 {{ filteredRxMessages.length }} 条</span>
            <label class="ecu-rx-broadcast-toggle" title="勾选后包含 broadcast 报文">
              <input v-model="includeRxBroadcast" type="checkbox">
              <span>含 broadcast</span>
            </label>
            <div class="ecu-msg-sort-bar">
              <span class="ecu-msg-sort-label">排序</span>
              <span
                v-for="key in sortKeys"
                :key="key"
                class="ecu-msg-sort-chip"
                :class="{ 'sort-drag-over': sortDragOverKey === key }"
                draggable="true"
                @dragstart="onSortDragStart($event, key)"
                @dragend="onSortDragEnd"
                @dragover.prevent="onSortDragOver($event, key)"
                @dragenter.prevent
                @dragleave="onSortDragLeave"
                @drop="onSortDrop($event, key)"
              >{{ SORT_KEY_LABELS[key] }}</span>
            </div>
            <button class="ecu-msg-collapse" type="button" title="收起接收区" @click="toggleCollapse('left')">◀</button>
          </div>

          <div class="ecu-msg-cards" @contextmenu.prevent="openPaneContextMenu('rx', $event)" @click.self="clearSelection">
            <div
              v-for="message in sortedRxMessages"
              :key="message.id"
              class="ecu-msg-card"
              :class="{ selected: isMessageSelected('rx', message.id), 'has-error': messageErrors.has(message.id) }"
              :style="cardStyle(message, 'rx')"
              :title="messageErrors.has(message.id) ? messageErrors.get(message.id).messages.join('；') : ''"
              @click.stop="onCardClick('rx', message, $event)"
              @contextmenu.prevent.stop="onCardContextMenu('rx', message, $event)"
            >
              <div class="ecu-msg-card-head" :style="cardHeadStyle(message)">
                <div class="ecu-msg-card-id-row">
                  <span class="ecu-msg-card-id">{{ message.idHex }}</span>
                  <span
                    v-for="peer in getMessagePeers(message, 'rx')"
                    :key="peer.id"
                    class="ecu-msg-peer-tag"
                    :style="{ color: peer.color }"
                  >{{ peer.name }}</span>
                </div>
                <span class="ecu-msg-card-name">{{ message.name }}</span>
              </div>
              <div class="ecu-msg-card-body">
                <div
                  v-for="signal in sortedSignals(message)"
                  :key="signal.id"
                  class="ecu-msg-card-signal"
                  :class="{ selected: isSignalSelected('rx', message.id, signal.id) }"
                  @click.stop="onSignalClickInCard('rx', message, signal, $event)"
                  @contextmenu.prevent.stop="onSignalContextMenuInCard('rx', message, signal, $event)"
                >
                  <span class="ecu-msg-signal-name">{{ signal.name }}</span>
                  <span class="ecu-msg-signal-len">{{ signal.length }} bit</span>
                </div>
                <div v-if="!message.signals || message.signals.length === 0" class="ecu-msg-card-empty">
                  暂无 Signal
                </div>
              </div>
            </div>
          </div>
        </section>

        <div v-if="!collapsedLeft && !collapsedRight" class="ecu-msg-splitter" @pointerdown="onSplitPointerDown"></div>

        <section
          v-if="!collapsedRight"
          class="ecu-msg-pane tx"
          :style="{ flex: '1 1 0%', minWidth: 0 }"
          @contextmenu.prevent="openPaneContextMenu('tx', $event)"
        >
          <div class="ecu-msg-pane-head">
            <button class="ecu-msg-collapse" type="button" title="收起发送区" @click="toggleCollapse('right')">▶</button>
            <strong>发送报文</strong>
            <span class="ecu-msg-count">共 {{ filteredTxMessages.length }} 条</span>
            <div class="ecu-msg-sort-bar">
              <span class="ecu-msg-sort-label">排序</span>
              <span
                v-for="key in sortKeys"
                :key="key"
                class="ecu-msg-sort-chip"
                :class="{ 'sort-drag-over': sortDragOverKey === key }"
                draggable="true"
                @dragstart="onSortDragStart($event, key)"
                @dragend="onSortDragEnd"
                @dragover.prevent="onSortDragOver($event, key)"
                @dragenter.prevent
                @dragleave="onSortDragLeave"
                @drop="onSortDrop($event, key)"
              >{{ SORT_KEY_LABELS[key] }}</span>
            </div>
          </div>

          <div class="ecu-msg-cards" @contextmenu.prevent="openPaneContextMenu('tx', $event)" @click.self="clearSelection">
            <div
              v-for="message in sortedTxMessages"
              :key="message.id"
              class="ecu-msg-card"
              :class="{ selected: isMessageSelected('tx', message.id), 'has-error': messageErrors.has(message.id) }"
              :style="cardStyle(message, 'tx')"
              :title="messageErrors.has(message.id) ? messageErrors.get(message.id).messages.join('；') : ''"
              @click.stop="onCardClick('tx', message, $event)"
              @contextmenu.prevent.stop="onCardContextMenu('tx', message, $event)"
            >
              <div class="ecu-msg-card-head" :style="cardHeadStyle(message)">
                <div class="ecu-msg-card-id-row">
                  <span class="ecu-msg-card-id">{{ message.idHex }}</span>
                  <span
                    v-for="peer in getMessagePeers(message, 'tx')"
                    :key="peer.id"
                    class="ecu-msg-peer-tag"
                    :style="{ color: peer.color }"
                  >{{ peer.name }}</span>
                </div>
                <span class="ecu-msg-card-name">{{ message.name }}</span>
              </div>
              <div class="ecu-msg-card-body">
                <div
                  v-for="signal in sortedSignals(message)"
                  :key="signal.id"
                  class="ecu-msg-card-signal"
                  :class="{ selected: isSignalSelected('tx', message.id, signal.id) }"
                  @click.stop="onSignalClickInCard('tx', message, signal, $event)"
                  @contextmenu.prevent.stop="onSignalContextMenuInCard('tx', message, signal, $event)"
                >
                  <span class="ecu-msg-signal-name">{{ signal.name }}</span>
                  <span class="ecu-msg-signal-len">{{ signal.length }} bit</span>
                </div>
                <div v-if="!message.signals || message.signals.length === 0" class="ecu-msg-card-empty">
                  暂无 Signal
                </div>
              </div>
            </div>
          </div>
        </section>

        <button
          v-if="collapsedRight"
          class="ecu-msg-rail right"
          type="button"
          title="展开发送区"
          @click="collapsedRight = false"
        >
          ◀ 发送报文
        </button>
      </div>

      <div v-if="showPropsPanel" class="ecu-msg-props-splitter" @pointerdown="onPropsSplitPointerDown"></div>
      <aside v-if="showPropsPanel" class="ecu-msg-props" :style="propsPanelStyle">
        <div class="ecu-msg-props-title">属性编辑</div>

        <template v-if="selectedEntity.type === 'message'">
          <div class="ecu-prop-grid">
            <label>名称</label>
            <input v-model="selectedEntity.entity.name" class="form-control form-control-sm">

            <label>协议</label>
            <select v-model="selectedEntity.entity.protocol" class="form-select form-select-sm" @change="onMessageProtocolChanged(selectedEntity.entity)">
              <option v-for="protocol in protocolOptions" :key="`m-${protocol.value}`" :value="protocol.value">{{ protocol.label }}</option>
            </select>

            <label>ID</label>
            <div class="ecu-j1939-id-section">
              <input
                v-model="selectedEntity.entity.idHex"
                class="form-control form-control-sm"
                :class="{ 'ecu-id-disabled': selectedMessageIdDisabled }"
                :disabled="selectedMessageIdDisabled"
                :maxlength="selectedMessageIdHexDigits + 2"
                :placeholder="selectedMessageIdPlaceholder"
                :title="selectedMessageIdHint"
                @input="onMessageIdInput(selectedEntity.entity)"
                @blur="onMessageIdBlur(selectedEntity.entity)"
              >

              <template v-if="isSelectedMessageJ1939">
                <button
                  class="ecu-j1939-toggle"
                  type="button"
                  :title="j1939PanelOpen ? '收起 J1939 字段' : '展开 J1939 字段'"
                  @click="j1939PanelOpen = !j1939PanelOpen"
                >
                  <span>{{ j1939PanelOpen ? '▾' : '▸' }} J1939 字段</span>
                </button>

                <div v-if="j1939PanelOpen" class="ecu-j1939-panel">
                  <div class="ecu-prop-grid ecu-j1939-grid">
                    <label>PGN</label>
                    <input
                      v-model="selectedEntity.entity.j1939.pgn"
                      class="form-control form-control-sm"
                      placeholder="65265 或 0x0FEEF"
                      @input="onJ1939FieldInput(selectedEntity.entity, 'pgn')"
                    >

                    <label>Priority</label>
                    <select
                      v-model="selectedEntity.entity.j1939.priority"
                      class="form-select form-select-sm"
                      @change="onJ1939FieldInput(selectedEntity.entity, 'priority')"
                    >
                      <option value="dont_care">don't care</option>
                      <option v-for="p in 8" :key="`j1939-priority-${p - 1}`" :value="p - 1">{{ p - 1 }}</option>
                    </select>

                    <label>SA</label>
                    <input
                      v-model="selectedEntity.entity.j1939.sa"
                      class="form-control form-control-sm"
                      placeholder="131 或 0x83"
                      @input="onJ1939FieldInput(selectedEntity.entity, 'sa')"
                    >

                    <label>DA</label>
                    <input
                      v-model="selectedEntity.entity.j1939.da"
                      class="form-control form-control-sm"
                      :disabled="selectedMessageJ1939DaDisabled"
                      :placeholder="selectedMessageJ1939DaDisabled ? 'broadcast (PF >= 240)' : '39 或 0x27'"
                      @input="onJ1939FieldInput(selectedEntity.entity, 'da')"
                    >
                  </div>

                  <div v-if="selectedMessageJ1939Hint" class="ecu-j1939-hint">
                    {{ selectedMessageJ1939Hint }}
                  </div>

                  <div v-if="selectedMessageJ1939Errors.length > 0" class="ecu-j1939-errors" role="alert">
                    <div class="ecu-j1939-errors-title">J1939 配置错误</div>
                    <ul>
                      <li v-for="(msg, idx) in selectedMessageJ1939Errors" :key="`j1939-err-${idx}`">{{ msg }}</li>
                    </ul>
                  </div>
                </div>
              </template>
            </div>

            <label>发送模式</label>
            <select v-model="selectedEntity.entity.txMode" class="form-select form-select-sm" @change="onMessageTxModeChanged(selectedEntity.entity)">
              <option value="periodic">周期</option>
              <option value="event">事件</option>
              <option value="mixed">混合</option>
            </select>

            <template v-if="shouldShowPeriodMs(selectedEntity.entity)">
              <label>发送周期(ms)</label>
              <input v-model.number="selectedEntity.entity.periodMs" class="form-control form-control-sm" type="number" min="0" @blur="onMessagePeriodBlur(selectedEntity.entity)">
            </template>

            <label>字节序</label>
            <select v-model="selectedEntity.entity.byteOrder" class="form-select form-select-sm">
              <option value="intel">Intel</option>
              <option value="motorola">Motorola</option>
            </select>

            <label>DLC</label>
            <div class="ecu-dlc-control">
              <input
                v-model.number="selectedEntity.entity.dlc"
                class="form-control form-control-sm ecu-dlc-value"
                type="number"
                min="0"
                max="64"
                :title="selectedMessageDlcHint"
                @blur="onMessageDlcBlur(selectedEntity.entity)"
              >
              <select
                v-model="selectedEntity.entity.dlcMode"
                class="form-select form-select-sm ecu-dlc-mode"
                :title="selectedMessageDlcHint"
                @change="onMessageDlcModeChanged(selectedEntity.entity)"
              >
                <option value="fixed">固定</option>
                <option value="variable">不定</option>
              </select>
            </div>

            <label>Signal 布局</label>
            <div class="ecu-layout-launcher">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm ecu-layout-open-btn"
                :disabled="selectedMessageSignals.length === 0"
                @click="openSignalLayoutModal"
              >
                打开可视化布局编辑
              </button>
              <span v-if="selectedMessageSignals.length === 0" class="ecu-layout-launcher-hint">暂无 Signal 可编辑</span>
              <span v-else class="ecu-layout-launcher-hint">
                {{ selectedMessageByteCount }} 字节 / {{ selectedMessageTotalBits }} bit，字节序：{{ selectedMessageByteOrderLabel }}
              </span>
              <span v-if="selectedMessageLayoutErrors.length > 0" class="ecu-layout-error-badge" :title="selectedMessageLayoutErrors.join('；')">
                布局错误 {{ selectedMessageLayoutErrors.length }}
              </span>
            </div>

            <label>发送方</label>
            <div class="ecu-participant-list">
              <div
                v-for="participantId in selectedMessageSenders"
                :key="`snd-item-${participantId}`"
                class="ecu-participant-item"
                :class="{ 'is-default': isDefaultSender(participantId) }"
                @contextmenu.prevent.stop="openSenderDefaultMenu($event, participantId)"
                :title="isDefaultSender(participantId) ? '默认发送方' : '右键设为默认发送方'"
              >
                <span class="ecu-participant-name">{{ resolveParticipantName(participantId) }}</span>
                <span v-if="isDefaultSender(participantId)" class="ecu-participant-default-tag">默认</span>
                <button
                  type="button"
                  class="ecu-participant-icon-btn danger"
                  title="删除发送方"
                  aria-label="删除发送方"
                  @click="removeMessageParticipant('senders', participantId)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 1h4l1 1h3v2H2V2h3l1-1Zm-2 4h8l-.6 9.2A1 1 0 0 1 10.4 15H5.6a1 1 0 0 1-1-.8L4 5Zm2 2v6h1.5V7H6Zm2.5 0v6H10V7H8.5Z" />
                  </svg>
                </button>
              </div>
              <div v-if="selectedMessageSenders.length === 0" class="ecu-participant-empty">暂无发送方</div>
              <button
                type="button"
                class="ecu-participant-add-btn"
                title="新增发送方"
                aria-label="新增发送方"
                :disabled="!canAddMessageParticipant('senders')"
                @click="openParticipantPicker('senders')"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5V2Z" />
                </svg>
              </button>
              <div v-if="senderPickerOpen" class="ecu-participant-picker">
                <div class="ecu-participant-picker-list">
                  <label
                    v-for="opt in getAvailableParticipantOptions('senders')"
                    :key="`snd-pick-${opt.id}`"
                    class="ecu-participant-picker-option"
                  >
                    <input v-model="senderPickerSelection" class="form-check-input" type="checkbox" :value="opt.id">
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
                <div class="ecu-participant-picker-actions">
                  <button type="button" class="btn btn-outline-secondary btn-sm" @click="closeParticipantPicker('senders')">取消</button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="senderPickerSelection.length === 0"
                    @click="confirmParticipantPicker('senders')"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>

            <label>接收方</label>
            <div class="ecu-participant-list">
              <div v-if="selectedMessageIsBroadcast" class="ecu-participant-item is-broadcast" title="broadcast">
                <span class="ecu-participant-name">broadcast</span>
                <button
                  type="button"
                  class="ecu-participant-icon-btn danger"
                  title="取消广播"
                  aria-label="取消广播"
                  @click="disableBroadcastReceivers"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 1h4l1 1h3v2H2V2h3l1-1Zm-2 4h8l-.6 9.2A1 1 0 0 1 10.4 15H5.6a1 1 0 0 1-1-.8L4 5Zm2 2v6h1.5V7H6Zm2.5 0v6H10V7H8.5Z" />
                  </svg>
                </button>
              </div>
              <div
                v-for="participantId in selectedMessageReceivers"
                :key="`rcv-item-${participantId}`"
                class="ecu-participant-item"
              >
                <span class="ecu-participant-name">{{ resolveParticipantName(participantId) }}</span>
                <button
                  type="button"
                  class="ecu-participant-icon-btn danger"
                  title="删除接收方"
                  aria-label="删除接收方"
                  @click="removeMessageParticipant('receivers', participantId)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 1h4l1 1h3v2H2V2h3l1-1Zm-2 4h8l-.6 9.2A1 1 0 0 1 10.4 15H5.6a1 1 0 0 1-1-.8L4 5Zm2 2v6h1.5V7H6Zm2.5 0v6H10V7H8.5Z" />
                  </svg>
                </button>
              </div>
              <div v-if="selectedMessageReceivers.length === 0 && !selectedMessageIsBroadcast" class="ecu-participant-empty">暂无接收方</div>
              <button
                type="button"
                class="ecu-participant-add-btn"
                title="新增接收方"
                aria-label="新增接收方"
                :disabled="!canAddMessageParticipant('receivers')"
                @click="openParticipantPicker('receivers')"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M7 2h2v5h5v2H9v5H7V9H2V7h5V2Z" />
                </svg>
              </button>
              <div v-if="receiverPickerOpen" class="ecu-participant-picker">
                <label class="ecu-participant-picker-option ecu-participant-picker-broadcast">
                  <input v-model="receiverPickerBroadcast" class="form-check-input" type="checkbox">
                  <span>broadcast</span>
                </label>
                <div class="ecu-participant-picker-list">
                  <label
                    v-for="opt in getAvailableParticipantOptions('receivers')"
                    :key="`rcv-pick-${opt.id}`"
                    class="ecu-participant-picker-option"
                  >
                    <input v-model="receiverPickerSelection" class="form-check-input" type="checkbox" :value="opt.id">
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
                <div class="ecu-participant-picker-actions">
                  <button type="button" class="btn btn-outline-secondary btn-sm" @click="closeParticipantPicker('receivers')">取消</button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    :disabled="!canConfirmReceiverPicker"
                    @click="confirmParticipantPicker('receivers')"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>

          <label class="mt-2 mb-1">注释</label>
          <textarea v-model="selectedEntity.entity.comment" class="form-control form-control-sm" rows="2"></textarea>
        </template>

        <template v-else>
          <div class="ecu-prop-grid">
            <label>Signal 名称</label>
            <input v-model="selectedEntity.entity.name" class="form-control form-control-sm">

            <label>起始位</label>
            <input v-model.number="selectedEntity.entity.startBit" class="form-control form-control-sm" type="number" min="0">

            <label>长度(bit)</label>
            <input v-model.number="selectedEntity.entity.length" class="form-control form-control-sm" type="number" min="1">

            <label>Factor</label>
            <input v-model.number="selectedEntity.entity.factor" class="form-control form-control-sm" type="number" step="any">

            <label>Offset</label>
            <input v-model.number="selectedEntity.entity.offset" class="form-control form-control-sm" type="number" step="any">

            <label>物理最小值</label>
            <input
              v-model="selectedEntity.entity.min"
              class="form-control form-control-sm"
              type="number"
              step="any"
              placeholder="可留空"
              @blur="onSignalPhysicalLimitBlur(selectedEntity.entity, 'min')"
            >

            <label>物理最大值</label>
            <input
              v-model="selectedEntity.entity.max"
              class="form-control form-control-sm"
              type="number"
              step="any"
              placeholder="可留空"
              @blur="onSignalPhysicalLimitBlur(selectedEntity.entity, 'max')"
            >

            <label>Signed</label>
            <label class="form-check-label d-flex align-items-center gap-2">
              <input v-model="selectedEntity.entity.signed" class="form-check-input" type="checkbox">有符号
            </label>

            <label>单位</label>
            <input v-model="selectedEntity.entity.unit" class="form-control form-control-sm">
          </div>

          <label class="mt-2 mb-1">注释</label>
          <textarea v-model="selectedEntity.entity.comment" class="form-control form-control-sm" rows="2"></textarea>
        </template>
      </aside>

      <div v-if="signalLayoutModalOpen" class="ecu-layout-modal-mask" @click.self="closeSignalLayoutModal">
        <div class="ecu-layout-modal" role="dialog" aria-modal="true" aria-label="Signal 布局编辑">
          <div class="ecu-layout-modal-head">
            <strong>Signal 可视化布局编辑</strong>
            <button type="button" class="ecu-layout-modal-close" @click="closeSignalLayoutModal">关闭</button>
          </div>
          <div class="ecu-layout-modal-meta">
            <span>报文：{{ selectedMessageEntity?.name || '-' }}</span>
            <span>ID：{{ selectedMessageEntity?.idHex || '-' }}</span>
            <span>字节序：{{ selectedMessageByteOrderLabel }}</span>
            <span>DLC：{{ selectedMessageEntity?.dlc ?? '-' }}</span>
          </div>

          <div v-if="selectedMessageSignals.length === 0" class="ecu-bit-layout-empty">
            当前 Message 暂无 Signal，新增后可在此拖拽调整起始位。
          </div>

          <template v-else>
            <div
              ref="bitGridBodyRef"
              class="ecu-bit-grid-body"
              @pointermove="onSignalDragPointerMove"
              @pointerup="onSignalDragEnd"
              @pointercancel="onSignalDragEnd"
              @pointerleave="onSignalDragEnd"
            >
              <div class="ecu-bit-grid-head">
                <span class="ecu-bit-grid-corner">Byte</span>
                <div class="ecu-bit-grid-head-cells">
                  <span v-for="bit in bitHeaderLabels" :key="`modal-bit-head-${bit}`" class="ecu-bit-grid-head-cell">{{ bit }}</span>
                </div>
              </div>
              <div v-for="row in bitGridRows" :key="`modal-bit-row-${row}`" class="ecu-bit-grid-row">
                <span class="ecu-bit-grid-row-index">{{ row }}</span>
                <div class="ecu-bit-grid-row-cells">
                  <span v-for="bit in bitHeaderLabels" :key="`modal-bit-cell-${row}-${bit}`" class="ecu-bit-grid-cell">{{ row * 8 + bit }}</span>
                  <button
                    v-for="segment in getBitRowSegments(row)"
                    :key="`modal-${segment.key}`"
                    type="button"
                    class="ecu-bit-signal-block"
                    :class="{ 'is-dragging': signalDragState && signalDragState.signalId === segment.signalId }"
                    :style="segment.style"
                    :title="segment.title"
                    @pointerdown.stop.prevent="onSignalDragPointerDown($event, segment.signalId)"
                  >
                    {{ segment.label }}
                  </button>
                </div>
              </div>
            </div>

            <div class="ecu-layout-modal-help">拖拽色块可调整起始位，布局规则按当前字节序自动应用。</div>

            <div v-if="selectedMessageLayoutErrors.length > 0" class="ecu-layout-modal-errors">
              <div class="ecu-layout-modal-errors-title">检测到布局错误</div>
              <ul>
                <li v-for="(msg, idx) in selectedMessageLayoutErrors" :key="`layout-err-${idx}`">{{ msg }}</li>
              </ul>
            </div>
          </template>
        </div>
      </div>

      <div v-if="contextMenu.open" class="ecu-msg-context" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
        <button v-if="contextMenu.target === 'pane'" class="ecu-msg-context-item" type="button" @click="addMessageAtPane(contextMenu.pane)">新增 Message</button>
        <button v-if="contextMenu.target === 'pane'" class="ecu-msg-context-item" type="button" @click="pasteAt(contextMenu.pane)">粘贴</button>
        <button v-if="contextMenu.target === 'message'" class="ecu-msg-context-item" type="button" @click="addSignalToContextMessage">在此 Message 下新增 Signal</button>
        <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item" type="button" @click="copySelection">复制</button>
        <button v-if="contextMenu.target !== 'pane'" class="ecu-msg-context-item danger" type="button" @click="deleteSelection">删除</button>
      </div>

      <div
        v-if="senderDefaultMenu.open"
        class="ecu-msg-context"
        :style="{ left: `${senderDefaultMenu.x}px`, top: `${senderDefaultMenu.y}px` }"
        @click.stop
      >
        <button class="ecu-msg-context-item" type="button" @click="applyDefaultSenderFromMenu">设为默认发送方</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { useEcuMessageWorkspace } from '@/features/can-arch/app/composables/useEcuMessageWorkspace.js';
import { useEcuMessageSelection } from '@/features/can-arch/app/composables/useEcuMessageSelection.js';
import { useEcuMessageCommands } from '@/features/can-arch/app/composables/useEcuMessageCommands.js';
import EcuMessageFilterPanel from './EcuMessageFilterPanel.vue';
import { filterPanelPositionCache, saveFilterPanelOpen } from '@/features/can-arch/app/composables/useFilterPanelCache.js';
import { decodeJ1939Id, encodeJ1939IdFromPgn, formatHex, parseNumberInput } from '@/shared/utils/j1939.js';

const J1939_PRIORITY_DONT_CARE = 'dont_care';

function isJ1939PriorityDontCare(priority) {
  return String(priority ?? '').trim().toLowerCase() === J1939_PRIORITY_DONT_CARE;
}

const propsPanelWidthCache = { width: 300 };

const props = defineProps({
  ecu: {
    type: Object,
    required: true,
  },
  busTabs: {
    type: Array,
    default: () => [],
  },
  height: {
    type: Number,
    default: 620,
  },
  ecuNodes: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'switch-ecu']);

function onEcuSwitch(ecuId) {
  if (!ecuId || ecuId === props.ecu?.id) return;
  emit('switch-ecu', ecuId);
}

const ecuRef = toRef(props, 'ecu');
const busTabsRef = toRef(props, 'busTabs');

const {
  protocolOptions,
  activeBusId,
  activeTab,
  peerOptions,
  protocolValues,
  filterPeerIds,
  filterProtocols,
  includeRxBroadcast,
  rxMessages,
  txMessages,
  filteredRxMessages,
  filteredTxMessages,
  rxRows,
  txRows,
  getRowsByPane,
  addMessage,
  addSignalToMessage,
  syncMessageProtocolColor,
  protocolColor,
  messageErrors,
} = useEcuMessageWorkspace({
  ecuRef,
  busTabsRef,
});

const {
  selectedPane,
  selectedKeys,
  selectedEntity,
  clearSelection,
  ensureSelected,
  onRowClick,
} = useEcuMessageSelection({
  getRowsByPane,
});

const {
  contextMenu,
  closeContextMenu,
  openPaneContextMenu,
  openRowContextMenu,
  addMessageAtPane,
  addSignalToContextMessage,
  deleteSelection,
  copySelection,
  pasteAt,
} = useEcuMessageCommands({
  activeTab,
  rxMessages,
  txMessages,
  getRowsByPane,
  selectedPane,
  selectedKeys,
  clearSelection,
  ensureSelected,
  addMessage,
  addSignalToMessage,
  peerOptions,
  currentEcuId: computed(() => props.ecu?.id || ''),
});

const splitRatio = ref(0.5);

const SORT_KEY_LABELS = {
  protocol: '协议',
  peer: '对端ECU',
  idHex: 'ID',
  name: '报文名',
};

const sortKeys = ref(['protocol', 'peer', 'idHex', 'name']);

function getPeerNameForSort(message, pane) {
  const peerIds = pane === 'rx'
    ? (Array.isArray(message.senders) ? message.senders : [])
    : (Array.isArray(message.receivers) ? message.receivers : []);
  if (peerIds.length === 0) return '';
  const firstPeer = props.ecuNodes.find((n) => n.id === peerIds[0]);
  return firstPeer?.name || peerIds[0] || '';
}

function getSortValue(message, pane, key) {
  switch (key) {
    case 'protocol': return message.protocol || '';
    case 'peer': return getPeerNameForSort(message, pane);
    case 'idHex': return parseInt(message.idHex || '0', 16);
    case 'name': return message.name || '';
    default: return '';
  }
}

function sortMessagesByKeys(messages, pane) {
  return [...messages].sort((a, b) => {
    for (const key of sortKeys.value) {
      const va = getSortValue(a, pane, key);
      const vb = getSortValue(b, pane, key);
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  });
}

const sortedRxMessages = computed(() => sortMessagesByKeys(filteredRxMessages.value, 'rx'));
const sortedTxMessages = computed(() => sortMessagesByKeys(filteredTxMessages.value, 'tx'));

let sortDragKey = null;
const sortDragOverKey = ref(null);

function onSortDragStart(event, key) {
  sortDragKey = key;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', key);
}

function onSortDragEnd() {
  sortDragKey = null;
  sortDragOverKey.value = null;
}

function onSortDragOver(event, key) {
  event.dataTransfer.dropEffect = 'move';
  sortDragOverKey.value = key;
}

function onSortDragLeave() {
  sortDragOverKey.value = null;
}

function onSortDrop(event, targetKey) {
  sortDragOverKey.value = null;
  if (!sortDragKey || sortDragKey === targetKey) return;
  const keys = [...sortKeys.value];
  const fromIdx = keys.indexOf(sortDragKey);
  const toIdx = keys.indexOf(targetKey);
  if (fromIdx < 0 || toIdx < 0) return;
  keys.splice(fromIdx, 1);
  keys.splice(toIdx, 0, sortDragKey);
  sortKeys.value = keys;
  sortDragKey = null;
}

const collapsedLeft = ref(false);
const collapsedRight = ref(false);
const splitDrag = ref(null);
const editorRef = ref(null);
const filterPanelOpen = ref(filterPanelPositionCache.open);

const propsPanelWidth = ref(propsPanelWidthCache.width);
const propsPanelDrag = ref(null);
const bitGridBodyRef = ref(null);
const signalDragState = ref(null);
const signalLayoutModalOpen = ref(false);
const senderPickerOpen = ref(false);
const receiverPickerOpen = ref(false);
const senderPickerSelection = ref([]);
const receiverPickerSelection = ref([]);
const receiverPickerBroadcast = ref(false);
const j1939PanelOpen = ref(true);
const j1939SyncState = ref({ source: '', updating: false });
const senderDefaultMenu = ref({
  open: false,
  x: 0,
  y: 0,
  participantId: '',
});

const BIT_GRID_CELL_WIDTH = 28;
const BIT_GRID_ROW_HEIGHT = 30;
const BIT_GRID_ROW_GAP = 3;
const BIT_GRID_LABEL_WIDTH = 40;
const BIT_GRID_LABEL_GAP = 4;
const bitHeaderLabels = Object.freeze([7, 6, 5, 4, 3, 2, 1, 0]);
const BIT_SIGNAL_COLORS = Object.freeze([
  '#4A90E2', '#F6A04D', '#E96BB2', '#38E875', '#AF85E8', '#E9D05E', '#47C7C9', '#EE7B6E',
]);

const showPropsPanel = computed(() => {
  return selectedKeys.value.length === 1 && selectedEntity.value;
});

const bodyStyle = computed(() => {
  if (!showPropsPanel.value) return {};
  return { flex: '1 1 0%', minWidth: 0 };
});

const propsPanelStyle = computed(() => {
  return { width: `${propsPanelWidth.value}px`, flexShrink: 0 };
});

watch(filterPanelOpen, (val) => {
  saveFilterPanelOpen(val);
});

const leftPaneWidth = computed(() => {
  if (collapsedRight.value) return '100%';
  return `${Math.max(5, Math.min(95, splitRatio.value * 100))}%`;
});

const participantOptions = computed(() => {
  const ecu = ecuRef.value;
  const peers = peerOptions.value || [];
  const options = [{ id: ecu.id, name: `${ecu.name} (当前)` }];
  for (const peer of peers) {
    options.push({ id: peer.id, name: peer.name });
  }
  return options;
});

const selectedMessageEntity = computed(() => {
  if (selectedEntity.value?.type !== 'message') return null;
  return selectedEntity.value.entity || null;
});

const selectedMessageIdBitLimit = computed(() => {
  return resolveMessageIdBitLimit(selectedMessageEntity.value?.protocol);
});

const selectedMessageIdHexDigits = computed(() => {
  return selectedMessageIdBitLimit.value === 29 ? 8 : 3;
});

const selectedMessageIdMaxHex = computed(() => {
  const maxValue = selectedMessageIdBitLimit.value === 29 ? 0x1FFFFFFF : 0x7FF;
  return `0x${maxValue.toString(16).toUpperCase()}`;
});

const selectedMessagePriorityDontCare = computed(() => {
  const msg = selectedMessageEntity.value;
  return isJ1939PriorityDontCare(msg?.j1939?.priority);
});

const selectedMessageIdDisabled = computed(() => {
  return isSelectedMessageJ1939.value && selectedMessagePriorityDontCare.value;
});

const selectedMessageIdHint = computed(() => {
  if (selectedMessageIdDisabled.value) {
    return "Priority 为 don't care 时对应多个 ID，ID 字段禁用且不参与校验。";
  }
  const modeText = selectedMessageIdBitLimit.value === 29 ? '29 bit（扩展帧）' : '11 bit（标准帧）';
  return `当前协议使用 ${modeText}，允许范围 0x0 - ${selectedMessageIdMaxHex.value}。`;
});

const selectedMessageIdPlaceholder = computed(() => {
  return selectedMessageIdBitLimit.value === 29 ? '0x18FF00AA' : '0x7FF';
});

const selectedMessageDlcHint = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg) return '';
  if (msg.dlcMode === 'variable') {
    return '不定长度：这里填写理论最大字节数，导出与容量评估将按该上限处理。';
  }
  return '固定长度：报文按该字节数发送与解析。';
});

const selectedMessageSenders = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg || !Array.isArray(msg.senders)) return [];
  return msg.senders;
});

const selectedMessageReceivers = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg || !Array.isArray(msg.receivers)) return [];
  return msg.receivers;
});

const selectedMessageIsBroadcast = computed(() => {
  return selectedMessageEntity.value?.receiverMode === 'broadcast';
});

const canConfirmReceiverPicker = computed(() => {
  return receiverPickerBroadcast.value || receiverPickerSelection.value.length > 0;
});

const selectedMessageByteOrder = computed(() => {
  return selectedMessageEntity.value?.byteOrder === 'motorola' ? 'motorola' : 'intel';
});

const selectedMessageByteOrderLabel = computed(() => {
  return selectedMessageByteOrder.value === 'motorola' ? 'Motorola' : 'Intel';
});

const selectedMessageTotalBits = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg) return 0;
  const dlc = Number.isInteger(msg.dlc) ? msg.dlc : 0;
  return Math.max(8, Math.min(64, dlc) * 8);
});

const selectedMessageByteCount = computed(() => {
  const bits = selectedMessageTotalBits.value;
  if (!bits) return 1;
  return Math.max(1, Math.min(64, Math.ceil(bits / 8)));
});

const bitGridRows = computed(() => {
  return Array.from({ length: selectedMessageByteCount.value }, (_, idx) => idx);
});

const selectedMessageSignals = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg || !Array.isArray(msg.signals)) return [];
  return [...msg.signals]
    .sort((a, b) => (a.startBit ?? 0) - (b.startBit ?? 0))
    .map((signal, idx) => ({
      signal,
      id: signal.id,
      name: signal.name || `SIG_${idx + 1}`,
      startBit: Number.isInteger(signal.startBit) ? signal.startBit : 0,
      length: Number.isInteger(signal.length) ? Math.max(1, signal.length) : 1,
      color: BIT_SIGNAL_COLORS[idx % BIT_SIGNAL_COLORS.length],
      zIndex: 20 + idx,
    }));
});

const selectedMessageErrorInfo = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg?.id) return null;
  return messageErrors.value?.get?.(msg.id) || null;
});

const selectedMessageLayoutErrors = computed(() => {
  const info = selectedMessageErrorInfo.value;
  if (!info || !Array.isArray(info.types) || !Array.isArray(info.messages)) return [];
  const result = [];
  for (let idx = 0; idx < info.types.length; idx += 1) {
    if (info.types[idx] === 'layout_error' && info.messages[idx]) {
      result.push(info.messages[idx]);
    }
  }
  return result;
});

const selectedMessageJ1939Errors = computed(() => {
  const info = selectedMessageErrorInfo.value;
  if (!info || !Array.isArray(info.types) || !Array.isArray(info.messages)) return [];
  const result = [];
  for (let idx = 0; idx < info.types.length; idx += 1) {
    if (info.types[idx] === 'j1939_error' && info.messages[idx]) {
      result.push(info.messages[idx]);
    }
  }
  return result;
});

const isSelectedMessageJ1939 = computed(() => {
  return selectedMessageEntity.value?.protocol === 'j1939';
});

const selectedMessageJ1939DaDisabled = computed(() => {
  const msg = selectedMessageEntity.value;
  const pgn = parseNumberInput(msg?.j1939?.pgn);
  if (!Number.isInteger(pgn)) return false;
  const pf = (pgn >> 8) & 0xFF;
  return pf >= 240;
});

const selectedMessageJ1939Hint = computed(() => {
  const msg = selectedMessageEntity.value;
  if (!msg || msg.protocol !== 'j1939') return '';
  const pgn = parseNumberInput(msg?.j1939?.pgn);
  if (!Number.isInteger(pgn) || pgn < 0 || pgn > 0x3FFFF) return '';
  const pf = (pgn >> 8) & 0xFF;
  if (pf >= 240) {
    return 'PF >= 240 (PDU2): DA 固定为 broadcast，ID 中 PS 由 PGN 低 8 位决定。';
  }
  return 'PF < 240 (PDU1): DA 必填，且 PGN 低 8 位必须为 0。';
});

function expandSignalBitsByByteOrder(startBit, length, byteOrder) {
  const bits = [];
  if (byteOrder === 'motorola') {
    // Vector-style Motorola startBit: treat startBit as LSB index.
    let current = startBit;
    for (let idx = 0; idx < length; idx += 1) {
      bits.push(current);
      if (current % 8 === 7) {
        current -= 15;
      } else {
        current += 1;
      }
    }
    return bits;
  }

  for (let idx = 0; idx < length; idx += 1) {
    bits.push(startBit + idx);
  }
  return bits;
}

const bitRowSegmentsMap = computed(() => {
  const map = new Map();
  for (const row of bitGridRows.value) {
    map.set(row, []);
  }

  const byteOrder = selectedMessageByteOrder.value;

  for (const item of selectedMessageSignals.value) {
    const bits = expandSignalBitsByByteOrder(item.startBit, item.length, byteOrder)
      .filter((bit) => bit >= 0 && bit < selectedMessageTotalBits.value);
    const bitsByRow = new Map();
    for (const bit of bits) {
      const row = Math.floor(bit / 8);
      if (!bitsByRow.has(row)) {
        bitsByRow.set(row, []);
      }
      bitsByRow.get(row).push(bit);
    }

    for (const row of bitGridRows.value) {
      const rowBits = (bitsByRow.get(row) || []).sort((a, b) => a - b);
      if (rowBits.length === 0) continue;

      const rowStart = row * 8;
      const cols = rowBits
        .map((bit) => 7 - (bit - rowStart))
        .filter((col) => col >= 0 && col <= 7)
        .sort((a, b) => a - b);
      if (cols.length === 0) continue;

      let segStartCol = cols[0];
      let prevCol = cols[0];
      let segIndex = 0;

      const pushSegment = (startCol, endCol, segmentIdx) => {
        const span = endCol - startCol + 1;
        const left = startCol * BIT_GRID_CELL_WIDTH + 1;
        const includesStartBit = rowBits.includes(item.startBit);
        const showLabel = includesStartBit ? (segmentIdx === 0) : (segmentIdx === 0);
        map.get(row).push({
          key: `${item.id}-${row}-${startCol}-${endCol}-${segmentIdx}`,
          signalId: item.id,
          label: showLabel ? item.name : '',
          title: `${item.name}  起始位: ${item.startBit}  长度: ${item.length} bit  字节序: ${selectedMessageByteOrderLabel.value}`,
          style: {
            left: `${left}px`,
            width: `${Math.max(10, span * BIT_GRID_CELL_WIDTH - 2)}px`,
            top: '3px',
            height: `${BIT_GRID_ROW_HEIGHT - 6}px`,
            backgroundColor: item.color,
            zIndex: item.zIndex,
          },
        });
      };

      for (let idx = 1; idx < cols.length; idx += 1) {
        const col = cols[idx];
        if (col === prevCol + 1) {
          prevCol = col;
          continue;
        }
        pushSegment(segStartCol, prevCol, segIndex);
        segIndex += 1;
        segStartCol = col;
        prevCol = col;
      }
      pushSegment(segStartCol, prevCol, segIndex);
    }
  }

  return map;
});

function getBitRowSegments(row) {
  return bitRowSegmentsMap.value.get(row) || [];
}

function resolveMessageIdBitLimit(protocol) {
  if (protocol === 'generic_ext' || protocol === 'j1939') return 29;
  return 11;
}

function parseHexId(rawValue) {
  const text = String(rawValue ?? '').trim();
  const cleaned = text.replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatHexId(value, bitLimit) {
  const normalized = Math.max(0, Number.isInteger(value) ? value : 0);
  const digits = bitLimit === 29 ? 8 : 3;
  return `0x${normalized.toString(16).toUpperCase().padStart(digits, '0')}`;
}

function clampMessageIdByProtocol(message) {
  if (!message) return;
  const bitLimit = resolveMessageIdBitLimit(message.protocol);
  const maxValue = bitLimit === 29 ? 0x1FFFFFFF : 0x7FF;
  const parsed = parseHexId(message.idHex);
  const safeValue = parsed == null ? 0 : parsed;
  const clamped = Math.min(maxValue, Math.max(0, safeValue));
  message.idHex = formatHexId(clamped, bitLimit);
}

function ensureJ1939Struct(message) {
  if (!message) return null;
  if (!message.j1939 || typeof message.j1939 !== 'object') {
    message.j1939 = {
      enabled: message.protocol === 'j1939',
      mode: 'id',
      id: '',
      pgn: '',
      priority: 6,
      sa: '',
      da: '',
    };
  }
  return message.j1939;
}

function withJ1939SyncLock(source, fn) {
  j1939SyncState.value = { source, updating: true };
  try {
    fn();
  } finally {
    j1939SyncState.value = { source: '', updating: false };
  }
}

function syncJ1939FromId(message, options = {}) {
  if (!message || message.protocol !== 'j1939') return;
  const j1939 = ensureJ1939Struct(message);
  if (isJ1939PriorityDontCare(j1939.priority) && !options.force) return;
  const parsedId = parseNumberInput(message.idHex);
  if (!Number.isInteger(parsedId)) return;
  const decoded = decodeJ1939Id(parsedId);
  if (!decoded.valid) return;

  const apply = () => {
    j1939.id = formatHex(parsedId, 8);
    j1939.pgn = String(decoded.PGN);
    j1939.priority = decoded.P;
    j1939.sa = String(decoded.SA);
    j1939.da = decoded.isBroadcast ? 'broadcast' : String(decoded.destinationAddress);
  };

  if (options.lockSource) {
    withJ1939SyncLock(options.lockSource, apply);
    return;
  }
  apply();
}

function trySyncIdFromJ1939(message, options = {}) {
  if (!message || message.protocol !== 'j1939') return false;
  const j1939 = ensureJ1939Struct(message);
  if (isJ1939PriorityDontCare(j1939.priority)) {
    return false;
  }
  const pgn = parseNumberInput(j1939.pgn);
  const priority = parseNumberInput(j1939.priority);
  const sa = parseNumberInput(j1939.sa);
  if (!Number.isInteger(pgn) || !Number.isInteger(priority) || !Number.isInteger(sa)) {
    return false;
  }

  const pf = (pgn >> 8) & 0xFF;
  const isPdu2 = pf >= 240;
  const da = isPdu2 ? 0 : parseNumberInput(j1939.da);
  if (!isPdu2 && !Number.isInteger(da)) {
    return false;
  }

  const encoded = encodeJ1939IdFromPgn(pgn, priority, sa, da);
  if (!encoded.valid) {
    return false;
  }

  const apply = () => {
    message.idHex = formatHex(encoded.id, 8);
    j1939.id = formatHex(encoded.id, 8);
    if (isPdu2) {
      j1939.da = 'broadcast';
    }
  };

  if (options.lockSource) {
    withJ1939SyncLock(options.lockSource, apply);
    return true;
  }
  apply();
  return true;
}

function ensureMessageDlcMode(message) {
  if (!message) return;
  if (message.dlcMode !== 'variable' && message.dlcMode !== 'fixed') {
    message.dlcMode = 'fixed';
  }
}

function normalizeMessageDlc(message) {
  if (!message) return;
  ensureMessageDlcMode(message);
  const parsed = Number.parseInt(message.dlc, 10);
  const safe = Number.isInteger(parsed) ? parsed : 8;
  message.dlc = Math.max(0, Math.min(64, safe));
}

function normalizeMessageSignalLayout(message) {
  if (!message || !Array.isArray(message.signals)) return;
  const dlc = Number.isInteger(message.dlc) ? Math.max(0, Math.min(64, message.dlc)) : 8;
  const totalBits = Math.max(8, dlc * 8);
  const byteOrder = message.byteOrder === 'motorola' ? 'motorola' : 'intel';

  const resolveClosestValidStart = (rawStart, length) => {
    const fallback = Math.max(0, Math.min(totalBits - 1, rawStart));
    if (byteOrder === 'intel') {
      const maxStart = Math.max(0, totalBits - length);
      return Math.max(0, Math.min(maxStart, fallback));
    }

    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let candidate = 0; candidate < totalBits; candidate += 1) {
      const bits = expandSignalBitsByByteOrder(candidate, length, 'motorola');
      const valid = bits.every((bit) => bit >= 0 && bit < totalBits);
      if (!valid) continue;
      const dist = Math.abs(candidate - fallback);
      if (dist < bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
    return best == null ? 0 : best;
  };

  for (const signal of message.signals) {
    if (!signal) continue;
    const rawLength = Number.parseInt(signal.length, 10);
    const length = Number.isInteger(rawLength) ? Math.max(1, Math.min(totalBits, rawLength)) : 1;
    const rawStart = Number.parseInt(signal.startBit, 10);
    const start = Number.isInteger(rawStart) ? resolveClosestValidStart(rawStart, length) : resolveClosestValidStart(0, length);
    signal.length = length;
    signal.startBit = start;
  }
}

function openSignalLayoutModal() {
  signalLayoutModalOpen.value = true;
}

function closeSignalLayoutModal() {
  signalLayoutModalOpen.value = false;
  signalDragState.value = null;
}

function shouldShowPeriodMs(message) {
  return !!message && message.txMode !== 'event';
}

function onMessageProtocolChanged(message) {
  if (!message) return;
  syncMessageProtocolColor(message);
  clampMessageIdByProtocol(message);
  if (message.protocol === 'j1939') {
    ensureJ1939Struct(message);
    syncJ1939FromId(message, { lockSource: 'id' });
    j1939PanelOpen.value = true;
  }
}

function onMessageIdInput(message) {
  if (!message) return;
  if (message.protocol !== 'j1939') return;
  if (isJ1939PriorityDontCare(message?.j1939?.priority)) return;
  if (j1939SyncState.value.updating && j1939SyncState.value.source === 'j1939') return;
  syncJ1939FromId(message, { lockSource: 'id' });
}

function onMessageIdBlur(message) {
  clampMessageIdByProtocol(message);
  if (!message) return;
  if (message.protocol !== 'j1939') return;
  if (isJ1939PriorityDontCare(message?.j1939?.priority)) return;
  syncJ1939FromId(message, { lockSource: 'id' });
}

function onJ1939FieldInput(message, field) {
  if (!message || message.protocol !== 'j1939') return;
  if (j1939SyncState.value.updating && j1939SyncState.value.source === 'id') return;

  if (field === 'priority' && isJ1939PriorityDontCare(message?.j1939?.priority)) {
    return;
  }

  if (field === 'pgn') {
    const j1939 = ensureJ1939Struct(message);
    const pgn = parseNumberInput(j1939.pgn);
    if (Number.isInteger(pgn)) {
      const pf = (pgn >> 8) & 0xFF;
      if (pf >= 240) {
        j1939.da = 'broadcast';
      }
    }
  }

  trySyncIdFromJ1939(message, { lockSource: 'j1939' });
}

function onMessageTxModeChanged(message) {
  if (!message) return;
  if (message.txMode === 'event') {
    message.periodMs = null;
    return;
  }
  if (!Number.isInteger(message.periodMs) || message.periodMs < 0) {
    message.periodMs = 100;
  }
}

function onMessagePeriodBlur(message) {
  if (!message || !shouldShowPeriodMs(message)) return;
  if (!Number.isInteger(message.periodMs) || message.periodMs < 0) {
    message.periodMs = 100;
  }
}

function onMessageDlcModeChanged(message) {
  ensureMessageDlcMode(message);
  normalizeMessageDlc(message);
  normalizeMessageSignalLayout(message);
}

function onMessageDlcBlur(message) {
  normalizeMessageDlc(message);
  normalizeMessageSignalLayout(message);
}

function onSignalPhysicalLimitBlur(signal, key) {
  if (!signal || (key !== 'min' && key !== 'max')) return;
  const raw = signal[key];
  if (raw === '' || raw === null || raw === undefined) {
    signal[key] = null;
    return;
  }
  const parsed = Number.parseFloat(String(raw).trim());
  signal[key] = Number.isFinite(parsed) ? parsed : null;
}

function resolveParticipantName(participantId) {
  const matched = participantOptions.value.find((item) => item.id === participantId);
  return matched?.name || participantId;
}

function ensureMessageParticipantList(message, key) {
  if (!message) return [];
  if (!Array.isArray(message[key])) {
    message[key] = [];
  }
  return message[key];
}

function ensureMessageReceiverMode(message) {
  if (!message) return;
  message.receiverMode = message.receiverMode === 'broadcast' ? 'broadcast' : 'nodes';
  if (message.receiverMode === 'broadcast') {
    message.receivers = [];
  }
}

function getAvailableParticipantOptions(key) {
  const message = selectedMessageEntity.value;
  if (!message) return [];
  const list = ensureMessageParticipantList(message, key);
  return participantOptions.value.filter((item) => !list.includes(item.id));
}

function canAddMessageParticipant(key) {
  if (key === 'receivers') {
    return !!selectedMessageEntity.value;
  }
  return getAvailableParticipantOptions(key).length > 0;
}

function openParticipantPicker(key) {
  if (!canAddMessageParticipant(key)) return;
  senderPickerOpen.value = key === 'senders';
  receiverPickerOpen.value = key === 'receivers';
  if (key === 'senders') {
    senderPickerSelection.value = [];
  } else {
    receiverPickerSelection.value = [];
    receiverPickerBroadcast.value = selectedMessageIsBroadcast.value;
  }
}

function closeParticipantPicker(key) {
  if (key === 'senders') {
    senderPickerOpen.value = false;
    senderPickerSelection.value = [];
    return;
  }
  receiverPickerOpen.value = false;
  receiverPickerSelection.value = [];
  receiverPickerBroadcast.value = false;
}

function hasEffectiveReceiver(nextReceivers, nextReceiverIsBroadcast = false) {
  return nextReceiverIsBroadcast || (Array.isArray(nextReceivers) && nextReceivers.length > 0);
}

function hasCurrentEcuSender(message) {
  const currentEcuId = props.ecu?.id;
  return !!currentEcuId && Array.isArray(message?.senders) && message.senders.includes(currentEcuId);
}

function hasCurrentEcuReceiver(message) {
  const currentEcuId = props.ecu?.id;
  if (!currentEcuId) return false;
  if (message?.receiverMode === 'broadcast') return true;
  return Array.isArray(message?.receivers) && message.receivers.includes(currentEcuId);
}

function shouldDeleteMessage(nextSenders, nextReceivers, nextReceiverIsBroadcast = false) {
  return nextSenders.length === 0 && !hasEffectiveReceiver(nextReceivers, nextReceiverIsBroadcast);
}

function confirmParticipantMutation(message, key, nextSenders, nextReceivers, nextReceiverIsBroadcast = false) {
  const currentPane = selectedEntity.value?.pane;
  const currentSenders = Array.isArray(message?.senders) ? message.senders : [];
  const currentReceivers = Array.isArray(message?.receivers) ? message.receivers : [];

  if (shouldDeleteMessage(nextSenders, nextReceivers, nextReceiverIsBroadcast)) {
    return window.confirm('发送方和接收方都为空，会导致 message 被删除，确认继续吗？');
  }

  if (key === 'senders'
    && currentPane === 'tx'
    && hasCurrentEcuSender(message)
    && !nextSenders.includes(props.ecu?.id)) {
    return window.confirm('修改后当前 ECU 不再是发送方，message 会从发送报文区消失，确认继续吗？');
  }

  if (key === 'receivers'
    && currentPane === 'rx'
    && message?.receiverMode === 'broadcast'
    && !nextReceiverIsBroadcast) {
    return window.confirm('关闭 broadcast 后，message 会从接收报文区消失，确认继续吗？');
  }

  if (key === 'receivers'
    && currentPane === 'rx'
    && hasCurrentEcuReceiver(message)
    && !nextReceiverIsBroadcast
    && !nextReceivers.includes(props.ecu?.id)) {
    return window.confirm('修改后当前 ECU 不再是接收方，message 会从接收报文区消失，确认继续吗？');
  }

  return true;
}

function confirmParticipantPicker(key) {
  const message = selectedMessageEntity.value;
  if (!message) return;
  const currentSenders = Array.isArray(message.senders) ? [...message.senders] : [];
  const currentReceivers = Array.isArray(message.receivers) ? [...message.receivers] : [];
  const picked = key === 'senders' ? senderPickerSelection.value : receiverPickerSelection.value;
  const nextSenders = key === 'senders'
    ? [...new Set([...currentSenders, ...picked])]
    : currentSenders;
  const nextReceivers = key === 'receivers'
    ? (receiverPickerBroadcast.value ? [] : [...new Set([...currentReceivers, ...picked])])
    : currentReceivers;

  if (!confirmParticipantMutation(message, key, nextSenders, nextReceivers, receiverPickerBroadcast.value)) {
    return;
  }

  if (shouldDeleteMessage(nextSenders, nextReceivers, receiverPickerBroadcast.value)) {
    closeParticipantPicker(key);
    deleteSelection();
    return;
  }

  message.senders = nextSenders;
  message.receivers = nextReceivers;
  message.receiverMode = receiverPickerBroadcast.value ? 'broadcast' : 'nodes';
  closeParticipantPicker(key);
}

function removeMessageParticipant(key, participantId) {
  const message = selectedMessageEntity.value;
  if (!message) return;
  const list = ensureMessageParticipantList(message, key);
  const next = list.filter((id) => id !== participantId);

  const currentSenders = Array.isArray(message.senders) ? [...message.senders] : [];
  const currentReceivers = Array.isArray(message.receivers) ? [...message.receivers] : [];
  const nextSenders = key === 'senders' ? next : currentSenders;
  const nextReceivers = key === 'receivers' ? next : currentReceivers;

  if (!confirmParticipantMutation(message, key, nextSenders, nextReceivers, message.receiverMode === 'broadcast')) {
    return;
  }

  if (shouldDeleteMessage(nextSenders, nextReceivers, message.receiverMode === 'broadcast')) {
    deleteSelection();
    return;
  }

  message[key] = next;
  if (key === 'receivers') {
    message.receiverMode = 'nodes';
  }
}

function disableBroadcastReceivers() {
  const message = selectedMessageEntity.value;
  if (!message) return;
  const currentSenders = Array.isArray(message.senders) ? [...message.senders] : [];
  const nextSenders = currentSenders;
  const nextReceivers = [];

  if (!confirmParticipantMutation(message, 'receivers', nextSenders, nextReceivers, false)) {
    return;
  }

  if (shouldDeleteMessage(nextSenders, nextReceivers, false)) {
    deleteSelection();
    return;
  }

  message.receiverMode = 'nodes';
}

function isDefaultSender(participantId) {
  return selectedMessageSenders.value[0] === participantId;
}

function setDefaultSender(participantId) {
  const message = selectedMessageEntity.value;
  if (!message) return;
  const list = ensureMessageParticipantList(message, 'senders');
  if (!list.includes(participantId)) return;
  if (list[0] === participantId) return;
  message.senders = [participantId, ...list.filter((id) => id !== participantId)];
}

function openSenderDefaultMenu(event, participantId) {
  if (!participantId) return;
  closeContextMenu();
  senderDefaultMenu.value = {
    open: true,
    x: event.clientX,
    y: event.clientY,
    participantId,
  };
}

function closeSenderDefaultMenu() {
  senderDefaultMenu.value.open = false;
}

function applyDefaultSenderFromMenu() {
  const participantId = senderDefaultMenu.value.participantId;
  setDefaultSender(participantId);
  closeSenderDefaultMenu();
}

function resolveBitIndexFromPointer(event) {
  const gridBody = bitGridBodyRef.value;
  if (!gridBody) return null;
  const rect = gridBody.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const localX = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
  const localY = Math.max(0, Math.min(rect.height - 1, event.clientY - rect.top));

  const rowPitch = BIT_GRID_ROW_HEIGHT + BIT_GRID_ROW_GAP;
  const rowsTop = rowPitch;
  const yInRows = localY - rowsTop;
  if (yInRows < 0) return null;
  const row = Math.max(0, Math.min(selectedMessageByteCount.value - 1, Math.floor(yInRows / rowPitch)));

  const xInCells = localX - (BIT_GRID_LABEL_WIDTH + BIT_GRID_LABEL_GAP);
  if (xInCells < 0) return null;
  const col = Math.max(0, Math.min(7, Math.floor(xInCells / BIT_GRID_CELL_WIDTH)));
  const bitInByte = 7 - col;
  return row * 8 + bitInByte;
}

function onSignalDragPointerDown(event, signalId) {
  signalDragState.value = { signalId };
  if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
}

function onSignalDragPointerMove(event) {
  if (!signalDragState.value) return;
  const message = selectedMessageEntity.value;
  if (!message || !Array.isArray(message.signals)) return;

  const signal = message.signals.find((item) => item.id === signalDragState.value.signalId);
  if (!signal) return;

  const targetBit = resolveBitIndexFromPointer(event);
  if (targetBit == null) return;

  const rawLength = Number.parseInt(signal.length, 10);
  const length = Number.isInteger(rawLength) ? Math.max(1, rawLength) : 1;
  const totalBits = selectedMessageTotalBits.value;
  const byteOrder = selectedMessageByteOrder.value;

  if (byteOrder === 'intel') {
    const maxStart = Math.max(0, totalBits - length);
    signal.startBit = Math.max(0, Math.min(maxStart, targetBit));
    return;
  }

  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let candidate = 0; candidate < totalBits; candidate += 1) {
    const bits = expandSignalBitsByByteOrder(candidate, length, 'motorola');
    if (!bits.every((bit) => bit >= 0 && bit < totalBits)) continue;
    const dist = Math.abs(candidate - targetBit);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  signal.startBit = best == null ? 0 : best;
}

function onSignalDragEnd(event) {
  if (event?.currentTarget && typeof event.currentTarget.releasePointerCapture === 'function') {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore pointer-capture release errors from browser edge cases.
    }
  }
  signalDragState.value = null;
}

watch(selectedMessageEntity, (message) => {
  closeSenderDefaultMenu();
  senderPickerOpen.value = false;
  receiverPickerOpen.value = false;
  senderPickerSelection.value = [];
  receiverPickerSelection.value = [];
  receiverPickerBroadcast.value = false;
  if (!message) return;
  ensureMessageDlcMode(message);
  ensureMessageReceiverMode(message);
  normalizeMessageDlc(message);
  normalizeMessageSignalLayout(message);
  clampMessageIdByProtocol(message);
  ensureJ1939Struct(message);
  if (message.protocol === 'j1939') {
    if (isJ1939PriorityDontCare(message?.j1939?.priority)) {
      j1939PanelOpen.value = true;
      return;
    }
    syncJ1939FromId(message, { lockSource: 'id' });
    j1939PanelOpen.value = true;
  } else {
    j1939PanelOpen.value = false;
  }
  if (message.txMode === 'event' && message.periodMs !== null) {
    message.periodMs = null;
  }
}, { immediate: true });

watch(showPropsPanel, (visible) => {
  if (!visible) {
    closeSignalLayoutModal();
  }
});

function sortedSignals(message) {
  const signals = message?.signals || [];
  return [...signals].sort((a, b) => (a.startBit ?? 0) - (b.startBit ?? 0));
}

function buildMessageKey(pane, messageId) {
  return `${pane}|m|${messageId}`;
}

function buildSignalKey(pane, messageId, signalId) {
  return `${pane}|s|${messageId}|${signalId}`;
}

function isMessageSelected(pane, messageId) {
  return selectedKeys.value.includes(buildMessageKey(pane, messageId));
}

function isSignalSelected(pane, messageId, signalId) {
  return selectedKeys.value.includes(buildSignalKey(pane, messageId, signalId));
}

function findRowIndexByKey(key) {
  const pane = key.startsWith('rx|') ? 'rx' : 'tx';
  const rows = getRowsByPane(pane);
  return rows.findIndex((r) => r.key === key);
}

function onCardClick(pane, message, event) {
  const key = buildMessageKey(pane, message.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  onRowClick(rows[idx], idx, pane, event);
}

function onCardContextMenu(pane, message, event) {
  const key = buildMessageKey(pane, message.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  openRowContextMenu(rows[idx], pane, event);
}

function onSignalClickInCard(pane, message, signal, event) {
  const key = buildSignalKey(pane, message.id, signal.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  onRowClick(rows[idx], idx, pane, event);
}

function onSignalContextMenuInCard(pane, message, signal, event) {
  const key = buildSignalKey(pane, message.id, signal.id);
  const idx = findRowIndexByKey(key);
  if (idx < 0) return;
  const rows = getRowsByPane(pane);
  openRowContextMenu(rows[idx], pane, event);
}

function getMessagePeers(message, pane) {
  const peerIds = pane === 'rx'
    ? (Array.isArray(message.senders) ? message.senders : [])
    : (Array.isArray(message.receivers) ? message.receivers : []);
  const ecuId = props.ecu?.id;
  return peerIds
    .filter((id) => id !== ecuId)
    .map((id) => {
      const node = props.ecuNodes.find((n) => n.id === id);
      return {
        id,
        name: node?.name || id,
        color: node?.baseColor || '#888',
      };
    });
}

function cardStyle(message, pane) {
  const color = message?.color || protocolColor(message?.protocol);
  const hasError = messageErrors.value?.has?.(message?.id);
  const isSelected = isMessageSelected(pane, message?.id);
  return {
    borderColor: hasError && !isSelected ? '#d32f2f' : color,
    borderWidth: hasError && !isSelected ? '3px' : '2px',
    '--card-color': color,
  };
}

function cardHeadStyle(message) {
  const color = message?.color || protocolColor(message?.protocol);
  return {
    backgroundColor: color,
  };
}

function onSplitPointerDown(event) {
  event.preventDefault();
  splitDrag.value = {
    startX: event.clientX,
    startRatio: splitRatio.value,
  };
  document.addEventListener('pointermove', onSplitPointerMove);
  document.addEventListener('pointerup', onSplitPointerUp);
  document.addEventListener('pointercancel', onSplitPointerUp);
}

function onSplitPointerMove(event) {
  if (!splitDrag.value) return;
  const body = editorRef.value?.querySelector('.ecu-msg-body');
  const width = body?.clientWidth || 1;
  const dx = event.clientX - splitDrag.value.startX;
  splitRatio.value = Math.max(0.05, Math.min(0.95, splitDrag.value.startRatio + dx / width));
}

function onSplitPointerUp() {
  splitDrag.value = null;
  document.removeEventListener('pointermove', onSplitPointerMove);
  document.removeEventListener('pointerup', onSplitPointerUp);
  document.removeEventListener('pointercancel', onSplitPointerUp);
}

function onPropsSplitPointerDown(event) {
  event.preventDefault();
  propsPanelDrag.value = {
    startX: event.clientX,
    startWidth: propsPanelWidth.value,
  };
  document.addEventListener('pointermove', onPropsSplitPointerMove);
  document.addEventListener('pointerup', onPropsSplitPointerUp);
  document.addEventListener('pointercancel', onPropsSplitPointerUp);
}

function onPropsSplitPointerMove(event) {
  if (!propsPanelDrag.value) return;
  const dx = propsPanelDrag.value.startX - event.clientX;
  const newWidth = propsPanelDrag.value.startWidth + dx;
  propsPanelWidth.value = Math.max(200, Math.min(500, newWidth));
  propsPanelWidthCache.width = propsPanelWidth.value;
}

function onPropsSplitPointerUp() {
  propsPanelDrag.value = null;
  document.removeEventListener('pointermove', onPropsSplitPointerMove);
  document.removeEventListener('pointerup', onPropsSplitPointerUp);
  document.removeEventListener('pointercancel', onPropsSplitPointerUp);
}

function toggleCollapse(side) {
  if (side === 'left') {
    collapsedLeft.value = true;
    collapsedRight.value = false;
    return;
  }
  collapsedRight.value = true;
  collapsedLeft.value = false;
}

function handleWindowKeydown(event) {
  const tag = String(event.target?.tagName || '').toLowerCase();
  const editable = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
  if (editable) return;

  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSelection();
    return;
  }

  if (event.key === 'Escape') {
    clearSelection();
    return;
  }

  const ctrl = event.ctrlKey || event.metaKey;
  if (!ctrl) return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'c') {
    event.preventDefault();
    copySelection();
    return;
  }
  if (key === 'v') {
    event.preventDefault();
    pasteAt();
    return;
  }
  if (key === 'a') {
    event.preventDefault();
    if (selectedPane.value === 'rx') {
      selectedKeys.value = rxRows.value.map((item) => item.key);
    } else {
      selectedKeys.value = txRows.value.map((item) => item.key);
    }
  }
}

function handleWindowPointerDown(event) {
  if (event.target?.closest?.('.ecu-msg-context')) return;
  closeContextMenu();
  closeSenderDefaultMenu();
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown);
  window.addEventListener('pointerdown', handleWindowPointerDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
  window.removeEventListener('pointerdown', handleWindowPointerDown);
  document.removeEventListener('pointermove', onSplitPointerMove);
  document.removeEventListener('pointerup', onSplitPointerUp);
  document.removeEventListener('pointercancel', onSplitPointerUp);
  document.removeEventListener('pointermove', onPropsSplitPointerMove);
  document.removeEventListener('pointerup', onPropsSplitPointerUp);
  document.removeEventListener('pointercancel', onPropsSplitPointerUp);
});

defineExpose({
  deleteSelection,
  copySelection,
  pasteAt,
  addMessageAtPane,
  get hasSelection() {
    return Array.isArray(selectedKeys.value) && selectedKeys.value.length > 0;
  },
  get selectedKeys() {
    return selectedKeys.value;
  },
});
</script>

<style scoped>
.ecu-msg-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: linear-gradient(180deg, #f8f2ea 0%, #f4ebe1 100%);
  border-radius: 10px;
  border: 1px solid #dbc8b6;
}

.ecu-msg-editor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ecu-msg-back-icon {
  width: 30px;
  height: 30px;
  border: 0;
  background: rgba(151, 112, 84, 0.14);
  color: #6c4d36;
  border-radius: 7px;
  flex-shrink: 0;
}

.ecu-msg-back-icon:hover {
  background: rgba(151, 112, 84, 0.26);
}

.ecu-msg-ecu-switch {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ecu-msg-ecu-select {
  border: 1px solid #caa688;
  background: #fffaf4;
  color: #5c4433;
  border-radius: 7px;
  padding: 6px 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
  max-width: 180px;
}

.ecu-msg-ecu-select:hover {
  border-color: #b08863;
  box-shadow: 0 1px 4px rgba(151, 112, 84, 0.2);
}

.ecu-msg-ecu-select:focus {
  border-color: #b08863;
  box-shadow: 0 0 0 2px rgba(176, 136, 99, 0.25);
}

.ecu-msg-tabs {
  display: flex;
  gap: 6px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.ecu-msg-tab {
  border: 1px solid transparent;
  background: transparent;
  color: #7a614d;
  border-radius: 7px;
  padding: 6px 10px;
  min-width: 120px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.ecu-msg-tab:hover {
  background: rgba(151, 112, 84, 0.18);
  color: #5c4433;
  border-color: rgba(151, 112, 84, 0.3);
}

.ecu-msg-tab-index {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid #caa688;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.6);
}

.ecu-msg-tab-name {
  text-align: left;
  font-weight: 600;
}

.ecu-msg-tab.active {
  background: #fff;
  color: #5c4433;
  border-color: #b08863;
  box-shadow: 0 2px 6px rgba(151, 112, 84, 0.25);
}

.ecu-msg-tab.active .ecu-msg-tab-index {
  background: #b08863;
  color: #fff;
  border-color: #967150;
}

.ecu-msg-filter-toggle {
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  background: rgba(151, 112, 84, 0.14);
  color: #6c4d36;
  border-radius: 7px;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.12s, border-color 0.12s;
}

.ecu-msg-filter-toggle:hover {
  background: rgba(151, 112, 84, 0.26);
  border-color: rgba(151, 112, 84, 0.3);
}

.ecu-msg-empty {
  display: grid;
  place-items: center;
  color: #7f6a56;
  border: 1px dashed #d9c6b2;
  border-radius: 8px;
}

.ecu-msg-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  gap: 0;
}

.ecu-msg-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  border: 1px solid #decbbc;
  border-radius: 8px;
  overflow: hidden;
  background: #fffaf4;
}

.ecu-msg-rail {
  flex: 0 0 34px;
  border: 0;
  background: linear-gradient(180deg, #efe0d0 0%, #e7d3bf 100%);
  color: #654c38;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
}

.ecu-msg-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  background: rgba(255, 255, 255, 0.66);
  overflow: hidden;
}

.ecu-msg-pane-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid #e5d4c5;
  color: #5e4a3a;
}

.ecu-msg-count {
  font-size: 12px;
  color: #887461;
  margin: 0 8px 0 auto;
}

.ecu-msg-sort-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 6px;
  background: #f5f0eb;
  flex-shrink: 0;
}

.ecu-msg-sort-label {
  font-size: 11px;
  color: #8b7355;
  font-weight: 600;
  margin-right: 2px;
  white-space: nowrap;
}

.ecu-msg-sort-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #d4c5b5;
  font-size: 11px;
  color: #5e4a3a;
  cursor: grab;
  user-select: none;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.ecu-msg-sort-chip:hover {
  background: #e8d9c8;
  border-color: #b08863;
}

.ecu-msg-sort-chip:active {
  cursor: grabbing;
}

.ecu-msg-sort-chip.sort-drag-over {
  border-color: #b08863;
  box-shadow: 0 0 0 2px rgba(176, 136, 99, 0.3);
  background: #e8d9c8;
}

.ecu-rx-broadcast-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  min-height: 24px;
  border-radius: 6px;
  border: 1px solid #e1d3c6;
  background: #f5f0eb;
  color: #8b7355;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, border-color 0.15s;
}

.ecu-rx-broadcast-toggle input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #b08863;
}

.ecu-rx-broadcast-toggle:hover {
  background: #efe5da;
  border-color: #d4c5b5;
}

.ecu-msg-collapse {
  border: 0;
  background: transparent;
  color: #7b6551;
  font-size: 12px;
}

/* Card Layout */
.ecu-msg-cards {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  columns: 230px;
  column-gap: 16px;
}

.ecu-msg-card {
  break-inside: avoid;
  margin-bottom: 16px;
  width: 230px;
  max-width: 100%;
  border-radius: 12px;
  border: 2px solid #ddd;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
  display: flex;
  flex-direction: column;
}

.ecu-msg-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.ecu-msg-card.selected {
  border-color: var(--card-color, #b08863);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-color, #b08863) 10%, #fff) 0%, #fff 34%),
    #fff;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--card-color, #b08863) 90%, #fff),
    0 0 0 7px color-mix(in srgb, var(--card-color, #b08863) 22%, transparent),
    0 0 28px 10px color-mix(in srgb, var(--card-color, #b08863) 42%, transparent),
    0 14px 42px rgba(0, 0, 0, 0.24);
  transform: scale(1.06) translateY(-5px);
  z-index: 4;
  position: relative;
}

.ecu-msg-card.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--card-color, #b08863) 14%, transparent), transparent 55%),
    color-mix(in srgb, var(--card-color, #b08863) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-color, #b08863) 35%, transparent);
  pointer-events: none;
  z-index: 0;
}

.ecu-msg-card.selected > * {
  position: relative;
  z-index: 1;
}

.ecu-msg-card.selected .ecu-msg-card-head {
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.18);
}

.ecu-msg-card.selected .ecu-msg-card-name {
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
}

.ecu-msg-card.has-error:not(.selected) {
  border-width: 3px;
  border-style: solid;
  border-color: #d32f2f;
  background: #fff5f5;
  box-shadow: none;
}

@keyframes ecu-error-pulse {
  0%, 100% { box-shadow: 0 0 0 2px #d32f2f, 0 0 20px 4px rgba(211, 47, 47, 0.35); }
  50% { box-shadow: 0 0 0 3px #ef5350, 0 0 28px 8px rgba(211, 47, 47, 0.5); }
}

.ecu-msg-card.has-error.selected {
  animation: ecu-error-pulse 2s ease-in-out infinite;
}

.ecu-msg-card.has-error:hover {
  box-shadow: none;
  transform: translateY(-2px);
}

.ecu-msg-card.has-error .ecu-msg-card-head {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 6px,
    rgba(255, 255, 255, 0.15) 6px,
    rgba(255, 255, 255, 0.15) 12px
  );
}

.ecu-msg-card.has-error .ecu-msg-card-body {
  background: #fff5f5;
}

.ecu-msg-card.has-error .ecu-msg-card-id-row::after {
  content: '⚠ 错误';
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: #d32f2f;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
  flex-shrink: 0;
}

.ecu-msg-card-head {
  padding: 4px 10px;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 28px;
  justify-content: center;
}

.ecu-msg-card-id-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 0;
}

.ecu-msg-card-id {
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  opacity: 0.9;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.ecu-msg-peer-tag {
  display: inline-block;
  padding: 0 5px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  background: #fff;
  border-color: currentColor;
}

.ecu-msg-card-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ecu-msg-card-body {
  padding: 8px 0;
  background: #fefefe;
  flex: 1;
}

.ecu-msg-card-signal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  font-size: 13px;
  border-bottom: 1px solid #f3ece6;
  transition: background 0.12s;
  cursor: pointer;
}

.ecu-msg-card-signal:last-child {
  border-bottom: none;
}

.ecu-msg-card-signal:hover {
  background: rgba(183, 150, 124, 0.08);
}

.ecu-msg-card-signal.selected {
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--card-color, #b08863) 28%, transparent), color-mix(in srgb, var(--card-color, #b08863) 12%, transparent)),
    rgba(183, 150, 124, 0.24);
  border-left: 5px solid var(--card-color, #b08863);
  padding-left: 9px;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--card-color, #b08863) 30%, transparent);
}

.ecu-msg-signal-name {
  color: #4a3728;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ecu-msg-signal-len {
  color: #8a7260;
  font-size: 12px;
  flex-shrink: 0;
  margin-left: 12px;
  background: #f5efe8;
  padding: 2px 8px;
  border-radius: 999px;
}

.ecu-msg-card-empty {
  padding: 20px 14px;
  text-align: center;
  color: #b8a494;
  font-size: 13px;
}

.ecu-msg-splitter {
  flex: 0 0 8px;
  width: 8px;
  cursor: col-resize;
  background: linear-gradient(180deg, #ead8c7 0%, #dfc7b1 100%);
}

.ecu-msg-props-splitter {
  flex: 0 0 6px;
  width: 6px;
  cursor: col-resize;
  background: linear-gradient(180deg, #ead8c7 0%, #dfc7b1 100%);
  border-radius: 3px;
  margin: 4px 0;
  transition: background 0.15s;
}

.ecu-msg-props-splitter:hover {
  background: linear-gradient(180deg, #d4b896 0%, #c9a87a 100%);
}

.ecu-msg-props {
  flex-shrink: 0;
  overflow: auto;
  border: 1px solid #dac7b5;
  border-radius: 8px;
  background: rgba(255, 252, 247, 0.96);
  padding: 8px;
}

.ecu-msg-props-title {
  font-weight: 700;
  color: #5a4432;
  margin-bottom: 6px;
}

.ecu-prop-grid {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 6px;
  align-items: center;
}

.ecu-prop-grid label {
  font-size: 12px;
  color: #6d5745;
}

.ecu-dlc-control {
  display: grid;
  grid-template-columns: auto auto;
  gap: 6px;
  align-items: center;
}

.ecu-dlc-value {
  width: 56px;
  min-width: 56px;
  padding-right: 6px;
}

.ecu-dlc-value::-webkit-outer-spin-button,
.ecu-dlc-value::-webkit-inner-spin-button {
  margin: 0;
}

.ecu-dlc-mode {
  width: 74px;
  min-width: 74px;
  padding-right: 13px;
  background-position: right 3px center;
  background-size: 10px 8px;
}

.ecu-j1939-id-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ecu-id-disabled {
  background: #f0eee9;
  color: #8d8378;
  border-color: #d4cbc0;
  cursor: not-allowed;
}

.ecu-j1939-toggle {
  border: 1px solid #d9c4af;
  border-radius: 7px;
  background: #fff7ed;
  color: #604833;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  text-align: left;
}

.ecu-j1939-toggle:hover {
  border-color: #b98f6a;
  background: #f9ebda;
}

.ecu-j1939-panel {
  border: 1px solid #dcc7b2;
  border-radius: 8px;
  background: #fffaf3;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ecu-j1939-grid {
  grid-template-columns: 64px 1fr;
}

.ecu-j1939-hint {
  font-size: 11px;
  color: #7a6048;
  background: #f6e9dc;
  border: 1px solid #e0c9b1;
  border-radius: 6px;
  padding: 3px 8px;
}

.ecu-j1939-errors {
  border: 1px solid #e6a9a9;
  border-radius: 6px;
  background: #fff1f1;
  color: #9b2b2b;
  padding: 5px 8px;
}

.ecu-j1939-errors-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}

.ecu-j1939-errors ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
}

.ecu-layout-launcher {
  border: 1px solid #dccab9;
  border-radius: 8px;
  background: #fffaf4;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ecu-layout-open-btn {
  align-self: flex-start;
}

.ecu-layout-launcher-hint {
  font-size: 11px;
  color: #8b725f;
}

.ecu-layout-error-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 1px 8px;
  border-radius: 999px;
  background: #d32f2f;
  color: #fff;
  font-size: 10px;
  line-height: 1.6;
}

.ecu-participant-list {
  border: 1px solid #dccab9;
  border-radius: 8px;
  background: #fff;
  min-height: 32px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ecu-participant-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 6px;
  background: #f7f1ea;
}

.ecu-participant-item.is-default {
  background: #efe2d2;
  box-shadow: inset 0 0 0 1px #d6b896;
}

.ecu-participant-item.is-broadcast {
  background: #e8f4ff;
  box-shadow: inset 0 0 0 1px #a9cae8;
}

.ecu-participant-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4e3a2a;
  font-size: 12px;
}

.ecu-participant-default-tag {
  flex-shrink: 0;
  font-size: 10px;
  line-height: 1;
  color: #7e5a31;
  border: 1px solid #d5b189;
  border-radius: 999px;
  padding: 2px 6px;
  background: #fff8ef;
}

.ecu-participant-empty {
  color: #9a856f;
  font-size: 12px;
  padding: 4px 6px;
}

.ecu-participant-icon-btn,
.ecu-participant-add-btn {
  width: 20px;
  height: 20px;
  border: 1px solid #d7c4b1;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #7d6551;
  cursor: pointer;
  flex-shrink: 0;
}

.ecu-participant-icon-btn svg,
.ecu-participant-add-btn svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.ecu-participant-icon-btn:hover,
.ecu-participant-add-btn:hover {
  border-color: #bc9f87;
  color: #604833;
}

.ecu-participant-icon-btn.danger {
  color: #9d4f4f;
}

.ecu-participant-icon-btn.danger:hover {
  border-color: #d48282;
  color: #8a1f1f;
}

.ecu-participant-add-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ecu-participant-picker {
  border-top: 1px dashed #d8c5b3;
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ecu-participant-picker-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 132px;
  overflow: auto;
}

.ecu-participant-picker-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4e3a2a;
}

.ecu-participant-picker-broadcast {
  border-bottom: 1px dashed #d8c5b3;
  padding-bottom: 4px;
  margin-bottom: 2px;
}

.ecu-participant-picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.ecu-bit-layout-empty {
  font-size: 12px;
  color: #8b725f;
  line-height: 1.4;
}

.ecu-layout-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(22, 14, 9, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.ecu-layout-modal {
  width: min(880px, 100%);
  max-height: min(86vh, 900px);
  background: #fff8ef;
  border: 1px solid #d7c3af;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.26);
  padding: 12px;
  overflow: auto;
}

.ecu-layout-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #4f3a2a;
}

.ecu-layout-modal-close {
  border: 1px solid #ccb59f;
  border-radius: 6px;
  background: #fff;
  color: #5b4331;
  padding: 2px 10px;
}

.ecu-layout-modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6f5846;
}

.ecu-layout-modal-meta > span {
  background: #f4e9dc;
  border: 1px solid #ddcab6;
  border-radius: 999px;
  padding: 1px 8px;
}

.ecu-bit-grid-shell {
  user-select: none;
}

.ecu-bit-grid-head,
.ecu-bit-grid-row {
  display: grid;
  grid-template-columns: 40px auto;
  gap: 4px;
  align-items: stretch;
}

.ecu-bit-grid-corner,
.ecu-bit-grid-row-index {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d6c2ae;
  border-radius: 6px;
  font-size: 11px;
  color: #6d5745;
  background: #f3e8dc;
  height: 30px;
}

.ecu-bit-grid-head-cells,
.ecu-bit-grid-row-cells {
  display: grid;
  grid-template-columns: repeat(8, 28px);
  height: 30px;
  width: 224px;
}

.ecu-bit-grid-head-cell,
.ecu-bit-grid-cell {
  border: 1px solid #d9c7b6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #755f4b;
  background: #fff;
}

.ecu-bit-grid-body {
  display: grid;
  gap: 3px;
  max-height: 56vh;
  overflow: auto;
}

.ecu-bit-grid-row-cells {
  position: relative;
}

.ecu-bit-signal-block {
  position: absolute;
  border: 1px solid rgba(68, 44, 28, 0.28);
  border-radius: 6px;
  color: #1f1a15;
  font-size: 10px;
  line-height: 1;
  text-align: left;
  padding: 1px 4px;
  cursor: grab;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ecu-bit-signal-block:active,
.ecu-bit-signal-block.is-dragging {
  cursor: grabbing;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8), 0 0 0 3px rgba(92, 68, 46, 0.32);
}

.ecu-layout-modal-help {
  margin-top: 6px;
  font-size: 11px;
  color: #8b725f;
}

.ecu-layout-modal-errors {
  margin-top: 8px;
  border: 1px solid #e6b7b7;
  border-radius: 8px;
  background: #fff2f2;
  padding: 8px;
}

.ecu-layout-modal-errors-title {
  font-size: 12px;
  font-weight: 700;
  color: #9b3025;
  margin-bottom: 4px;
}

.ecu-layout-modal-errors ul {
  margin: 0;
  padding-left: 18px;
  color: #8a3329;
  font-size: 12px;
}

.ecu-msg-context {
  position: fixed;
  z-index: 80;
  min-width: 180px;
  border: 1px solid #d6c2ae;
  border-radius: 8px;
  background: #fff8f0;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
  padding: 4px;
}

.ecu-msg-context-item {
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: #503d2e;
  border-radius: 6px;
  padding: 6px 8px;
}

.ecu-msg-context-item:hover {
  background: rgba(188, 150, 120, 0.2);
}

.ecu-msg-context-item.danger {
  color: #9b3025;
}
</style>