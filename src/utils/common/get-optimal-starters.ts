import { Allplayer } from "@/lib/types/common-types";

type Variant = {
  player_id: string;
  position: string;
  value: number;
};

export const position_map: { [key: string]: string[] } = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
  K: ["K"],
  DEF: ["DEF"],
  DL: ["DL"],
  LB: ["LB"],
  DB: ["DB"],
  IDP_FLEX: ["DL", "LB", "DB"],
};

export function getOptimalStarters(
  roster_positions: string[],
  players: string[],
  values: { [player_id: string]: number } | null,
  allplayers: { [player_id: string]: Allplayer }
) {
  const startRosterPositions = roster_positions.filter((rp) => rp !== "BN");

  // Build variants: one per (player_id, eligible fantasy position)
  const variants: Variant[] = players
    .filter((player_id) => allplayers[player_id])
    .flatMap((player_id) => {
      const positions = allplayers[player_id].fantasy_positions;
      const value = values?.[player_id] ?? 0;

      return positions.map((position) => ({
        player_id,
        position,
        value,
      }));
    });

  // Filter usable slots
  const slotKeys = startRosterPositions
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => !!position_map[slot]);

  const S = slotKeys.length;
  const V = variants.length;

  // ---- Min-Cost Max-Flow (exact assignment) ----
  class MCMF {
    n: number;
    adj: { to: number; rev: number; cap: number; cost: number }[][];

    constructor(n: number) {
      this.n = n;
      this.adj = Array.from({ length: n }, () => []);
    }

    addEdge(u: number, v: number, cap: number, cost: number) {
      this.adj[u].push({ to: v, rev: this.adj[v].length, cap, cost });
      this.adj[v].push({
        to: u,
        rev: this.adj[u].length - 1,
        cap: 0,
        cost: -cost,
      });
    }
    run(s: number, t: number, wantFlow = Infinity) {
      let flow = 0,
        cost = 0;
      while (flow < wantFlow) {
        const dist = Array(this.n).fill(Infinity);
        const inq = Array(this.n).fill(false);
        const parent = Array(this.n).fill(-1);
        const pedge = Array(this.n).fill(-1);
        dist[s] = 0;
        inq[s] = true;
        const q: number[] = [s];
        while (q.length) {
          const u = q.shift()!;
          inq[u] = false;
          for (let i = 0; i < this.adj[u].length; i++) {
            const e = this.adj[u][i];
            if (e.cap > 0 && dist[u] + e.cost < dist[e.to]) {
              dist[e.to] = dist[u] + e.cost;
              parent[e.to] = u;
              pedge[e.to] = i;
              if (!inq[e.to]) {
                q.push(e.to);
                inq[e.to] = true;
              }
            }
          }
        }
        if (!isFinite(dist[t])) break;

        const N = this.n;
        const EPS = 1e-12;

        const path: Array<{ u: number; i: number }> = [];
        let v = t;
        let hops = 0;
        const onPath = new Set<number>();

        while (v !== s) {
          if (++hops > N) {
            throw new Error("MCMF: parent chain cycle/too long (bad parents)");
          }
          onPath.add(v);

          let u = parent[v];
          let i = pedge[v];
          let ok = false;

          if (u >= 0 && i >= 0) {
            const e = this.adj[u][i];
            if (
              e &&
              e.to === v &&
              e.cap > 0 &&
              Number.isFinite(dist[u]) &&
              Math.abs(dist[u] + e.cost - dist[v]) <= EPS
            ) {
              ok = true;
            }
          }

          if (!ok) {
            let found = false;
            for (let uu = 0; uu < N && !found; uu++) {
              if (onPath.has(uu)) continue;
              if (!Number.isFinite(dist[uu])) continue;
              const adjU = this.adj[uu];
              for (let ii = 0; ii < adjU.length; ii++) {
                const e = adjU[ii];
                if (e.to !== v) continue;
                if (e.cap <= 0) continue;
                if (Math.abs(dist[uu] + e.cost - dist[v]) > EPS) continue;
                u = uu;
                i = ii;
                found = true;
                break;
              }
            }
            if (!found) {
              path.length = 0;
              break;
            }
          }

          if (onPath.has(u) && u !== s) {
            path.length = 0;
            break;
          }

          path.push({ u, i });
          v = u;
        }

        // apply augmentation
        for (let k = path.length - 1; k >= 0; k--) {
          const { u, i } = path[k];
          const e = this.adj[u][i];
          if (!e || e.cap <= 0)
            throw new Error("MCMF: zero/invalid cap when augmenting");
          e.cap -= 1;
          this.adj[e.to][e.rev].cap += 1;
        }

        flow += 1;
        cost += dist[t];
      }
      return { flow, cost };
    }
  }

  // Unique players → player nodes to enforce "use at most once"
  const uniquePlayers = Array.from(new Set(variants?.map((v) => v.player_id)));
  const pIndex: Record<string, number> = {};
  uniquePlayers.forEach((pid, i) => (pIndex[pid] = i));

  // Node indexing
  // source=0
  // slots: 1..S
  // variants: S+1 .. S+V
  // players: S+V+1 .. S+V+P
  // sink: S+V+P+1
  const source = 0;
  const baseSlots = 1;
  const baseVariants = baseSlots + S;
  const basePlayers = baseVariants + V;
  const sink = basePlayers + uniquePlayers.length;

  const g = new MCMF(sink + 1);

  // source -> slots
  for (let si = 0; si < S; si++) g.addEdge(source, baseSlots + si, 1, 0);

  // slots -> variants (only if eligible per position_map)
  const slotVariantEdge: { si: number; vi: number; u: number; ei: number }[] =
    [];
  for (let si = 0; si < S; si++) {
    const { slot } = slotKeys[si];
    const elig = new Set(position_map[slot] || []);
    const u = baseSlots + si;
    for (let vi = 0; vi < V; vi++) {
      const v = variants[vi];
      if (elig.has(v.position)) {
        const before = g.adj[u].length;
        g.addEdge(u, baseVariants + vi, 1, -v.value); // maximize value
        slotVariantEdge.push({ si, vi, u, ei: before });
      }
    }
  }

  // variant -> player
  for (let vi = 0; vi < V; vi++) {
    const pid = variants[vi].player_id;
    g.addEdge(baseVariants + vi, basePlayers + pIndex[pid], 1, 0);
  }

  // player -> sink
  for (let pi = 0; pi < uniquePlayers.length; pi++) {
    g.addEdge(basePlayers + pi, sink, 1, 0);
  }

  // run flow (fill as many slots as possible)
  g.run(source, sink, S);

  // reconstruct chosen variant per slot
  const chosenVariantBySlot: (number | null)[] = Array(S).fill(null);
  for (const rec of slotVariantEdge) {
    const e = g.adj[rec.u][rec.ei];
    if (e.cap === 0) chosenVariantBySlot[rec.si] = rec.vi;
  }

  // build return in ORIGINAL roster order (index is original array position)
  const optimalStarters = startRosterPositions?.map((slot, index) => {
    if (!position_map[slot]) {
      return {
        index,
        slot__index: `${slot}__${index}`,
        optimal_player_id: "0",
        player_position: "-",
        value: 0,
      };
    }
    // find which slotKeys entry corresponds to original index
    const si = slotKeys.findIndex((sk) => sk.index === index);
    if (si === -1) {
      return {
        index,
        slot__index: `${slot}__${index}`,
        optimal_player_id: "0",
        player_position: "-",
        value: 0,
      };
    }
    const chosenVi = chosenVariantBySlot[si];
    if (chosenVi === null) {
      return {
        index,
        slot__index: `${slot}__${index}`,
        optimal_player_id: "0",
        player_position: "-",
        value: 0,
      };
    }
    const v = variants[chosenVi];
    return {
      index,
      slot__index: `${slot}__${index}`,
      optimal_player_id: v.player_id,
      player_position: v.position,
      value: v.value,
    };
  });

  const optimalBench = players
    .filter(
      (player_id) =>
        !optimalStarters.some((os) => os.optimal_player_id === player_id)
    )
    .map((player_id) => ({
      slot__index: "BN",
      optimal_player_id: player_id,
      player_position: allplayers[player_id]?.position,
      value: values?.[player_id] ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .map((player, index) => ({
      ...player,
      index: optimalStarters.length + index,
    }));

  return { optimalStarters, optimalBench };
}
