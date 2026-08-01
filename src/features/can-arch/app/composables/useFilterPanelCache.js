export const filterPanelPositionCache = {
  x: 10,
  y: 10,
  width: 260,
  height: 240,
  collapsed: false,
  open: true,
};

export function saveFilterPanelPosition(state) {
  filterPanelPositionCache.x = state.x;
  filterPanelPositionCache.y = state.y;
  filterPanelPositionCache.width = state.width;
  filterPanelPositionCache.height = state.height;
  filterPanelPositionCache.collapsed = state.collapsed;
}

export function saveFilterPanelOpen(open) {
  filterPanelPositionCache.open = open;
}