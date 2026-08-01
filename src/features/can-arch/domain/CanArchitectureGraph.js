import { CanNode } from './models/CanNode.js';
import { CanBus } from './models/CanBus.js';

export class CanArchitectureGraph {
  constructor(options = {}) {
    this.nodes = [];
    this.buses = [];
    this.links = [];
    this.config = {
      linkStyle: 'polyline',
      showGrid: true,
      backgroundColor: '#fdfcf9',
      accentColor: '#16181b',
      gridSize: 20,
      autoSave: true,
      showBusColors: true,
      showLegend: true,
      ...(typeof options.config === 'object' && options.config !== null ? options.config : {}),
    };
    if (Array.isArray(options.nodes)) {
      this.nodes = options.nodes.map((n) => (n instanceof CanNode ? n : new CanNode(n)));
    }
    if (Array.isArray(options.buses)) {
      this.buses = options.buses.map((b) => (b instanceof CanBus ? b : new CanBus(b)));
    }
    if (Array.isArray(options.links)) {
      this.links = options.links.map((l) => structuredClone(l));
    }
  }

  snapshot() {
    return {
      nodes: this.nodes.map((n) => n.toJSON()),
      buses: this.buses.map((b) => b.toJSON()),
      links: structuredClone(this.links),
      config: structuredClone(this.config),
    };
  }

  restore(snapshot) {
    if (!snapshot) return;
    if (Array.isArray(snapshot.nodes)) {
      this.nodes = snapshot.nodes.map((n) => new CanNode(n));
    }
    if (Array.isArray(snapshot.buses)) {
      this.buses = snapshot.buses.map((b) => new CanBus(b));
    }
    if (Array.isArray(snapshot.links)) {
      this.links = structuredClone(snapshot.links);
    }
    if (typeof snapshot.config === 'object' && snapshot.config !== null) {
      this.config = { ...this.config, ...structuredClone(snapshot.config) };
    }
  }

  findNode(id) {
    return this.nodes.find((n) => n.id === id) ?? null;
  }

  findBus(id) {
    return this.buses.find((b) => b.id === id) ?? null;
  }

  findLink(id) {
    return this.links.find((l) => l.id === id) ?? null;
  }

  addNode(nodeOrData) {
    const node = nodeOrData instanceof CanNode ? nodeOrData : new CanNode(nodeOrData);
    this.nodes.push(node);
    return node;
  }

  addBus(busOrData) {
    const bus = busOrData instanceof CanBus ? busOrData : new CanBus(busOrData);
    this.buses.push(bus);
    return bus;
  }

  removeNode(id) {
    const idx = this.nodes.findIndex((n) => n.id === id);
    if (idx < 0) return null;
    const [removed] = this.nodes.splice(idx, 1);
    this.links = this.links.filter(
      (l) => !(l.sourceType === 'node' && l.sourceId === id) && !(l.targetType === 'node' && l.targetId === id)
    );
    return removed;
  }

  removeBus(id) {
    const idx = this.buses.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    const [removed] = this.buses.splice(idx, 1);
    this.links = this.links.filter(
      (l) => !(l.sourceType === 'bus' && l.sourceId === id) && !(l.targetType === 'bus' && l.targetId === id)
    );
    return removed;
  }

  removeLink(id) {
    const idx = this.links.findIndex((l) => l.id === id);
    if (idx < 0) return null;
    const [removed] = this.links.splice(idx, 1);
    return removed;
  }

  updateConfig(patch) {
    this.config = {
      ...this.config,
      ...(typeof patch === 'object' && patch !== null ? patch : {}),
    };
    return this.config;
  }

  nodeIds() {
    return new Set(this.nodes.map((n) => n.id));
  }

  busIds() {
    return new Set(this.buses.map((b) => b.id));
  }
}