const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

// In production, set origin to your frontend domain instead of true.
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Ensure browsers can read the Content-Disposition header and allow credentials.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// Optional map for nicer filenames per bill id.
const filenameMap = {
  "69368b7b684539e08eb01077": "KA28AB4623.pdf",
};

function getPdfPathForBill(id) {
  // For demo: check local ./pdfs/<id>.pdf
  const filePath = path.resolve(__dirname, "pdfs", `${id}.pdf`);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

app.get("/bill/:id/pdf", (req, res) => {
  const { id } = req.params;
  const pdfPath = getPdfPathForBill(id);

  if (!pdfPath) {
    return res.status(404).json({ success: false, message: "PDF not found" });
  }

  const filename = filenameMap[id] || `bill-${id}.pdf`;

  try {
    const stat = fs.statSync(pdfPath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    const stream = fs.createReadStream(pdfPath);
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, message: "Server error streaming file" });
      } else {
        res.destroy(err);
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("Error serving pdf:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`PDF server listening on port ${PORT}`);
  console.log("Ensure your PDFs exist at ./pdfs/<id>.pdf before requesting.");
});
