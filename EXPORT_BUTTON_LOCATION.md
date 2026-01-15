# Export Button Location - Updated

## ✅ Button Now in Creator Hub Header

The **Export** button is now located in the **Creator Hub's main header**, exactly where you wanted it (as shown in your screenshot with the red box).

### Button Location

```
[← Back] [Scene Title]                    [Code] [Export] [Preview ▼] [Publish]
```

The Export button appears between the **Code** and **Preview** buttons in the editor header.

## How It Works

1. **User clicks Export button** in the Creator Hub header (top right, secondary button with download icon)
2. **Creator Hub sends RPC request** to the Inspector
3. **Inspector receives trigger** and executes the export logic
4. **Inspector collects entities** with GLTF models and transforms
5. **Data sent to Creator Hub** via existing RPC channel
6. **Main process exports** the merged GLTF file
7. **User sees notification** with success/error message

## Dual Access Points

The export functionality can be triggered from **two locations**:

### 1. Creator Hub Header (Primary - What you requested)
- **Location**: Top right header, next to Code/Preview/Publish buttons
- **Icon**: Download icon (FileDownloadIcon)
- **Label**: "Export"
- **Style**: Secondary button (gray)

### 2. Inspector Toolbar (Secondary - Bonus)
- **Location**: Inside the inspector iframe, in the toolbar with Save/Undo/Redo
- **Icon**: Export icon (BiExport)
- **Style**: Small toolbar button

Both buttons trigger the same export functionality, so users can export from whichever is more convenient.

## Files Modified for Header Button

### Creator Hub (Main Location)
1. **`packages/creator-hub/renderer/src/components/EditorPage/component.tsx`**
   - Added `FileDownloadIcon` import
   - Added `handleExportScene` function
   - Added Export button between Code and Preview buttons

2. **`packages/creator-hub/renderer/src/modules/rpc/scene/client.ts`**
   - Added `EXPORT_SCENE_TRIGGER` method
   - Added `exportSceneTrigger()` function

### Inspector (Receives Trigger)
3. **`packages/inspector/src/lib/rpc/scene/server.ts`**
   - Added handler for `export_scene_trigger`
   - Dispatches custom event to ExportGltf component

4. **`packages/inspector/src/components/Toolbar/ExportGltf/ExportGltf.tsx`**
   - Added `useEffect` to listen for trigger event
   - Renamed `handleExport` to `performExport` for reusability
   - Both button click and event trigger call `performExport()`

## Visual Preview

```
┌─────────────────────────────────────────────────────────────┐
│ [← Back] Tower of Mad                                       │
│                                                              │
│     [Code]  [Export]  [Preview ▼]  [Publish]               │
│              ^^^^^^^^                                        │
│            YOUR BUTTON HERE!                                 │
└─────────────────────────────────────────────────────────────┘
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Inspector (iframe)                                    │  │
│  │ [Save] [Undo] [Redo] [Gizmos...] [Export] [⚙]       │  │
│  │                                    ^^^^^^^^           │  │
│  │                              (Secondary button here)  │  │
│  │                                                       │  │
│  │  [3D Scene View]                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Testing the Button

1. **Build the project**:
   ```bash
   cd /Users/toxsam/Desktop/Web/DCL\ Creator\ Hub\ scene\ exporter
   make build
   ```

2. **Start Creator Hub**:
   ```bash
   cd packages/creator-hub
   npm run start
   ```

3. **Open a scene with 3D models**

4. **Click the Export button** in the header (between Code and Preview)

5. **Choose save location** in the dialog

6. **Check notification** for success/error message

## Button Styling

The Export button matches the style of the **Code** button:
- **Color**: Secondary (gray)
- **Icon**: Download icon
- **Size**: Same as other header buttons
- **Hover**: Standard button hover effect

If you want to change the styling (e.g., make it red like in your screenshot mockup), you can modify the button properties:

```tsx
<Button
  color="secondary"  // Change to "primary" for blue, or add custom className
  onClick={handleExportScene}
  startIcon={<FileDownloadIcon />}
>
  Export
</Button>
```

## Summary

✅ **Export button is now in the Creator Hub header**  
✅ **Located between Code and Preview buttons**  
✅ **Uses download icon (⬇)**  
✅ **Triggers same export functionality**  
✅ **No linting errors**  
✅ **Ready to test**

The button is exactly where you wanted it - in the top right header of the Creator Hub editor!

