# South Park TV — experimental TizenBrew module

Remote-friendly catalog controls for the official southpark.de website.
Not affiliated with South Park, Paramount, Samsung, or TizenBrew.

## Installation
In TizenBrew, choose Module Manager > Add GitHub Module and enter:

    iTzRyuujin/southpark-tv-module@v0.1.0

This repository contains only the public runtime module. It contains no TV
addresses, account credentials, signing keys, media files, or media proxy.
The package.json `private` field prevents accidental npm publication; this
GitHub repository and its runtime code are intentionally public.

## Controls
- Arrow keys: select items; OK: activate.
- Back: reopen the catalog from the official page, or leave the catalog.
- Native cookie choice: arrow keys and OK; no automatic tracking consent.
- OK on the player: attempt play/pause through the official player.

## Limits — read before use
This is a prototype, not a verified streaming app. Desktop catalog navigation
has been tested with real site data. Target-TV playback, speed improvement,
playback controls, and operation with the PC off still require a real device
test. The original website and player remain responsible for video playback
and access restrictions. No DRM, subscription, or regional checks are bypassed.

The optional request filter is OFF by default. It only intercepts selected
fetch/XHR ad-host requests, is not a full ad blocker, may break the player,
and does not guarantee ad-free viewing. No tracking or analytics is added.
The module relies on the original website's DOM and may break if it changes.

The normal TizenBrew post-navigation injection path is used, matching its
standard site-module approach; early-document injection is not required.
