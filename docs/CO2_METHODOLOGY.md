# CO₂ methodology

Fresh As Ever estimates prevented CO₂ equivalents (CO₂e) from rescued food using:

- **Factor:** ~2.5 kg CO₂e per kg of food (Stitch / impact screen copy).
- **Food weight:** `rescue_bags.estimated_weight_kg` — entered by merchants at bag create/edit (presets or custom 0.1–25 kg).
- **Per completed rescue:** `quantity × estimated_weight_kg × 2.5`.

Implementation: [`src/lib/co2Impact.ts`](../src/lib/co2Impact.ts). Legacy bags without a merchant weight fall back to a retail-value proxy, then 1 kg default.

Web mirror: `fresh-as-ever/src/lib/co2Impact.js`.
