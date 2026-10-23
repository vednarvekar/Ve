import assert from "node:assert/strict";
import { aggregateFederatedModels, MINIMUM_FEDERATED_CLIENTS } from "../dist/core/prediction/federated.js";
import { newLocalModel, rankLocalPredictions, trainLocalModel } from "../dist/core/prediction/localPredictor.js";
import { buildNetflixSearchUrl, buildWhatsAppChatUrl } from "../dist/core/browser/siteUrls.js";

function check(name, callback) {
  callback();
  console.log(`PASS ${name}`);
}

check("local predictor learns repeated time/sequence-conditioned actions", () => {
  let model = newLocalModel();
  const context = { timeBand: 1, weekday: 2, previousAction: "open_app:chrome" };
  for (let sample = 0; sample < 8; sample += 1) model = trainLocalModel(model, context, "open_app:chrome");
  assert.equal(rankLocalPredictions(model, context)[0]?.action, "open_app:chrome");
});

check("federated aggregation requires a minimum cohort and averages model parameters", () => {
  const base = newLocalModel();
  const makeModel = (value) => {
    const model = { version: 1, weights: base.weights.map((row) => [...row]) };
    model.weights[0][0] = value;
    return { version: 1, model };
  };
  assert.equal(aggregateFederatedModels([makeModel(1), makeModel(3)]), null);
  const aggregate = aggregateFederatedModels([makeModel(1), makeModel(2), makeModel(3)]);
  assert.ok(aggregate);
  assert.equal(aggregate.weights[0][0], 2);
  assert.equal(MINIMUM_FEDERATED_CLIENTS, 3);
});

check("federated aggregation rejects malformed model updates", () => {
  assert.equal(aggregateFederatedModels([
    { version: 1, model: { version: 1, weights: [] } },
    { version: 1, model: newLocalModel() },
    { version: 1, model: newLocalModel() },
  ]), null);
});

check("Netflix searches target Netflix itself and encode the query", () => {
  assert.equal(buildNetflixSearchUrl("thriller series & mystery"), "https://www.netflix.com/search?q=thriller%20series%20%26%20mystery");
});

check("WhatsApp click-to-chat URLs preserve international number and prefill text", () => {
  assert.equal(buildWhatsAppChatUrl("+91 98765 43210", "Hi Ved!"), "https://wa.me/919876543210?text=Hi%20Ved!");
});
