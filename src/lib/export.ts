import * as XLSX from "xlsx";

export type ExportRow = Record<string, string | number>;

/** Downloads tabular data as a real .csv or .xlsx file. */
export function exportRows(filename: string, rows: ExportRow[], format: "csv" | "xlsx") {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "No data": "" }]);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(sheet);
    download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
    return;
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Report");
  const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filename}.xlsx`,
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
