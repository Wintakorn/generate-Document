import archiver from "archiver";
import fs from 'fs-extra'
export async function createZip(files, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => resolve());
        output.on("error", reject);
        archive.on("error", reject);

        archive.pipe(output);

        for (const file of files) {
            if (fs.existsSync(file.path)) {
                archive.file(file.path, { name: file.name });
            }
        }

        archive.finalize();
    });
}
