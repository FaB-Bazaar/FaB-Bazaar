// Daily prune of binder change history, started from instrumentation-node.ts.
// In-process like the set-overlay refresh: the app runs as a single container,
// and every deploy restarts it, which also prunes at boot.

const DAY_MS = 24 * 60 * 60 * 1000;

type Prune = () => Promise<number>;

const defaultPrune: Prune = async () => {
  const { pruneInventoryOperations } = await import('./inventory-history');
  return pruneInventoryOperations();
};

export function startInventoryHistoryPrune(prune: Prune = defaultPrune) {
  const run = () => {
    prune().catch((error) => console.error('[inventory-history] prune failed:', error));
  };
  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref?.();
}
