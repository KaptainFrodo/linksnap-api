import express from "express";
import multer from "multer";
import cors from "cors";
import sharp from "sharp";
import { scanRGBABuffer } from "@undecaf/zbar-wasm";
import { createWorker } from "tesseract.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("File must be an image."));
  }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "LinkSnap API", version: "2.1.0" });
});

app.post("/decode", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded." });
  try {
    const result = await decodeQR(req.file.buffer);
    if (result) {
      const isUrl = /^https?:\/\//i.test(result) || /^www\./i.test(result);
      return res.json({ success: true, data: result, isUrl,
        url: isUrl ? (result.startsWith("http") ? result : "https://" + result) : null });
    }
    return res.json({ success: false, error: "No QR code found in image." });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/ocr", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded." });
  try {
    const url = await extractURL(req.file.buffer);
    if (url) return res.json({ success: true, url });
    return res.json({ success: false, error: "No URL found in image." });
  } catch (e) {
    console.error("OCR error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

async function decodeQR(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;
  if (!width || !height) return null;
  async function getRGBA(pipeline) {
    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
  async function tryDecode({ data, width, height }) {
    try {
      const symbols = await scanRGBABuffer(data.buffer, width, height);
      return symbols?.length ? symbols[0].decode() : null;
    } catch { return null; }
  }
  function transform(buf, fn) {
    const out = Buffer.from(buf);
    for (let i = 0; i < out.length; i += 4) {
      const [r, g, b, a] = fn(out[i], out[i+1], out[i+2], out[i+3]);
      out[i]=r; out[i+1]=g; out[i+2]=b; out[i+3]=a;
    }
    return out;
  }
  const toGray = ({data,width,height}) => ({ data: transform(data,(r,g,b,a)=>{const v=Math.round(.299*r+.587*g+.114*b);return[v,v,v,a];}), width, height });
  const stripColor = ({data,width,height},t) => ({ data: transform(data,(r,g,b,a)=>{const m=(r+g+b)/3,s=Math.sqrt(((r-m)**2+(g-m)**2+(b-m)**2)/3);return s>t?[255,255,255,a]:[r,g,b,a];}), width, height });
  const boost = ({data,width,height},factor) => ({ data: transform(data,(r,g,b,a)=>{const adj=v=>Math.max(0,Math.min(255,Math.round((v-128)*factor+128)));return[adj(r),adj(g),adj(b),a];}), width, height });
  const raw1 = await getRGBA(sharp(imageBuffer));
  const raw2 = await getRGBA(sharp(imageBuffer).resize(width*2, height*2, { kernel: "nearest" }));
  const passes = [
    () => tryDecode(raw1), () => tryDecode(raw2), () => tryDecode(toGray(raw1)),
    () => tryDecode(stripColor(raw1,20)), () => tryDecode(toGray(stripColor(raw1,20))),
    () => tryDecode(boost(toGray(raw1),2.5)), () => tryDecode(toGray(stripColor(raw2,20))),
  ];
  for (const pass of passes) { const r = await pass(); if (r) return r; }
  return null;
}

async function extractURL(imageBuffer) {
  const worker = await createWorker("eng");
  try {
    const variants = await buildVariants(imageBuffer);
    for (const { buffer, label } of variants) {
      const { data: { text } } = await worker.recognize(buffer);
      const url = findBestURL(text);
      if (url) {
        console.log("OCR success:", label, url);
        return url;
      }
    }
    return null;
  } finally {
    await worker.terminate();
  }
}

async function buildVariants(imageBuffer) {
  const variants = [];
  const base = await sharp(imageBuffer)
    .resize({ width: 2400, withoutEnlargement: false })
    .greyscale().normalise().sharpen({ sigma: 1.5 }).toBuffer();
  for (const angle of [0, 90, 180, 270]) {
    const rotated = await sharp(base).rotate(angle).toBuffer();
    variants.push({ buffer: rotated, label: `base_${angle}` });
  }
  const bw = await sharp(imageBuffer)
    .resize({ width: 2400, withoutEnlargement: false })
    .greyscale().normalise().threshold(140).sharpen().toBuffer();
  for (const angle of [0, 90, 180, 270]) {
    const rotated = await sharp(bw).rotate(angle).toBuffer();
    variants.push({ buffer: rotated, label: `bw_${angle}` });
  }
  return variants;
}

function findBestURL(text) {
  let cleaned = text;
  cleaned = cleaned.replace(/[hn]ttps?\s*:\s*\/\s*\//gi, "https://");
  cleaned = cleaned.replace(/www\s*\.\s*/gi, "www.");
  const lines = cleaned.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const joined = lines.join(" ");
  const urlPattern = /https?:\/\/[^\s\)\]\}\,\"\'<>]{4,}/gi;
  const wwwPattern = /www\.[^\s\)\]\}\,\"\'<>]{4,}/gi;
  let matches = (joined.match(urlPattern) || []).concat(joined.match(wwwPattern) || []);
  for (let url of matches) {
    url = url.replace(/[.,;:!?)\]]+$/, "").replace(/\s+/g, "");
    if (!url.startsWith("http")) url = "https://" + url;
    try { new URL(url); return url; } catch {}
  }
  return null;
}

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ success: false, error: err.message });
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("LinkSnap API v2.1 running on port " + PORT));
