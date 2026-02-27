function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function readVisibleTableRows(container: HTMLElement): string[][] {
  const tableRoot = container.querySelector<HTMLElement>('[data-snapshot-table="true"]');
  if (!tableRoot) return [];
  if (tableRoot.offsetParent === null) return [];

  const rows = Array.from(tableRoot.querySelectorAll("tr"));
  return rows
    .map((row) =>
      Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.textContent || "").trim())
    )
    .filter((cells) => cells.length > 0);
}

export function saveChartSnapshot(containerId: string, filenameBase: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const svg = container.querySelector("svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const rect = container.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const tableRows = readVisibleTableRows(container);
  const hasTable = tableRows.length > 1;
  const tableLineHeight = 22;
  const tableTopPadding = hasTable ? 16 : 0;
  const tableBottomPadding = hasTable ? 12 : 0;
  const tableHeight = hasTable ? tableRows.length * tableLineHeight + tableTopPadding + tableBottomPadding : 0;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(rect.width));
  const chartHeight = Math.max(1, Math.floor(svgRect.height || rect.height));
  canvas.height = Math.max(1, chartHeight + tableHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(svgUrl);
    return;
  }

  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, chartHeight);

    if (hasTable) {
      const startY = chartHeight + tableTopPadding;
      const cols = Math.max(...tableRows.map((r) => r.length), 1);
      const colWidth = Math.floor(canvas.width / cols);

      tableRows.forEach((row, rowIndex) => {
        const y = startY + rowIndex * tableLineHeight;
        const isHeader = rowIndex === 0;

        if (isHeader) {
          ctx.fillStyle = "#f4f4f5";
          ctx.fillRect(0, y - 14, canvas.width, tableLineHeight);
          ctx.fillStyle = "#111827";
          ctx.font = "bold 12px sans-serif";
        } else {
          if (rowIndex % 2 === 0) {
            ctx.fillStyle = "#fafafa";
            ctx.fillRect(0, y - 14, canvas.width, tableLineHeight);
          }
          ctx.fillStyle = "#374151";
          ctx.font = "12px sans-serif";
        }

        row.forEach((cell, colIndex) => {
          const x = colIndex * colWidth + 8;
          const text = cell.length > 40 ? `${cell.slice(0, 40)}...` : cell;
          ctx.fillText(text, x, y);
        });
      });
    }

    const pngDataUrl = canvas.toDataURL("image/png");
    downloadDataUrl(`${filenameBase}.png`, pngDataUrl);
    URL.revokeObjectURL(svgUrl);
  };
  img.onerror = () => {
    URL.revokeObjectURL(svgUrl);
  };
  img.src = svgUrl;
}
