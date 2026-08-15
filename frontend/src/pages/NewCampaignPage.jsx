import { useEffect, useState } from "react";
import { createCampaign, fetchNiches, generateCampaign, getCampaign } from "../api";

const initialForm = {
  niche_id: "",
  product_name: "",
  target_audience: "",
  campaign_goal: "awareness",
  tone: "playful",
  brand_guideline_text: "",
};

export function NewCampaignPage() {
  const [form, setForm] = useState(initialForm);
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [campaign, setCampaign] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    fetchNiches()
      .then((data) => setNiches(data.items || []))
      .catch((error) => setMessage(error.message));
  }, []);

  const pollCampaignUntilReady = async (campaignId) => {
    setPolling(true);
    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const details = await getCampaign(campaignId);
        setCampaign(details);
        if (details.status !== "generating") {
          return;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 1500);
        });
      }
      setMessage("Campaign generation is taking longer than expected. Please refresh status.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPolling(false);
    }
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const created = await createCampaign({
        ...form,
        brand_guideline_text: form.brand_guideline_text || null,
      });
      setMessage(`Campaign created: ${created.campaign_id}`);
      const started = await generateCampaign(created.campaign_id);
      setCampaign({ id: started.campaign_id, status: "generating" });
      await pollCampaignUntilReady(started.campaign_id);
      setForm(initialForm);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">New Campaign</h1>
      <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Niche</span>
          <select
            name="niche_id"
            value={form.niche_id}
            onChange={onChange}
            required
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="">Select niche</option>
            {niches.map((niche) => (
              <option key={niche.id} value={niche.id}>
                {niche.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Product Name</span>
          <input
            name="product_name"
            value={form.product_name}
            onChange={onChange}
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Target Audience</span>
          <input
            name="target_audience"
            value={form.target_audience}
            onChange={onChange}
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Campaign Goal</span>
            <select
              name="campaign_goal"
              value={form.campaign_goal}
              onChange={onChange}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="awareness">awareness</option>
              <option value="launch">launch</option>
              <option value="promotion">promotion</option>
              <option value="engagement">engagement</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Tone</span>
            <select
              name="tone"
              value={form.tone}
              onChange={onChange}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="playful">playful</option>
              <option value="formal">formal</option>
              <option value="bold">bold</option>
              <option value="minimal">minimal</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Brand Guideline Text (optional)</span>
          <textarea
            name="brand_guideline_text"
            value={form.brand_guideline_text}
            onChange={onChange}
            rows={4}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Create & Generate"}
        </button>
      </form>

      {message && <p className="text-sm text-slate-700">{message}</p>}
      {polling && <p className="text-sm text-amber-700">Generating campaign content...</p>}
      {campaign && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Latest Campaign Status: {campaign.status}</h2>
          {campaign.generated_caption && <p className="mt-2 text-sm">{campaign.generated_caption}</p>}
          {campaign.generated_script && <p className="mt-2 text-sm">{campaign.generated_script}</p>}
        </div>
      )}
    </div>
  );
}
