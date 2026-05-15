#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "timeline-data.js");
const POSTER_DIR = path.join(ROOT, "assets", "posters");
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
const DATA_PREFIX = "window.TIMELINE_FILMS = ";
const CONCURRENCY = 12;

function readFilms() {
  const text = fs.readFileSync(DATA_FILE, "utf8").trim();
  if (!text.startsWith(DATA_PREFIX)) {
    throw new Error(`Unexpected data prefix in ${DATA_FILE}`);
  }
  return JSON.parse(text.slice(DATA_PREFIX.length).replace(/;$/, ""));
}

function posterExtension(posterPath) {
  const ext = path.extname(posterPath || "").toLowerCase();
  return ext || ".jpg";
}

function localPosterPath(film) {
  return path.join(POSTER_DIR, `${film.tmdbId}${posterExtension(film.posterPath)}`);
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.rmSync(destination, { force: true });
        reject(new Error(`${response.statusCode} ${url}`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (error) => {
      file.close();
      fs.rmSync(destination, { force: true });
      reject(error);
    });
  });
}

async function runQueue(items, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(workers);
}

async function main() {
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  const films = readFilms().filter((film) => film.posterPath);
  const missing = films.filter((film) => !fs.existsSync(localPosterPath(film)));
  let completed = 0;
  const failures = [];

  await runQueue(missing, async (film) => {
    const url = `${TMDB_IMAGE_BASE}${film.posterPath}`;
    const destination = localPosterPath(film);
    try {
      await download(url, destination);
      completed += 1;
      if (completed % 25 === 0 || completed === missing.length) {
        console.log(`Downloaded ${completed}/${missing.length}`);
      }
    } catch (error) {
      failures.push({ film, error });
      console.error(`Failed ${film.tmdbId} ${film.title}: ${error.message}`);
    }
  });

  const totalFiles = fs.readdirSync(POSTER_DIR).filter((file) => !file.startsWith(".")).length;
  console.log(`Poster files: ${totalFiles}`);
  console.log(`Skipped existing: ${films.length - missing.length}`);
  console.log(`Downloaded: ${completed}`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
