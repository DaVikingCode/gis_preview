# GIS Preview — Domain Language

Guided product-demo tour of a GIS platform. The flagship scene supervises an **HTA** (medium-voltage, 20 kV) electrical distribution network in real time. Terms below are the canonical vocabulary for that scene; UI copy is in French.

## Réseau HTA (supervision temps réel)

**Poste**:
A node of the HTA network rendered as a map pin — substation, pole-mounted transformer (H61), underground junction, or HTA/BT cabin. Carries a live load and a status colour.
_Avoid_: station, marker, point

**Poste source**:
The 90 / 20 kV feeder substation (P-4521 Salbris) at the head of the network. Dominates total network load, so its surcharge is the only one that visibly moves the streaming MW graph. The demo's **incident poste**.
_Avoid_: main station, hub

**Charge**:
A poste's instantaneous load as a fraction of its capacity (capMva). Drives both the pin colour and the per-poste bar in the panel.
_Avoid_: usage, power

**Statut** — a poste's colour band, derived from its charge:

- **Nominal** (vert, < 70 %) — _avoid_: ok, healthy, green
- **Surveillé** (ambre, 70–90 %) — watched but not alarming. _Avoid_: warning
- **Surcharge** (rouge, ≥ 90 %) — load past the critical threshold; raises an alert (sonar ping + red banner). In the demo, a scripted event forced onto the poste source. _Avoid_: alerte (the banner is the alerte; the state is the surcharge), critical, overload

**Incident**:
The single scripted storyline the tour drives the poste source through: nominal → surcharge → intervention → rétablissement. Exactly one poste is ever an incident at a time.
_Avoid_: event, problem, outage

**Fiche (d'intervention)**:
The popup card opened on a poste (photo, tension, charge, anomalies, dernière visite). Its status progresses à faire → en cours → terminé during the intervention.
_Avoid_: card, tooltip (the tooltip is the lightweight hover label; the fiche is the full popup), modal

**Rétablissement**:
The poste returning to nominal after the intervention is terminé — charge ramps back down, pin turns green, a green "résolu" wave plays once.
_Avoid_: recovery, reset, fix

**Flux SCADA**:
The simulated live telemetry feed (per-poste charge + total MW), refreshed each second. Stands in for a production WebSocket / Redis stream.
_Avoid_: data feed, stream, realtime data

**Conduite**:
The control-room / operations function (agence Conduite Centre) that supervises the network and dispatches interventions.
_Avoid_: control center, ops
