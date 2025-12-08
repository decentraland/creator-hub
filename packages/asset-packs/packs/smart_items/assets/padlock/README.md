# Padlock Asset Pack

An interactive 4-digit combination lock puzzle for Decentraland.

## Description

This asset creates a functional padlock that players can interact with by clicking on the spinning wheels to enter a combination. When the correct combination is entered, the lock plays a success sound.

## Required Asset Files

To use this asset pack, you need to add the following files from the [padlock_genesis smart-item](https://github.com/decentraland/smart-items/tree/master/padlock_genesis):

### 3D Models

Place these in `models/padlock/`:
- **Padlock.glb** - Main padlock body model
- **PadlockRullet.glb** - Individual wheel model (used for 4 spinning wheels)

### Audio Files

Place these in `sounds/`:
- **Button_Press.mp3** - Sound played when spinning a wheel
- **Resolve.mp3** - Sound played when the correct combination is entered

## Directory Structure

```
magic_script/
├── composite.json          # Entity definition with components
├── data.json              # Asset metadata
├── PadlockScript.ts       # Main script logic
├── thumbnail.png          # Asset preview image
├── models/
│   └── padlock/
│       ├── Padlock.glb
│       └── PadlockRullet.glb
└── sounds/
    ├── Button_Press.mp3
    └── Resolve.mp3
```

## Configuration

The padlock script accepts one parameter:

- **combination** (number, default: 1234) - The 4-digit code needed to unlock the padlock

## How It Works

1. **Initialization**: Four wheel entities are created as children of the main padlock
2. **Interaction**: Players click on each wheel to cycle through digits 0-9
3. **Visual Feedback**: Wheels rotate 36° per digit (360° total for full rotation)
4. **Audio Feedback**: Each click plays the button press sound
5. **Success**: When the combination matches, the resolve sound plays

## Features

- ✅ Interactive 4-digit combination lock
- ✅ Visual rotation feedback on wheels
- ✅ Audio feedback for interactions
- ✅ Customizable combination code
- ✅ Auto-scramble on initialization
- ✅ Success detection and celebration

## Script API

The `PadlockScript` class exposes:

- **scramble()** - Randomize all wheels to new positions (public method)
- **start()** - Initialize the padlock (called automatically)
- **update(dt)** - Frame update callback (currently unused)

## Migration Notes

This asset was migrated from the legacy smart-items format to the new asset pack format:

- **Old**: Used `decentraland-builder-scripts` library with Spawner pattern
- **New**: Uses `@dcl/sdk/ecs` with class-based Script component
- **Removed**: Dockerfile, package.json, node dependencies
- **Simplified**: Direct entity manipulation instead of channel-based communication
