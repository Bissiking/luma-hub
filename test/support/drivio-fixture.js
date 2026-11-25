import http from "node:http";
import crypto from "node:crypto";
export async function createDrivioFixture({ count = 3 } = {}) {
  const token = `drv_hub_${crypto.randomBytes(32).toString("base64url")}`,
    otherToken = `drv_hub_${crypto.randomBytes(32).toString("base64url")}`;
  const controls = {
    status: 200,
    delay: 0,
    invalid: false,
    redirect: false,
    nullFuel: true,
    requests: [],
  };
  const vehicles = Array.from({ length: count }, (_, i) => ({
    id: `car-${i}`,
    brand: i ? "Renault" : "CUPRA",
    model: i ? "Clio" : "Formentor",
    year: 2024,
    status: i === 2 ? "ARCHIVED" : "ACTIVE",
    isPrimary: i === 0,
    mileage: {
      value: i ? 1500 : 36000,
      unit: "km",
      source: "recorded",
      recordedAt: "2026-11-17T00:00:00.000Z",
    },
    vin: "PRIVATE-VIN-CANARY",
  }));
  const foreign = {
    ...vehicles[0],
    id: "foreign-car",
    brand: "PRIVATE-CAR-CANARY",
  };
  function summary(vehicleId) {
    return {
      version: "1",
      generatedAt: new Date().toISOString(),
      vehicleId,
      mileage: { value: 36000, unit: "km", source: "recorded" },
      maintenance: {
        items: [
          {
            id: "service-1",
            type: "VIDANGE",
            category: "MOTEUR",
            subcategory: "VIDANGE",
            title: "Vidange moteur",
            dueDate: null,
            dueMileage: 37000,
            status: "SOON",
            daysRemaining: null,
            kmRemaining: 1000,
            estimatedDate: null,
          },
        ],
        totalInSample: 1,
        truncated: false,
      },
      alerts: {
        items: [
          {
            key: "service-1",
            category: "maintenance",
            title: "Vidange à prévoir",
            detail: "Encore 1 000 km avant l’échéance.",
            urgent: false,
          },
        ],
        truncated: false,
      },
      expenses: {
        recent: [
          {
            id: "expense-1",
            category: "CARBURANT",
            subcategory: null,
            amount: 40,
            date: "2026-11-17T00:00:00.000Z",
            comment: "PRIVATE-NOTE-CANARY",
          },
        ],
        month: {
          from: "2026-11-01T00:00:00.000Z",
          to: new Date().toISOString(),
          total: 40,
          count: 1,
          currency: "EUR",
          source: "recorded",
          basis: "expense-ledger",
        },
      },
      fuel: {
        entriesInSample: controls.nullFuel ? 1 : 3,
        truncated: false,
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-17T00:00:00.000Z",
        consumptionPer100Km: controls.nullFuel ? null : 6.7,
        costPer100Km: controls.nullFuel ? null : 13.4,
        total: 40,
        liters: 20,
        currency: "EUR",
        source: "calculated",
      },
      token: "NEVER-FORWARD-CANARY",
    };
  }
  const server = http.createServer(async (req, res) => {
    controls.requests.push({
      path: new URL(req.url, "http://test").pathname,
      method: req.method,
    });
    if (controls.delay)
      await new Promise((resolve) => setTimeout(resolve, controls.delay));
    res.setHeader("content-type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    if (controls.redirect) {
      res.writeHead(302, { location: "http://127.0.0.1:1/never-forward" });
      res.end();
      return;
    }
    const current =
      req.headers.authorization === `Bearer ${token}`
        ? vehicles
        : req.headers.authorization === `Bearer ${otherToken}`
          ? [foreign]
          : null;
    if (!current || controls.status === 401) {
      res.writeHead(401);
      res.end(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "Private error" },
        }),
      );
      return;
    }
    if (controls.status !== 200) {
      res.writeHead(controls.status);
      res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }));
      return;
    }
    const url = new URL(req.url, "http://test");
    if (controls.invalid) {
      res.end(JSON.stringify({ version: "2", vehicles: [] }));
      return;
    }
    if (url.pathname === "/api/hub/v1/vehicles") {
      const offset = Number(url.searchParams.get("offset") || 0);
      res.end(
        JSON.stringify({
          version: "1",
          generatedAt: new Date().toISOString(),
          vehicles: current.slice(offset, offset + 50),
          nextOffset: current.length > offset + 50 ? offset + 50 : null,
        }),
      );
      return;
    }
    if (
      url.pathname === "/api/hub/v1/summary" &&
      current.some((v) => v.id === url.searchParams.get("vehicle"))
    ) {
      res.end(JSON.stringify(summary(url.searchParams.get("vehicle"))));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    token,
    otherToken,
    controls,
    summary,
    vehicles,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
