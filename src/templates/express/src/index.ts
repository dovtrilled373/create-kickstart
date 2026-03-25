import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: `Welcome to {{PROJECT_NAME}}` });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

app.listen(PORT, () => {
  console.log(`{{PROJECT_NAME}} listening on http://localhost:${PORT}`);
});

export default app;
