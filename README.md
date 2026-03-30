[![Test and Build](https://github.com/kkrugley/trailx/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kkrugley/trailx/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-9-FF6920?logo=pnpm)](https://pnpm.io/)
[![Telegram](https://img.shields.io/badge/Telegram%20Bot-26A5E4?logo=telegram&logoColor=white)](https://t.me/@trailxapp_bot)

# TrailX

**Plan your next cycling adventure together — right inside Telegram.**

No more WhatsApp threads with seventeen different Google Maps links. No more "wait, which route are we doing again?" TrailX is a bicycle route planner built for groups. Plot your route, find what's along the way (water stops, food, shelters, repair stations), and export to GPX when you're ready to ride.

---

## What it does

You drop a start point, an end point, and as many stops as you want. TrailX calculates the best cycling route, shows you the full elevation profile, and finds relevant points of interest within an adjustable distance from your actual route.

When you find a coffee shop or a drinking fountain that looks perfect, you can add it as a waypoint (the route recalculates) or save it as a standalone POI in your GPX export. Those are two different things and TrailX keeps them separate.

Plan solo or with a group. If you're planning with friends, the Telegram bot handles everything: shared routes, real-time updates, group voting on new stops, weather forecasts, and GPX delivery straight to the chat.

---

## Features

### Route Planning
- Add start, end, and unlimited intermediate waypoints
- Drag and drop to reorder stops, find the perfect order before you ride
- Pick from multiple route options: flatter, shadier, quieter, before committing
- Elevation chart, road surface breakdown, and road class analysis
- Choose your profile: road bike, mountain bike, gravel, or on foot

### Points of Interest
- POI discovery along your route, not the viewport
- Adjustable search buffer (default 500 m)
- Categories: drinking water, food, shelters, bicycle repair, bike shops, campsites, historic sites, viewpoints
- Filter by category on the map
- Tap any POI to see details and photos
- Add to route or save as GPX waypoint

### Export
- GPX 1.1 with full elevation data
- Control what goes in: track, route, waypoints
- Works with Garmin, Wahoo, komoot, Strava, and any GPX-capable app

### Telegram Integration
- Open TrailX as a Mini App directly from any Telegram chat
- Shared group routes: everyone sees the same map in real time
- `/add [place]` — drop a stop into the route, no debate, it just goes in
- `/vote [place]` — throw a new stop to the group, it joins only when everyone agrees
- `/gpx` — sends the GPX file to the chat so everyone can download it
- `/weather [departure time]` — tells you what weather you'll actually hit mid-ride, not just at the start

### Map & Navigation
- Clean vector map powered by OpenFreeMap
- Multiple map styles: Classic, Classic 3D, Positron, Satellite, Topo
- Distance ruler tool for quick ad-hoc measurements
- Works on desktop, mobile browser, and inside Telegram

---

## What makes TrailX different

### POI search follows the route, not the map

Most route planners find points of interest based on what's visible in the current map view. Scroll left and you get different results. TrailX searches along your actual route geometry, within a distance you set. The results reflect your ride, not your viewport. This matters when you're planning a 120 km day and need to know where the water stops are at kilometre 80, not just the ones near where you're currently looking.

### Group planning that lives in Telegram

Your cycling group is already in a Telegram chat. TrailX brings the route planner into that chat, no sign-ups required. One person with a subscription unlocks group mode for the whole chat. Routes are shared and live: edits by anyone appear for everyone in real time. The bot handles voting, GPX delivery, and weather forecasting without any of you leaving the conversation.

### Weather that moves with you

When you ask for a weather forecast, TrailX doesn't just give you conditions at the start. It calculates how far you'll have traveled at each hour (at your target speed) and pulls the forecast for that location at that time. Heading into a headwind at kilometre 90? You'll know before you leave.

### Two ways to use a POI

Found a great café along the route? You can add it as a waypoint: the route recalculates to go through it. Or save it as a standalone POI that appears in your GPX export without changing your route geometry. These are different operations and TrailX keeps them separate.

---

## How to use it

**In Telegram:** Add [@trailxapp_bot](https://t.me/@trailxapp_bot) to your group chat, then type `/app` to open the planner.

**On the web:** Open the app in any browser. Drag waypoints to build your route. Right-click (or long-press on mobile) anywhere on the map to place points directly.

**Exporting:** When your route is ready, hit Export, pick what to include, and download your GPX.

---

## Contributing

Want to run TrailX locally or contribute? The setup script handles the boring parts.

### Quick setup

Run `scripts/setup-local.sh` to check Node.js and pnpm versions, install dependencies, set up environment files, and generate the Prisma client.

### Running locally

```bash
# Install dependencies
pnpm install

# Build shared package first
pnpm --filter shared build

# Start the web app
pnpm --filter app dev

# Start the Telegram bot (in a separate terminal)
pnpm --filter bot dev

# Run tests
pnpm turbo lint
pnpm turbo typecheck 
pnpm --filter app test
pnpm --filter app test:coverage
pnpm --filter app test:watch 

# Build everything
pnpm turbo build
```

For the Telegram bot, you'll need a bot token from [@BotFather](https://t.me/BotFather) and a PostgreSQL database. Set `BOT_TOKEN`, `DATABASE_URL`, and optionally `GRAPHHOPPER_API_KEY` in `packages/bot/.env`.

---

## Credits

TrailX uses open data and open-source libraries. Thanks to:

- **Maps & Geodata**
  - [OpenStreetMap](https://www.openstreetmap.org/) contributors — map data, © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/)
  - [OpenFreeMap](https://openfreemap.org/) — vector tiles, no API key
  - [MapLibre GL JS](https://maplibre.org/) — WebGL map renderer

- **Routing**
  - [GraphHopper](https://www.graphhopper.com/) — routing with elevation and cycling profiles

- **Points of Interest**
  - [Overpass API](https://overpass-api.de/) — OSM data queries by Roland Olbricht

- **Geocoding**
  - [Nominatim](https://nominatim.org/) — OpenStreetMap geocoding

- **POI Images**
  - [Wikidata](https://www.wikidata.org/) — structured knowledge base
  - [Mapillary](https://www.mapillary.com/) — street-level photos

- **Weather**
  - [Open-Meteo](https://open-meteo.com/) — free weather data

- **Telegram**
  - [Telegram Mini Apps](https://core.telegram.org/bots/webapps) platform
  - [@twa-dev/sdk](https://github.com/twa-dev/SDK) — TypeScript SDK
  - [grammY](https://grammy.dev/) — bot framework

- **Infrastructure**
  - [React](https://react.dev/) — UI
  - [Vite](https://vitejs.dev/) — build tool
  - [Zustand](https://zustand-demo.pmnd.rs/) — state
  - [Dexie](https://dexie.org/) — IndexedDB
  - [Fastify](https://fastify.dev/) — web framework
  - [Prisma](https://www.prisma.io/) — database ORM
  - [Turborepo](https://turbo.build/) — monorepo
  - [Phosphor Icons](https://phosphoricons.com/) — icons
  - [@dnd-kit](https://dndkit.com/) — drag and drop

---


## License

This project is licensed under the GPL License - see the [LICENSE](LICENSE) file for details.