import express from "express";

const app = express();
app.use(express.json());

const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API_KEY;
const PORT = process.env.PORT || 3000;

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", key_set: !!HIGGSFIELD_API_KEY });
});

// Text-to-Image (Nano Banana)
app.post("/api/higgsfield/text-to-image", async (req, res) => {
  const { prompt, aspect_ratio = "1:1", webhook_url } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const endpoint = "https://platform.higgsfield.ai/nano_banana/text-to-image";
  const urlObj = new URL(endpoint);
  if (webhook_url) urlObj.searchParams.set("hf_webhook", webhook_url);

  const payload = { prompt, aspect_ratio };
  console.log("→ POST", urlObj.toString());
  console.log("→ payload:", JSON.stringify(payload));

  try {
    const response = await fetch(urlObj.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${HIGGSFIELD_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("← status:", response.status, JSON.stringify(data));
    if (!response.ok) return res.status(502).json(data);
    res.json({ requestId: data.request_id, statusUrl: data.status_url, cancelUrl: data.cancel_url });
  } catch (err) {
    console.error("error:", err);
    res.status(503).json({ error: err.message });
  }
});

// Image-to-Video
app.post("/api/higgsfield/image-to-video", async (req, res) => {
  const { image_url, prompt, model = "dop-turbo", webhook_url } = req.body;
  if (!image_url) return res.status(400).json({ error: "image_url is required" });
  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  const urlObj = new URL("https://platform.higgsfield.ai/v1/image2video/dop");
  if (webhook_url) urlObj.searchParams.set("hf_webhook", webhook_url);

  try {
    const response = await fetch(urlObj.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${HIGGSFIELD_API_KEY}`,
      },
      body: JSON.stringify({ params: { input_images: [{ type: "image_url", image_url }], prompt, model } }),
    });
    const data = await response.json();
    console.log("← image-to-video:", response.status, JSON.stringify(data));
    if (!response.ok) return res.status(502).json(data);
    res.json({ requestId: data.request_id, statusUrl: data.status_url, cancelUrl: data.cancel_url });
  } catch (err) {
    console.error("error:", err);
    res.status(503).json({ error: err.message });
  }
});

// Job status
app.get("/api/higgsfield/jobs/:requestId", async (req, res) => {
  try {
    const response = await fetch(
      `https://platform.higgsfield.ai/requests/${req.params.requestId}/status`,
      { headers: { Authorization: `Key ${HIGGSFIELD_API_KEY}` } }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Webhook receiver
const webhookEvents = new Map();

app.post("/api/higgsfield/webhook", (req, res) => {
  const { request_id, status, url: outputUrl } = req.body;
  if (request_id) {
    webhookEvents.set(request_id, { requestId: request_id, status, outputUrl, receivedAt: new Date().toISOString() });
  }
  res.json({ status: "ok" });
});

app.get("/api/higgsfield/webhook-events/:requestId", (req, res) => {
  const event = webhookEvents.get(req.params.requestId);
  if (!event) return res.status(404).json({ error: "not found" });
  res.json(event);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
