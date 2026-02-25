import { useState, useCallback } from "react";

export type GridSize = 10 | 20;

export interface Sector {
  row: number;
  col: number;
  health: number;
}

export interface SortStep {
  array: Sector[];
  comparing: [number, number];
  swapped: boolean;
}

export function useReefGrid() {
  const [gridSize, setGridSize] = useState<GridSize>(10);
  const [grid, setGrid] = useState<number[][]>([]);
  const [neighborhoodAvgs, setNeighborhoodAvgs] = useState<number[][]>([]);
  const [sortedSectors, setSortedSectors] = useState<Sector[]>([]);
  const [sortSteps, setSortSteps] = useState<SortStep[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [hasSorted, setHasSorted] = useState(false);

  const generateGrid = useCallback((size: GridSize) => {
    setGridSize(size);
    const newGrid: number[][] = [];
    for (let i = 0; i < size; i++) {
      const row: number[] = [];
      for (let j = 0; j < size; j++) {
        row.push(Math.floor(Math.random() * 101));
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setNeighborhoodAvgs([]);
    setSortedSectors([]);
    setSortSteps([]);
    setHasScanned(false);
    setHasSorted(false);
    setSelectedCell(null);
  }, []);

  const insertDeadZone = useCallback((startRow: number, startCol: number) => {
    setGrid((prev) => {
      const newGrid = prev.map((r) => [...r]);
      for (let i = startRow; i < Math.min(startRow + 3, newGrid.length); i++) {
        for (let j = startCol; j < Math.min(startCol + 3, newGrid[0].length); j++) {
          newGrid[i][j] = Math.floor(Math.random() * 15);
        }
      }
      return newGrid;
    });
    setHasScanned(false);
    setHasSorted(false);
  }, []);

  const runNeighborhoodScan = useCallback(() => {
    if (grid.length === 0) return;
    const size = grid.length;
    const avgs: number[][] = [];
    for (let i = 0; i < size; i++) {
      const row: number[] = [];
      for (let j = 0; j < size; j++) {
        let sum = 0;
        let count = 0;
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < size && nj >= 0 && nj < size) {
              sum += grid[ni][nj];
              count++;
            }
          }
        }
        row.push(Math.round(sum / count));
      }
      avgs.push(row);
    }
    setNeighborhoodAvgs(avgs);
    setHasScanned(true);
  }, [grid]);

  const sortSectors = useCallback(() => {
    if (grid.length === 0) return;
    const sectors: Sector[] = [];
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        sectors.push({ row: i, col: j, health: grid[i][j] });
      }
    }
    // Bubble sort with step recording
    const arr = [...sectors];
    const steps: SortStep[] = [];
    const n = arr.length;
    for (let i = 0; i < Math.min(n - 1, 200); i++) {
      let swappedAny = false;
      for (let j = 0; j < n - i - 1; j++) {
        const swapped = arr[j].health > arr[j + 1].health;
        if (swapped) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
          swappedAny = true;
        }
        if (steps.length < 50) {
          steps.push({
            array: arr.slice(0, 20),
            comparing: [j, j + 1],
            swapped,
          });
        }
      }
      if (!swappedAny) break;
    }
    setSortedSectors(arr);
    setSortSteps(steps);
    setHasSorted(true);
  }, [grid]);

  const getCellColor = (value: number): string => {
    if (value <= 20) return "reef-cell-danger";
    if (value <= 40) return "reef-cell-warning";
    if (value <= 60) return "reef-cell-moderate";
    if (value <= 80) return "reef-cell-healthy";
    return "reef-cell-pristine";
  };

  const getStats = useCallback(() => {
    if (grid.length === 0) return null;
    const allValues = grid.flat();
    const avg = Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length);
    let minVal = 101, minR = 0, minC = 0;
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        if (grid[i][j] < minVal) {
          minVal = grid[i][j];
          minR = i;
          minC = j;
        }
      }
    }
    const distribution = {
      critical: allValues.filter((v) => v <= 20).length,
      warning: allValues.filter((v) => v > 20 && v <= 40).length,
      moderate: allValues.filter((v) => v > 40 && v <= 60).length,
      healthy: allValues.filter((v) => v > 60 && v <= 80).length,
      pristine: allValues.filter((v) => v > 80).length,
    };
    return { avg, mostCritical: { row: minR, col: minC, value: minVal }, distribution };
  }, [grid]);

  const exportHealthMap = useCallback(() => {
    if (grid.length === 0) return;
    let content = "Reef Health Map\n" + "=".repeat(40) + "\n\n";
    for (let i = 0; i < grid.length; i++) {
      content += grid[i].map((v) => String(v).padStart(4)).join("") + "\n";
    }
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reef_health_map.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [grid]);

  const exportPriorityCSV = useCallback(() => {
    if (sortedSectors.length === 0) return;
    let csv = "Rank,Row,Col,Health Score\n";
    sortedSectors.forEach((s, i) => {
      csv += `${i + 1},${s.row},${s.col},${s.health}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "restoration_priority.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedSectors]);

  return {
    gridSize,
    grid,
    neighborhoodAvgs,
    sortedSectors,
    sortSteps,
    selectedCell,
    hasScanned,
    hasSorted,
    setSelectedCell,
    generateGrid,
    insertDeadZone,
    runNeighborhoodScan,
    sortSectors,
    getCellColor,
    getStats,
    exportHealthMap,
    exportPriorityCSV,
  };
}
