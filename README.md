# AstroHealth

AstroHealth is a space medical monitoring dashboard for astronaut Adam during a full mission lifecycle. It presents mission telemetry, health risk analysis, medical recommendations, chatbot support, body-zone highlighting, and a normalized health profile chart for the selected mission phase.

The project is currently an offline prototype. It uses JSON data and a PHP API layer to simulate future AI-powered medical monitoring without requiring MySQL or a real AI model yet.

## Project Idea

AstroHealth helps a mission medical team explain Adam's health state across key spaceflight phases:

- Earth baseline
- Pre-launch check
- Launch stress
- Zero gravity
- Exercise neglect
- Solar radiation storm
- Mental health isolation
- Landing preparation
- Rehabilitation

Each phase includes vital signs, alert status, AI-style reasoning, medical recommendations, chatbot messaging, body-zone highlighting, and chart data.

## Tech Stack

- HTML
- CSS
- JavaScript
- PHP
- JSON
- XAMPP Apache

Current project constraints:

- No React
- No Node.js app runtime
- No MySQL yet
- No real AI integration yet

## How To Run With XAMPP

1. Place the project folder at:

   ```text
   C:\xampp\htdocs\AstroHealth
   ```

2. Start Apache from the XAMPP Control Panel.

3. Open the dashboard:

   [http://localhost:8080/AstroHealth](http://localhost:8080/AstroHealth)

If your Apache port is different, adjust the URL to match your local XAMPP configuration.

## Project Structure

```text
AstroHealth/
  index.html              Main dashboard UI
  style.css               NASA-style dashboard styling
  script.js               Frontend logic and API integration
  data-schema.json        Shared mission data source
  get_telemetry.php       Legacy/simple telemetry file
  README.md               Project documentation
  api/
    config.php            Future reusable PDO MySQL connection helper
    telemetry_get.php     Returns the full JSON schema
    phase_get.php         Returns one mission phase by phase_id
    risk_predict.php      Rule-based placeholder risk analysis API
    chatbot.php           Rule-based placeholder chatbot API
  database/
    schema.sql            Future MySQL schema, not connected yet
    seed.sql              Future MySQL seed data, not required yet
```

## Current Status

Completed:

- Professional dark mission-control dashboard UI
- Mission phase buttons
- Vital signs cards
- AI Risk Analysis panel
- Medical Recommendations panel
- Chatbot panel
- Body schematic with risk highlighting
- Current Phase Health Profile chart
- JSON-driven mission data
- PHP API layer
- Local JSON fallback if PHP/API loading fails
- API connection status indicator
- Loading and error states

Not added yet:

- MySQL database
- Authentication
- Real AI model
- Python AI service
- Live sensor telemetry

## API Contract

All APIs return JSON and read from `data-schema.json` for the current offline prototype.

### `api/telemetry_get.php`

Returns the full project schema.

Example:

```http
GET /AstroHealth/api/telemetry_get.php
```

Response includes:

- `project`
- `schema_version`
- `astronaut`
- `phase_order`
- `mission_phases`

This endpoint is used by the frontend to load the mission phase index and local phase data.

### `api/phase_get.php?phase_id=...`

Returns one mission phase object. This endpoint now tries MySQL first through `api/config.php`, then safely falls back to `data-schema.json` if MySQL is unavailable or the requested phase cannot be fully assembled from database records.

Example:

```http
GET /AstroHealth/api/phase_get.php?phase_id=zero_gravity
```

Success response includes the full phase object, including:

- `phase_id`
- `phase_title`
- `alert_level`
- `heart_rate`
- `blood_pressure`
- `oxygen_level`
- `radiation_level`
- `sleep_hours`
- `bone_density`
- `exercise_status`
- `mental_status`
- `ai_prediction`
- `ai_reasoning`
- `medical_recommendation`
- `chatbot_message`
- `highlighted_body_zone`
- `highlighted_body_zones`
- `color_status`
- `telemetry_chart`
- `data_source`, either `mysql` or `json_fallback`

Error responses:

- `400` if `phase_id` is missing
- `404` if `phase_id` is invalid
- `500` if `data-schema.json` is missing or invalid

### `api/risk_predict.php`

Returns a clean AI-like risk analysis response using current rule-based placeholder logic.

Example:

```http
GET /AstroHealth/api/risk_predict.php?phase_id=solar_radiation_storm
```

Success response:

```json
{
  "status": "success",
  "source": "rule_based_placeholder",
  "phase_id": "solar_radiation_storm",
  "risk_level": "emergency",
  "predicted_problem": "Acute radiation exposure risk.",
  "reasoning": "Radiation level has exceeded emergency threshold and stress markers are elevated.",
  "recommended_action": "Move to the radiation shelter, limit exposure time, pause nonessential tasks, and monitor nausea, headache, and fatigue.",
  "highlighted_body_zones": ["head", "chest"]
}
```

Compatibility aliases are also included for current frontend/test code:

- `alert_level`
- `ai_engine`
- `ai_prediction`
- `ai_reasoning`
- `highlighted_body_zone`
- `medical_recommendation`

Error responses:

- `400` if `phase_id` is missing
- `404` if `phase_id` is invalid
- `500` if `data-schema.json` is missing or invalid

### `api/chatbot.php`

Returns a clean chatbot response using current rule-based placeholder logic.

Example:

```http
POST /AstroHealth/api/chatbot.php
Content-Type: application/json

{
  "phase_id": "mental_health_isolation",
  "user_message": "I feel lonely and tired"
}
```

Success response:

```json
{
  "status": "success",
  "source": "rule_based_placeholder",
  "detected_emotion": "mental_health_stress",
  "confidence_score": 0.92,
  "response_chatbot": "Adam, I hear you. You are not alone. Let us slow the next minute down: breathe in for four seconds, breathe out for six, and send one short status note to mission control.",
  "environment_control_trigger": {
    "change_lighting_color": "#FF8C00",
    "play_background_sound": "earth_rain.mp3"
  }
}
```

Error responses:

- `400` if the request body is not valid JSON
- `400` if `phase_id` is missing
- `400` if `phase_id` or `user_message` is not a string
- `404` if `phase_id` is invalid
- `405` if the request method is not `POST`
- `500` if `data-schema.json` is missing or invalid

## Frontend Data Flow

The dashboard uses `script.js` to load data in this order:

1. Try PHP API endpoints through XAMPP/Apache.
2. Use `api/telemetry_get.php` to load the mission phase list.
3. Use `api/phase_get.php?phase_id=...` when a phase is selected.
4. If PHP fails, fall back to local `data-schema.json`.
5. If local JSON fails, use the built-in frontend fallback object.

This keeps the dashboard working during presentations even if Apache or PHP has a temporary issue.

## Demo Guide

For a clear presentation flow, click these mission phases in order:

1. **Earth Baseline** - Start with Adam's normal health profile and green body-zone state.
2. **Launch Stress** - Show cardiovascular strain, serious alert status, and breathing-support recommendations.
3. **Exercise Neglect** - Explain microgravity countermeasure failure and bone-density risk in pelvis/legs.
4. **Solar Radiation Storm** - Demonstrate emergency status, radiation response, and head/chest highlighting.
5. **Mental Health Isolation** - Show psychological risk, chatbot support tone, and head-zone highlighting.
6. **Landing Preparation** - Close with re-entry readiness, balance/lower-body risk, and recovery planning.

Suggested presentation note: watch the API status label while clicking. `PHP + MySQL` means the phase response came from MySQL. `JSON Fallback` means the dashboard is safely using JSON data. `Demo Mode` means the local fallback keeps the demo running if the API is unavailable.

## Future Taqwa AI Integration

`api/risk_predict.php` and `api/chatbot.php` are prepared for future real AI integration.

Current behavior:

- Both files use `source: "rule_based_placeholder"`.
- Risk prediction is generated from existing phase data in `data-schema.json`.
- Chatbot emotion detection is simple keyword-based logic.
- Everything runs offline.

Future plan:

- Replace the placeholder functions in `risk_predict.php` and `chatbot.php` with calls to Taqwa's real AI model.
- The real AI model may run as a Python script, local service, or later backend service.
- Keep the same JSON response format so the frontend does not need to change.
- Keep `phase_id`, risk fields, chatbot fields, and body-zone fields stable.

Important frontend contract to preserve:

- `risk_predict.php` should continue returning `risk_level`, `predicted_problem`, `reasoning`, `recommended_action`, and `highlighted_body_zones`.
- `chatbot.php` should continue returning `detected_emotion`, `confidence_score`, `response_chatbot`, and `environment_control_trigger`.

## Future MySQL Database Plan

The project now includes a prepared MySQL schema at `database/schema.sql` for Anas to use later. This schema is not connected to the current app yet.

Current behavior:

- The dashboard still works from `data-schema.json`.
- The PHP API still reads JSON and returns the same responses as before.
- No MySQL connection is required to run the project.
- `api/config.php` provides a reusable PDO connection helper for future backend work, but current API endpoints do not depend on it yet.

Future plan:

- MySQL will store Adam's astronaut profile and baseline data.
- MySQL will store mission phase records and flight biometric logs.
- MySQL will store AI prediction history from `risk_predict.php`.
- MySQL will store chatbot messages, detected emotions, confidence scores, and environment-control triggers from `chatbot.php`.

Prepared tables:

- `astronauts`
- `mission_phases`
- `biometrics`
- `ai_predictions`
- `chatbot_logs`

When database integration begins, keep the existing API response formats stable so the frontend continues working while the backend source changes from JSON to MySQL.

### Create The Database In phpMyAdmin

1. Start Apache and MySQL from the XAMPP Control Panel.
2. Open phpMyAdmin:

   [http://localhost:8080/phpmyadmin](http://localhost:8080/phpmyadmin)

   If phpMyAdmin uses a different Apache port on your machine, adjust the URL.

3. Click **New** in the left sidebar.
4. Create a database named:

   ```text
   astrohealth
   ```

5. Use collation:

   ```text
   utf8mb4_unicode_ci
   ```

### Import The Database Files

Import the files in this order:

1. Select the `astrohealth` database in phpMyAdmin.
2. Go to the **Import** tab.
3. Import:

   ```text
   database/schema.sql
   ```

4. After the schema import succeeds, import:

   ```text
   database/seed.sql
   ```

`schema.sql` creates the future tables. `seed.sql` inserts Adam, the 9 mission phases, phase biometrics, placeholder AI predictions, and placeholder chatbot messages.

### Future PDO Settings

The prepared connection helper is:

```text
api/config.php
```

Default XAMPP settings:

- Host: `localhost`
- Database: `astrohealth`
- Username: `root`
- Password: empty string

The helper logs detailed PDO errors on the server and returns only generic database-unavailable messages to the frontend. This avoids exposing raw database errors during future API work.

## Cleanup Notes

The requested duplicate copy files for `index.html` and `style.css` were checked. They are not present in the current project folder, so no duplicate files were removed.

## Team Notes

- Keep `data-schema.json` as the shared source of truth until a database is added.
- Do not change API response formats casually; the frontend depends on stable JSON keys.
- Add MySQL only when the team is ready to store real users, missions, telemetry history, or AI logs.
- Add real AI only after the placeholder contracts are accepted by the team.
