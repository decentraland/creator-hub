import bpy
import sys
import json
import os

def is_collider(obj_name):
    """Check if an object is a collider based on naming conventions"""
    collider_keywords = [
        '_collider', '_collision', '_col',
        'collider', 'collision',
        'mesh_collider', 'box_collider', 'sphere_collider'
    ]
    name_lower = obj_name.lower()
    return any(keyword in name_lower for keyword in collider_keywords)

def get_all_children(obj):
    """Recursively get all children of an object"""
    children = []
    for child in obj.children:
        if child.type == 'MESH':
            children.append(child)
            children.extend(get_all_children(child))
    return children

def main():
    """Main export function"""
    
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    
    if len(argv) < 1:
        print("Error: Output directory not provided")
        sys.exit(1)
    
    output_dir = argv[0]
    os.makedirs(output_dir, exist_ok=True)
    
    metadata_path = os.path.join(output_dir, "metadata.json")
    
    print(f"[Blender Export] Starting export to: {output_dir}")
    print(f"[Blender Export] Scene: {bpy.data.filepath}")
    print(f"[Blender Export] New approach: Exporting parent+children groups as single GLBs...")
    
    # STEP 1: Capture all transforms BEFORE any export operations
    print(f"[Blender Export] Step 1: Capturing transforms...")
    
    # Update scene to ensure all transforms are current
    bpy.context.view_layer.update()
    
    object_transforms = {}
    
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            # Use evaluated object to get correct transforms (includes constraints, modifiers, etc.)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            obj_eval = obj.evaluated_get(depsgraph)
            world_matrix = obj_eval.matrix_world.copy()
            
            object_transforms[obj.name] = {
                'location': world_matrix.to_translation().copy(),
                'rotation': world_matrix.to_quaternion().copy(),
                'scale': world_matrix.to_scale().copy(),
                'parent': obj.parent.name if obj.parent else None,
                'is_root': obj.parent is None,
            }
            
            # Debug: print what we captured
            loc = world_matrix.to_translation()
            print(f"[Blender Export] Captured {obj.name}: World pos ({loc.x:.2f}, {loc.y:.2f}, {loc.z:.2f})")
    
    # STEP 2: Group objects by root parent
    root_objects = []
    object_groups = {}  # {root_name: [root, child1, child2, ...]}
    
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.parent is None:
            root_objects.append(obj)
            children = get_all_children(obj)
            object_groups[obj.name] = [obj] + children
            print(f"[Blender Export] Group '{obj.name}': 1 parent + {len(children)} children")
    
    # STEP 3: Export each group as a single GLB
    print(f"[Blender Export] Step 2: Exporting GLB files...")
    exported_groups = {}
    
    for root_name, objects in object_groups.items():
        try:
            # Select all objects in this group
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            
            # Export this group as one GLB with Y-up coordinate system
            glb_filename = f"{root_name}.glb"
            glb_path = os.path.join(output_dir, glb_filename)
            
            bpy.ops.export_scene.gltf(
                filepath=glb_path,
                export_format='GLB',
                export_apply=True,  # Apply modifiers
                export_animations=False,
                export_cameras=False,
                export_lights=False,
                export_yup=True,  # Export with Y-up (Decentraland's coordinate system)
                use_selection=True,  # Export only selected objects
            )
            
            exported_groups[root_name] = {
                'gltfFile': glb_filename,
                'objects': [obj.name for obj in objects],
                'root': root_name,
                'children': [obj.name for obj in objects[1:]]
            }
            
            print(f"[Blender Export] ✓ Exported group '{root_name}' -> {glb_filename}")
            for child in objects[1:]:
                collider_tag = " [COLLIDER]" if is_collider(child.name) else ""
                print(f"  ↳ Child: {child.name}{collider_tag}")
                
        except Exception as e:
            print(f"[Blender Export] ✗ Failed to export group '{root_name}': {e}")
    
    print(f"[Blender Export] Successfully exported {len(exported_groups)} groups")
    
    # STEP 4: Build metadata using captured transforms
    print(f"[Blender Export] Step 3: Building metadata...")
    metadata = {
        "objects": {},
        "groups": exported_groups,
        "coordinate_system": "Y_UP",
        "blender_version": bpy.app.version_string,
    }
    
    # Process all mesh objects for metadata (using pre-captured transforms)
    for obj_name, transform_data in object_transforms.items():
        obj = bpy.data.objects.get(obj_name)
        if not obj or obj.type != 'MESH':
            continue
            
        # Find which GLB file this object belongs to
        parent_root = obj
        while parent_root.parent is not None:
            parent_root = parent_root.parent
        gltf_file = f"{parent_root.name}.glb" if parent_root.type == 'MESH' else None
        
        # For ROOT objects: Position handling
        if transform_data['is_root']:
            # When exporting with use_selection=True and export_yup=True, the GLB exporter
            # automatically exports objects at their world positions (with coordinate conversion).
            # This means the GLB file already contains the correct position information.
            # When importing the GLB in Decentraland at (0,0,0), it appears at the correct location.
            # Therefore, we set the position to (0,0,0) - the GLB's baked-in position handles placement.
            converted_location = {
                "x": 0.0,
                "y": 0.0,
                "z": 0.0
            }
            
            # DON'T apply rotation - GLB is already in Y-up space!
            converted_rotation = {
                "x": 0.0,
                "y": 0.0,
                "z": 0.0,
                "w": 1.0
            }
            
            # DON'T apply scale - GLB already has correct scale baked in!
            converted_scale = {
                "x": 1.0,
                "y": 1.0,
                "z": 1.0
            }
            
            location = transform_data['location']
            print(f"[Blender Export] {obj_name} (ROOT)")
            print(f"  Blender world position: X={location.x:.2f}, Y={location.y:.2f}, Z={location.z:.2f}")
            print(f"  DCL position (set to 0,0,0): X={converted_location['x']:.2f}, Y={converted_location['y']:.2f}, Z={converted_location['z']:.2f}")
            print(f"  (Position set to 0,0,0 - GLB exporter bakes world position into the file)")
            print(f"  (Scale: 1,1,1 - baked in GLB)")
            
        else:
            # For CHILD objects: use local transforms (no conversion - within GLB)
            location = transform_data['location']
            rotation = transform_data['rotation']
            scale = transform_data['scale']
            
            converted_location = {"x": float(location.x), "y": float(location.y), "z": float(location.z)}
            converted_rotation = {"x": float(rotation.x), "y": float(rotation.y), "z": float(rotation.z), "w": float(rotation.w)}
            converted_scale = {"x": float(scale.x), "y": float(scale.y), "z": float(scale.z)}
            
            collider_tag = " [COLLIDER]" if is_collider(obj_name) else ""
            parent_name = transform_data['parent']
            print(f"[Blender Export] {obj_name} (child of {parent_name}){collider_tag}")
            print(f"  LOCAL pos: ({location.x:.2f}, {location.y:.2f}, {location.z:.2f})")
        
        is_collider_obj = is_collider(obj_name)
        
        metadata["objects"][obj_name] = {
            "name": obj_name,
            "type": obj.type,
            "gltfFile": gltf_file,
            "location": converted_location,
            "rotation": converted_rotation,
            "scale": converted_scale,
            "dimensions": {
                "x": float(obj.dimensions.x),
                "y": float(obj.dimensions.z),
                "z": float(obj.dimensions.y)
            },
            "parent": transform_data['parent'],
            "isCollider": is_collider_obj,
            "collection": obj.users_collection[0].name if obj.users_collection else None,
            "visible": obj.visible_get(),
        }
    
    # Add children list to root objects
    for root_name, group_data in exported_groups.items():
        if root_name in metadata["objects"]:
            metadata["objects"][root_name]["children"] = group_data['children']
    
    # Write metadata to JSON file
    try:
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"[Blender Export] Metadata exported successfully")
        print(f"[Blender Export] Total objects: {len(metadata['objects'])}")
        root_count = sum(1 for obj in metadata['objects'].values() if obj['parent'] is None)
        print(f"[Blender Export] Root objects (entities to create): {root_count}")
    except Exception as e:
        print(f"Error writing metadata: {e}")
        sys.exit(1)
    
    print("[Blender Export] Export completed successfully!")

if __name__ == "__main__":
    main()
