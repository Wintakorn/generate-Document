import csvParser from "csv-parser";
import fs from "fs-extra";

export function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csvParser())
            .on("data", (row) => {
                const cleanRow = {};
                Object.keys(row).forEach(key => {
                    const cleanKey = key.trim();
                    cleanRow[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key];
                });
                rows.push(cleanRow);
            })
            .on("end", () => resolve(rows))
            .on("error", reject);
    });
}