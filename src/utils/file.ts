import fs from 'fs/promises';
import path from 'path';

/**
 * Reads a file and returns its content as a string.
 * @param filePath The path to the file.
 * @returns A promise that resolves with the file content.
 */
async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Writes data to a file.
 * @param filePath The path to the file.
 * @param data The data to write.
 * @returns A promise that resolves when the file is written.
 */
async function writeFile(filePath: string, data: string): Promise<void> {
  try {
    await fs.writeFile(filePath, data, 'utf-8');
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Checks if a file exists.
 * @param filePath The path to the file.
 * @returns A promise that resolves with true if the file exists, false otherwise.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a directory if it doesn't exist.
 * @param dirPath The path to the directory.
 * @returns A promise that resolves when the directory is created.
 */
async function createDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Deletes a file.
 * @param filePath The path to the file.
 * @returns A promise that resolves when the file is deleted.
 */
async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Deletes a directory recursively.
 * @param dirPath The path to the directory.
 * @returns A promise that resolves when the directory is deleted.
 */
async function deleteDirectory(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error deleting directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Lists all files in a directory.
 * @param dirPath The path to the directory.
 * @returns A promise that resolves with an array of file names.
 */
async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);
  } catch (error) {
    console.error(`Error listing files in directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Lists all subdirectories in a directory.
 * @param dirPath The path to the directory.
 * @returns A promise that resolves with an array of subdirectory names.
 */
async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.error(`Error listing directories in directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Gets the size of a file.
 * @param filePath The path to the file.
 * @returns A promise that resolves with the file size in bytes.
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Copies a file from source to destination.
 * @param sourcePath The path to the source file.
 * @param destinationPath The path to the destination file.
 * @returns A promise that resolves when the file is copied.
 */
async function copyFile(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fs.copyFile(sourcePath, destinationPath);
  } catch (error) {
    console.error(`Error copying file from ${sourcePath} to ${destinationPath}:`, error);
    throw error;
  }
}

/**
 * Moves a file from source to destination.
 * @param sourcePath The path to the source file.
 * @param destinationPath The path to the destination file.
 * @returns A promise that resolves when the file is moved.
 */
async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    console.error(`Error moving file from ${sourcePath} to ${destinationPath}:`, error);
    throw error;
  }
}

/**
 * Reads a JSON file and parses it into an object.
 * @param filePath The path to the JSON file.
 * @returns A promise that resolves with the parsed JSON object.
 */
async function readJsonFile<T = any>(filePath: string): Promise<T> {
  try {
    const fileContent = await readFile(filePath);
    return JSON.parse(fileContent) as T;
  } catch (error) {
    console.error(`Error reading or parsing JSON file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Writes an object to a JSON file.
 * @param filePath The path to the JSON file.
 * @param data The object to write.
 * @param space The space argument for JSON.stringify.
 * @returns A promise that resolves when the file is written.
 */
async function writeJsonFile(filePath: string, data: any, space?: string | number): Promise<void> {
  try {
    const jsonData = JSON.stringify(data, null, space);
    await writeFile(filePath, jsonData);
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Recursively lists all files in a directory and its subdirectories.
 * @param dirPath The path to the directory.
 * @returns A promise that resolves with an array of full file paths.
 */
async function listFilesRecursive(dirPath: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(await listFilesRecursive(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    return files;
  } catch (error) {
    console.error(`Error listing files recursively in directory ${dirPath}:`, error);
    throw error;
  }
}

export default {
  readFile,
  writeFile,
  fileExists,
  createDirectory,
  deleteFile,
  deleteDirectory,
  listFiles,
  listDirectories,
  getFileSize,
  copyFile,
  moveFile,
  readJsonFile,
  writeJsonFile,
  listFilesRecursive,
};
