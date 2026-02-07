import type { Entity } from '@dcl/sdk/ecs';
import {
  AudioSource,
  ColliderLayer,
  EasingFunction,
  engine,
  GltfContainer,
  InputAction,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  Name,
  pointerEventsSystem,
  Transform,
  Tween,
  tweenSystem,
  VisibilityComponent,
} from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import { executeTask } from '@dcl/sdk/ecs';
import { getSceneInformation } from '~system/Runtime';

type Photo = {
  id: string;
  dateTime: number;
  isPublic: boolean;
  thumbnailUrl: string;
  url: string;
  entity?: Entity;
};

export class PhotoMural {
  // Logic properties
  maxPhotos: number = 10;
  sceneIds: string[] = [];
  photos: Photo[] = [];
  thumbWidth: number = 1;
  thumbHeight: number = this.thumbWidth * 0.5625;
  scrollIndex: number = 0;
  selectedPhotos: Photo[] = [];
  selectedPhotoId: string = '';

  // Entities
  carouselEntity: Entity;
  buttonSoundEntity: Entity;
  spinnerEntity: Entity | null = null;
  button_prev: Entity | null = null;
  button_next: Entity | null = null;

  // Timer
  refreshRate: number = 10;
  refreshTimer: number = 0;

  // Cache
  photosBySceneId = new Map<string, Photo[]>();

  // Configuration
  worldName: string | null = null;
  targetCoordinates: string[] = [];

  constructor(
    public src: string,
    public entity: Entity,
    public use_current_scene: boolean = true,
    public coordinates: string = '',
    public world_id: string = '',
  ) {
    this.carouselEntity = engine.addEntity();

    // Create button sound entity
    this.buttonSoundEntity = engine.addEntity();
    Transform.create(this.buttonSoundEntity, { parent: this.entity });
    AudioSource.create(this.buttonSoundEntity, {
      audioClipUrl: this.src + '/button-sound.mp3',
      playing: false,
      loop: false,
      volume: 1.0,
    });
  }

  /**
   * Recursively checks if an entity is a descendant of the given parent entity
   * @param entity - The entity to check
   * @param parentEntity - The parent entity to check against
   * @returns true if the entity is a descendant of the parent entity
   */
  private isDescendantOf(entity: Entity, parentEntity: Entity): boolean {
    const transform = Transform.getOrNull(entity);
    if (!transform || !transform.parent) {
      return false;
    }
    if (transform.parent === parentEntity) {
      return true;
    }
    // Recursively check the parent
    return this.isDescendantOf(transform.parent, parentEntity);
  }

  /**
   * Finds the button entities by recursively checking all descendants of the main entity
   * Looks for entities with names starting with "previous_red" and "next_red"
   */
  private findButtonEntities() {
    let prevButton: Entity | null = null;
    let nextButton: Entity | null = null;
    let prevButtonFound = false;
    let nextButtonFound = false;

    // Iterate through all entities with Transform to find descendants
    for (const [childEntity, _transform] of engine.getEntitiesWith(Transform)) {
      // Check if this entity is a descendant of our main entity (recursively)
      if (this.isDescendantOf(childEntity, this.entity)) {
        // Check if this descendant has a Name component
        const nameComponent = Name.getOrNull(childEntity);
        if (nameComponent) {
          if (nameComponent.value.startsWith('previous_red')) {
            if (prevButtonFound) {
              console.error(
                'PhotoMural: Multiple descendants found with name starting with "previous_red". Expected exactly one.',
              );
              prevButton = null;
            } else {
              prevButton = childEntity;
              prevButtonFound = true;
            }
          } else if (nameComponent.value.startsWith('next_red')) {
            if (nextButtonFound) {
              console.error(
                'PhotoMural: Multiple descendants found with name starting with "next_red". Expected exactly one.',
              );
              nextButton = null;
            } else {
              nextButton = childEntity;
              nextButtonFound = true;
            }
          }
        }
      }
    }

    // Set the found buttons or log errors
    if (prevButton === null) {
      console.error(
        'PhotoMural: No descendant entity found with name starting with "previous_red"',
      );
    } else {
      this.button_prev = prevButton;
    }

    if (nextButton === null) {
      console.error('PhotoMural: No descendant entity found with name starting with "next_red"');
    } else {
      this.button_next = nextButton;
    }
  }

  /**
   * Reads the scene configuration to determine world or coordinates
   */
  private async readSceneConfiguration(): Promise<void> {
    if (this.use_current_scene) {
      try {
        await executeTask(async () => {
          const sceneInfo = await getSceneInformation({});

          if (sceneInfo && sceneInfo.metadataJson) {
            const sceneJson = JSON.parse(sceneInfo.metadataJson);

            // Check for worldConfiguration first
            if (sceneJson.worldConfiguration && sceneJson.worldConfiguration.name) {
              this.worldName = sceneJson.worldConfiguration.name;
              this.targetCoordinates = [sceneJson.scene.base];
              console.log('PhotoMural: Using world from scene configuration:', this.worldName);
            } else if (sceneJson.scene && sceneJson.scene.base) {
              // Fall back to base parcel coordinates
              this.targetCoordinates = [sceneJson.scene.base];
              console.log(
                'PhotoMural: Using base parcel from scene configuration:',
                this.targetCoordinates,
              );
            } else {
              console.log(
                'PhotoMural: No worldConfiguration or base parcel found in scene.json, using empty configuration',
              );
              this.targetCoordinates = [];
            }
          }
        });
      } catch (e) {
        console.error('PhotoMural: Error reading scene configuration:', e);
        this.targetCoordinates = [];
      }
    } else {
      // Manual mode: use provided world_id and coordinates
      if (this.world_id && this.world_id.length > 0) {
        this.worldName = this.world_id;
        console.log('PhotoMural: Using provided world_id:', this.worldName);
      } else if (this.coordinates && this.coordinates.length > 0) {
        this.targetCoordinates = [this.coordinates];
        console.log('PhotoMural: Using provided coordinates:', this.targetCoordinates);
      } else {
        console.log(
          'PhotoMural: use_current_scene is false but no world_id or coordinates provided',
        );
        this.targetCoordinates = [];
      }
    }
  }

  /**
   * Start function - called when the script is initialized
   */
  async start() {
    console.log('PhotoMural initialized for entity:', this.entity);

    // Find button entities by name
    this.findButtonEntities();

    // Setup Spinner first - show immediately since we're loading
    this.setupSpinner();

    // Setup Frame and Billboard (Visuals)
    // Assuming 'src' might be the GLTF for the billboard/frame
    // Remote code created a frameEntity and a billboard.
    // We will attach them to this.entity.

    const frameEntity = engine.addEntity();
    Transform.create(frameEntity, {
      parent: this.entity,
      position: Vector3.create(0, 1.9, -0.29),
      rotation: Quaternion.fromEulerDegrees(0, 180, 0),
      scale: Vector3.create(4, 4, 1),
    });
    MeshCollider.setPlane(frameEntity, ColliderLayer.CL_PHYSICS);

    const billboard = engine.addEntity();
    Transform.create(billboard, {
      parent: this.entity,
      position: Vector3.create(0, -0.7, 0.1),
      scale: Vector3.create(1, 1, 1),
    });

    if (this.src && this.src.length > 0) {
      GltfContainer.create(billboard, {
        src: this.src,
        visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
        invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
      });
    } else {
      // Fallback if no src provided, maybe use the one from remote example or just skip
      GltfContainer.create(billboard, {
        src: this.src + '/billboard.glb', // Default from remote example
        visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
        invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
      });
    }

    // Setup Carousel
    Transform.create(this.carouselEntity, {
      parent: this.entity,
      position: Vector3.create(-1.025, this.thumbHeight / 2 + 0.45, -0.35),
    });

    // Setup Buttons
    if (this.button_prev) {
      this.setupButton(this.button_prev, -1);
    }
    if (this.button_next) {
      this.setupButton(this.button_next, 1);
    }

    // Read scene configuration to determine world or coordinates
    await this.readSceneConfiguration();

    // Initialize scene IDs from world or coordinates
    if (this.worldName) {
      await this.initPhotoMuralSystemFromWorld(this.worldName);
      // If world lookup failed and we have coordinates as fallback, use them
      if (this.sceneIds.length === 0 && this.targetCoordinates.length > 0) {
        console.log('PhotoMural: World lookup failed, falling back to coordinates');
        await this.initPhotoMuralSystem(this.targetCoordinates);
      }
    } else if (this.targetCoordinates.length > 0) {
      await this.initPhotoMuralSystem(this.targetCoordinates);
    } else {
      console.error('PhotoMural: No valid configuration found (world or coordinates)');
    }

    // Initial fetch - spinner is already visible
    this.getCameraReelPhotos();
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    this.refreshTimer += dt;
    if (this.refreshTimer < this.refreshRate) return;
    this.refreshTimer = 0;

    // Show spinner when refreshing
    this.showSpinner();
    this.getCameraReelPhotos();
  }

  private setupButton(buttonEntity: Entity, movement: number) {
    pointerEventsSystem.onPointerDown(
      {
        entity: buttonEntity,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: movement === -1 ? 'Previous' : 'Next',
        },
      },
      () => {
        // Play button sound
        const audio = AudioSource.getMutable(this.buttonSoundEntity);
        audio.currentTime = 0;
        audio.playing = true;

        this.scrollCarousel(movement);
      },
    );
  }

  private setupSpinner() {
    this.spinnerEntity = engine.addEntity();
    Transform.create(this.spinnerEntity, {
      parent: this.entity,
      position: Vector3.create(0, 2.05, -0.35),
      scale: Vector3.create(1, 1, 1),
    });

    MeshRenderer.setPlane(this.spinnerEntity);
    Material.setPbrMaterial(this.spinnerEntity, {
      texture: Material.Texture.Common({
        src: this.src + '/spinner.png',
      }),
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
      castShadows: false,
      metallic: 0,
      roughness: 1,
    });

    // Start continuous rotation
    Tween.setRotateContinuous(this.spinnerEntity, Quaternion.fromEulerDegrees(90, 0, 0), 100);

    // Show spinner immediately - we're loading from the start
    VisibilityComponent.createOrReplace(this.spinnerEntity, {
      visible: true,
    });
  }

  private showSpinner() {
    if (this.spinnerEntity) {
      VisibilityComponent.getMutable(this.spinnerEntity).visible = true;
    }
  }

  private hideSpinner() {
    if (this.spinnerEntity) {
      VisibilityComponent.getMutable(this.spinnerEntity).visible = false;
    }
  }

  /**
   * Resets the photo mural:
   * - deletes any existing displayed photos (thumbnails + selected photo entities)
   * - fetches fresh data from the server
   * - shows the spinner while fetching
   * @action
   */
  public resetPhotos() {
    // Always show spinner while we reset/refetch
    this.showSpinner();

    // Stop any in-flight carousel tween and reset basic state
    Tween.deleteFrom(this.carouselEntity);
    // Snap carousel back to its initial position (otherwise thumbnails keep the old offset)
    Transform.getMutable(this.carouselEntity).position = Vector3.create(
      -1.025,
      this.thumbHeight / 2 + 0.45,
      -0.35,
    );
    this.scrollIndex = 0;
    this.selectedPhotoId = '';
    this.refreshTimer = 0;

    // Remove all existing photo entities safely (copy array since removePhoto mutates)
    const existingPhotos = [...this.photos];
    existingPhotos.forEach(photo => this.removePhoto(photo));

    // Clear caches to force fresh reads
    this.photosBySceneId.clear();

    // Trigger a fresh fetch from the server
    executeTask(async () => {
      await this.getCameraReelPhotos();
    });
  }

  /**
   * Initialize photo mural system from world name
   * Uses Places API to get the world's place ID, then uses that to fetch photos
   */
  private async initPhotoMuralSystemFromWorld(worldName: string) {
    try {
      // Use Places API to get the world's place ID by filtering by world name
      // According to the API spec, we can use world_names parameter for exact match
      const response = await fetch(
        `https://places.decentraland.org/api/destinations?world_names=${encodeURIComponent(worldName)}&only_worlds=true&limit=1`,
      );
      const destinationsData = await response.json();

      if (
        destinationsData &&
        destinationsData.ok &&
        destinationsData.data &&
        destinationsData.data.length > 0
      ) {
        // Get the world's place ID (UUID)
        const worldPlace = destinationsData.data[0];
        if (worldPlace.id) {
          this.sceneIds.push(worldPlace.id);
          console.log(`PhotoMural: Found world ${worldName} with place ID: ${worldPlace.id}`);
        } else {
          console.error(`PhotoMural: World ${worldName} found but has no place ID`);
        }
      } else {
        // Fallback: try the worlds endpoint
        const worldsResponse = await fetch(
          `https://places.decentraland.org/api/worlds?names=${encodeURIComponent(worldName)}&limit=1`,
        );
        const worldsData = await worldsResponse.json();

        if (worldsData && worldsData.ok && worldsData.data && worldsData.data.length > 0) {
          const world = worldsData.data[0];
          if (world.id) {
            this.sceneIds.push(world.id);
            console.log(`PhotoMural: Found world ${worldName} with ID: ${world.id}`);
          } else {
            console.error(`PhotoMural: World ${worldName} found but has no ID`);
          }
        } else {
          console.error(`PhotoMural: World ${worldName} not found in Places API`);
        }
      }

      // Deduplicate
      this.sceneIds = [...new Set(this.sceneIds)];
      console.log(`PhotoMural: Found ${this.sceneIds.length} place(s) for world ${worldName}`);
    } catch (e) {
      console.error('Error fetching world from Places API', worldName, e);
    }
  }

  /**
   * Initialize photo mural system from coordinates
   * Fetches scene IDs from parcel coordinates
   */
  private async initPhotoMuralSystem(sceneCoords: string[]) {
    for (const coord of sceneCoords) {
      try {
        const response = await fetch(
          'https://places.decentraland.org/api/places/?positions=' + coord,
        );
        const placeBody = await response.json();
        const sceneId = placeBody?.data[0]?.id;
        if (sceneId) this.sceneIds.push(sceneId);
      } catch (e) {
        console.error('Error fetching scene ID for coord', coord, e);
      }
    }
    // Deduplicate
    this.sceneIds = [...new Set(this.sceneIds)];
  }

  private async getCameraReelPhotos() {
    const getCameraReelURL = (placeId: string) =>
      `https://camera-reel-service.decentraland.org/api/places/${placeId}/images`;

    // Ensure spinner is visible when fetching starts
    this.showSpinner();

    // Fetch photos from place IDs (works for both Genesis City places and worlds)
    // Worlds are represented as places with UUIDs in the system
    for (const placeId of this.sceneIds) {
      try {
        const response = await fetch(getCameraReelURL(placeId));
        const photosBody = await response.json();
        this.photosBySceneId.set(placeId, photosBody.images || photosBody.data || []);
      } catch (e) {
        console.error('Error fetching photos for place', placeId, e);
      }
    }

    const allPhotos: Photo[] = [];
    this.sceneIds.forEach(placeId => {
      const photos = this.photosBySceneId.get(placeId);
      if (photos) {
        allPhotos.push(...photos.map((photo: any) => ({ ...photo })));
      }
    });

    this.processNewPhotos(allPhotos);
  }

  processNewPhotos(newPhotos: Photo[]) {
    const currentIds = this.photos.map(p => p.id);
    const tempNewPhotos = newPhotos
      .sort((p1, p2) => p2.dateTime - p1.dateTime)
      .slice(0, this.maxPhotos);

    const photosToRemove = this.photos.filter(p => !tempNewPhotos.some(newP => newP.id === p.id));
    photosToRemove.forEach(photo => this.removePhoto(photo));

    tempNewPhotos.forEach(photo => {
      if (!currentIds.includes(photo.id)) {
        this.createPhoto(photo);
      }
    });

    this.placePhotos();

    if (!this.selectedPhotoId && this.photos.length > 0) {
      this.setSelectedPhoto(this.photos[0]);
    }

    // Hide spinner only when we actually have photos loaded
    if (this.photos.length > 0) {
      this.hideSpinner();
    }
  }

  private createPhoto(photo: Photo) {
    photo.entity = engine.addEntity();
    Transform.create(photo.entity, {
      parent: this.carouselEntity,
      position: Vector3.create(0, 0.3, 0),
      scale: Vector3.create(this.thumbWidth * 0.5, this.thumbHeight * 0.5, 1),
    });

    MeshRenderer.setPlane(photo.entity);
    Material.setBasicMaterial(photo.entity, {
      texture: Material.Texture.Common({
        src: photo.thumbnailUrl,
      }),
    });

    MeshCollider.setPlane(photo.entity, ColliderLayer.CL_POINTER);

    VisibilityComponent.createOrReplace(photo.entity, {
      visible: false,
    });

    this.photos.push(photo);

    pointerEventsSystem.onPointerDown(
      {
        entity: photo.entity!,
        opts: {
          button: InputAction.IA_ANY,
          maxDistance: 10,
          hoverText: 'View Photo',
        },
      },
      cmd => {
        if (cmd.button === InputAction.IA_POINTER) {
          this.setSelectedPhoto(photo);
        }
        if (cmd.button === InputAction.IA_PRIMARY) {
          this.scrollCarousel(-1);
        }
        if (cmd.button === InputAction.IA_SECONDARY) {
          this.scrollCarousel(1);
        }
      },
    );

    // Create selectedPhotoItem
    const selectedPhotoEntity = engine.addEntity();
    this.selectedPhotos.push({ ...photo, entity: selectedPhotoEntity });

    Transform.create(selectedPhotoEntity, {
      parent: this.entity,
      position: Vector3.create(0, 2.05, -0.35),
      scale: Vector3.create(0, 0, 0),
    });

    MeshRenderer.setPlane(selectedPhotoEntity);
    Material.setBasicMaterial(selectedPhotoEntity, {
      texture: Material.Texture.Common({
        src: photo?.url,
      }),
    });
  }

  private setSelectedPhoto(photo: Photo) {
    if (this.selectedPhotoId == photo.id) return;

    for (const selectedPhoto of this.selectedPhotos) {
      if (selectedPhoto.entity) {
        Tween.deleteFrom(selectedPhoto.entity);
        Transform.getMutable(selectedPhoto.entity).scale = Vector3.create(0, 0, 0);
      }
    }

    this.selectedPhotoId = photo.id;
    const newSelectedPhoto = this.selectedPhotos.find(p => p.id === photo.id);

    if (newSelectedPhoto && newSelectedPhoto.entity) {
      Tween.createOrReplace(newSelectedPhoto.entity, {
        mode: Tween.Mode.Scale({
          start: Vector3.create(1.5, 0.7, 1),
          end: Vector3.create(3.05, 3.05 * 0.5625, 1),
        }),
        duration: 300,
        easingFunction: EasingFunction.EF_EASEOUTQUAD,
      });
    }
  }

  private removePhoto(photo: Photo) {
    if (photo.entity) {
      engine.removeEntityWithChildren(photo.entity);
    }
    this.photos = this.photos.filter(p => p.id !== photo.id);

    if (this.selectedPhotoId === photo.id && this.photos.length > 0) {
      this.setSelectedPhoto(this.photos[0]);
    } else if (this.photos.length === 0) {
      this.selectedPhotoId = '';
    }

    const selectedPhoto = this.selectedPhotos.find(p => p.id === photo.id);
    if (selectedPhoto && selectedPhoto.entity) {
      engine.removeEntityWithChildren(selectedPhoto.entity);
    }
    this.selectedPhotos = this.selectedPhotos.filter(p => p.id !== photo.id);
  }

  private placePhotos() {
    this.photos = this.photos.sort((p1, p2) => p2.dateTime - p1.dateTime);

    this.photos.forEach((photo, i) => {
      if (photo.entity) {
        const targetPosition = Vector3.create(i * (this.thumbWidth + 0.025), 0, 0);
        Transform.getMutable(photo.entity).position = targetPosition;
      }
    });
    this.setPhotosVisibility();

    if (this.selectedPhotos.length > 0 && !this.selectedPhotoId) {
      this.setSelectedPhoto(this.photos[0]);
    }
  }

  scrollCarousel(positions: number) {
    if (this.scrollIndex + positions < 0 || this.scrollIndex + positions >= this.photos.length - 2)
      return;

    const currentPosition = Transform.get(this.carouselEntity).position;
    this.scrollIndex += positions;

    // before moving hide the last photo
    const oldPhoto =
      positions > 0 ? this.photos[this.scrollIndex - 1] : this.photos[this.scrollIndex + 3];
    if (oldPhoto) {
      this.hidePhoto(oldPhoto);
    }

    Tween.createOrReplace(this.carouselEntity, {
      mode: Tween.Mode.Move({
        start: currentPosition,
        end: Vector3.create(
          this.scrollIndex * -1 * (this.thumbWidth + 0.025) - this.thumbWidth,
          currentPosition.y,
          currentPosition.z,
        ),
      }),
      duration: 300,
      easingFunction: EasingFunction.EF_EASEOUTSINE,
    });

    // We need a system to check for tween completion
    const systemName = 'scrollSystem_' + Math.random().toString();
    engine.addSystem(
      () => {
        const tweenCompleted = tweenSystem.tweenCompleted(this.carouselEntity);
        if (tweenCompleted) {
          const newPhoto =
            positions < 0 ? this.photos[this.scrollIndex] : this.photos[this.scrollIndex + 2];
          if (newPhoto) {
            this.showPhoto(newPhoto);
          }
          engine.removeSystem(systemName);
        }
      },
      undefined,
      systemName,
    );
  }

  setPhotosVisibility() {
    this.photos.forEach((photo, i) => {
      const isVisible = i >= this.scrollIndex && i <= this.scrollIndex + 2;

      if (isVisible) {
        this.showPhoto(photo);
      } else {
        this.hidePhoto(photo);
      }
    });
  }

  hidePhoto(photo: Photo) {
    if (!photo.entity) return;
    VisibilityComponent.getMutable(photo.entity).visible = false;
    MeshCollider.getMutable(photo.entity).collisionMask = ColliderLayer.CL_NONE;
    Tween.deleteFrom(photo.entity);
  }

  showPhoto(photo: Photo) {
    if (!photo.entity) return;
    VisibilityComponent.getMutable(photo.entity).visible = true;
    MeshCollider.getMutable(photo.entity).collisionMask = ColliderLayer.CL_POINTER;
    Tween.createOrReplace(photo.entity, {
      mode: Tween.Mode.Scale({
        start: Vector3.create(this.thumbWidth * 0.5, this.thumbHeight * 0.5, 1),
        end: Vector3.create(this.thumbWidth, this.thumbHeight, 1),
      }),
      duration: 50,
      easingFunction: EasingFunction.EF_EASEOUTSINE,
    });
  }
}
