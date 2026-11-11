(async () => {
  const rideId = "7554ba68-0792-44b0-b13f-8965918b520f";

  const listResponse = await fetch(
    `/api/rides/${encodeURIComponent(rideId)}/requests`,
    { cache: "no-store" }
  );
  if (!listResponse.ok) {
    console.error("Could not load requests:", listResponse.status, await listResponse.text());
    return;
  }

  const payload = await listResponse.json();
  const pending = (payload.requests ?? [])
    .filter((request) => request.status === "pending")
    .slice(0, 2);

  if (pending.length !== 2) {
    console.error("Need two pending requests on this demo ride; found:", pending.length);
    return;
  }

  const results = await Promise.all(
    pending.map(async (request) => {
      const response = await fetch(
        `/api/rides/${encodeURIComponent(rideId)}/requests/${encodeURIComponent(request.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept" }),
        }
      );
      return {
        rider: request.riderName ?? request.id,
        status: response.status,
        response: await response.text(),
      };
    })
  );

  console.table(results);
})();



(async () => {
  const rideId = "PASTE_RIDE_ID_HERE";
  const pickupLocationId = "PASTE_VALID_PICKUP_ID_HERE";
  const idempotencyKey = crypto.randomUUID();

  const url = `/api/rides/${encodeURIComponent(rideId)}/requests`;
  const body = JSON.stringify({ pickupLocationId, idempotencyKey });

  const results = await Promise.all(
    [1, 2].map(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      return { status: response.status, response: await response.text() };
    })
  );

  console.table(results);
})();
new URLSearchParams(location.search).get("campusLocationId")


(async () => {
  const rideId = "YOUR_DEMO_RIDE_ID";

  const list = await fetch(`/api/rides/${encodeURIComponent(rideId)}/requests`, {
    cache: "no-store",
  });
  if (!list.ok) {
    console.error("Could not load requests:", list.status, await list.text());
    return;
  }

  const payload = await list.json();
  const request = (payload.requests ?? []).find(r => r.status === "pending");
  if (!request) {
    console.error("No pending request found on this ride.");
    return;
  }

  const url = `/api/rides/${encodeURIComponent(rideId)}/requests/${encodeURIComponent(request.id)}`;
  const results = await Promise.all([1, 2].map(async () => {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    return { status: response.status, body: await response.text() };
  }));

  console.table(results);
})();