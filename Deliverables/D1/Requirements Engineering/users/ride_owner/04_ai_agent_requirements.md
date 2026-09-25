# Ride Owner — AI Agent Requirements

**Status:** Not Applicable

As per current design decisions (2026-09-24), the **Ride Owner** role does not utilize specialized AI agent features. 

The rationale for this constraint includes:
- **Manual Join Decisions:** The Ride Owner reviews each Rider's join request and explicitly accepts or rejects it. The application provides the request and relevant profile details, but does not use an AI agent to make or automate this decision.
- **External Driver Coordination:** The Ride Owner manages driver selection and vehicle booking entirely outside the application.
- **Owner-Defined Ride Details:** The Ride Owner explicitly sets the destination, departure time, capacity, and expected total fare.

If future revisions introduce AI assistance for the Ride Owner (e.g., suggesting optimal departure times based on traffic, highlighting historical reliability signals for the owner's review, or suggesting capacity adjustments), the requirements will be documented here. The Ride Owner must retain final control over join-request decisions.

Currently, any AI interactions the user might have while logged in will be limited to their actions when acting in the capacity of a regular **Rider**.
